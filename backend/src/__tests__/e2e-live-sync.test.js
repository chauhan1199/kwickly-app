/**
 * E2E Live-Sync Test — real HTTP server + real Socket.io
 *
 * Boots the actual Express app behind http.createServer, attaches the real
 * socket.helper (initSocket) and socket handlers (initSocketHandlers), and
 * drives every role through the public REST API while socket.io-client
 * connections (customer, worker, shop, admin) record every event they get.
 *
 * Only infrastructure is faked:
 *   - ioredis   → in-memory fake, so the REAL redis.helper (cache, locks,
 *                 dashboard-stats invalidation) runs against it
 *   - rate limiters, SMS, cloudinary
 *
 * Tests commented "Regression (fixed)" pin bugs this suite originally found
 * (OTP leaks, double fee, stale admin stats, delivery OTP expiry, …).
 */

// ─── In-memory ioredis replacement (hoisted) ─────────────────────────────────
jest.mock('ioredis', () => {
    const { EventEmitter } = require('events');
    const store = new Map();
    const alive = (k) => {
        const e = store.get(k);
        if (!e) return undefined;
        if (e.exp && e.exp < Date.now()) { store.delete(k); return undefined; }
        return e;
    };
    class FakeRedis extends EventEmitter {
        constructor() { super(); this.status = 'ready'; }
        async set(k, v, ...args) {
            let ex = null; let nx = false;
            for (let i = 0; i < args.length; i++) {
                const a = String(args[i]).toUpperCase();
                if (a === 'EX') ex = Number(args[++i]);
                else if (a === 'PX') ex = Number(args[++i]) / 1000;
                else if (a === 'NX') nx = true;
            }
            if (nx && alive(k)) return null;
            store.set(k, { v: String(v), exp: ex ? Date.now() + ex * 1000 : null });
            return 'OK';
        }
        async get(k) { const e = alive(k); return e ? e.v : null; }
        async del(...keys) {
            let n = 0;
            for (const k of keys.flat()) if (store.delete(k)) n++;
            return n;
        }
        async scan(cursor, ...args) {
            let pattern = '*';
            for (let i = 0; i < args.length; i++) {
                if (String(args[i]).toUpperCase() === 'MATCH') pattern = String(args[++i]);
            }
            const re = new RegExp('^' + pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
            return ['0', [...store.keys()].filter(k => alive(k) && re.test(k))];
        }
        async eval(script, numKeys, key, holder) {
            const e = alive(key);
            if (e && e.v === String(holder)) { store.delete(key); return 1; }
            return 0;
        }
        async incr(k) {
            const e = alive(k);
            const v = (e ? Number(e.v) : 0) + 1;
            store.set(k, { v: String(v), exp: e ? e.exp : null });
            return v;
        }
        async expire(k, s) { const e = alive(k); if (!e) return 0; e.exp = Date.now() + s * 1000; return 1; }
        // Never becomes ready → socket.helper stays on the in-process adapter
        duplicate() { const d = new FakeRedis(); d.status = 'connecting'; return d; }
        async quit() { return 'OK'; }
        disconnect() {}
    }
    FakeRedis.__store = store;
    return FakeRedis;
});

jest.mock('../middleware/rateLimit.middleware', () => {
    const passThrough = (req, res, next) => next();
    return { globalLimiter: passThrough, authLimiter: passThrough, otpSendLimiter: passThrough };
});

jest.mock('../services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));

jest.mock('../services/cloudinary.service', () => ({
    uploadImage: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/test.jpg', public_id: 'test_id' }),
    cleanupImage: jest.fn(),
    uploadBase64: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/test/image/upload/b64.jpg', public_id: 'b64_id' })
}));

process.env.JWT_SECRET = 'test_secret_key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
let ioClient;
try {
    ioClient = require('socket.io-client').io;
} catch (e) {
    ioClient = require('../../../admin/node_modules/socket.io-client').io;
}

const app = require('../app');
const { initSocket, getIO } = require('../helpers/socket.helper');
const { initSocketHandlers } = require('../sockets');

const Customer = require('../modules/customer/customer.model');
const Category = require('../modules/category/category.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const Job = require('../modules/job/job.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const AppSettings = require('../modules/settings/settings.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const PlatformLedger = require('../modules/ledger/platformLedger.model');
const { AdminWallet, AdminWalletTxn } = require('../modules/adminWallet/adminWallet.model');
const DeliveryStaff = require('../modules/deliveryStaff/deliveryStaff.model');

jest.setTimeout(60000);

// ─── Geography ───────────────────────────────────────────────────────────────
const JOB_COORDS = [72.8777, 19.0760];          // Mumbai
const WORKER_HOME = [72.8800, 19.0780];         // ~330 m away
const AT_JOB = [72.8778, 19.0761];              // ~15 m away (inside geofence)

// ─── Harness ─────────────────────────────────────────────────────────────────
let mongoServer;
let server;
let baseUrl;
const sockets = [];

const sign = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const api = () => request(server);
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const connect = (token) => new Promise((resolve, reject) => {
    const s = ioClient(baseUrl, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false
    });
    s.rec = [];
    s.onAny((event, data) => s.rec.push({ event, data }));
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
    sockets.push(s);
});

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v) : String(v));

/** Wait until the socket has recorded `event` matching `pred`. */
const waitFor = async (sock, event, pred = () => true, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const hit = sock.rec.find(e => e.event === event && pred(e.data || {}));
        if (hit) return hit.data;
        await sleep(25);
    }
    throw new Error(`Timed out waiting for ${event} (got: ${sock.rec.map(e => e.event).join(', ') || 'nothing'})`);
};
const has = (sock, event, pred = () => true) => sock.rec.some(e => e.event === event && pred(e.data || {}));
const eventsOf = (sock, event) => sock.rec.filter(e => e.event === event).map(e => e.data);
const sameId = (a, b) => idOf(a) === idOf(b);

// ─── Actors & shared state ──────────────────────────────────────────────────
const A = {}; // users, tokens, sockets
const S = {}; // flow state

const round2 = (n) => Math.round(n * 100) / 100;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ instance: { dbName: 'kwickly_live_sync', launchTimeout: 60000 } });
    await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 30000 });

    // Real HTTP + real Socket.io wiring, exactly as server.js does it
    server = http.createServer(app);
    initSocket(server);
    initSocketHandlers();
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Platform configuration (all defaults: TIERED job fee, 5% / min ₹10 shop fee, 18% GST)
    await AppSettings.create({ isSingleton: 'CONFIG' });
    S.category = await Category.create({ name: 'Plumbing', description: 'Plumbing services' });

    // Accounts are seeded directly (registration is covered by auth tests); every
    // business step below goes through the real REST API.
    A.admin = await Customer.create({ name: 'Admin', phone: '9000000001', role: 'ADMIN', isVerified: true });
    A.customer = await Customer.create({ name: 'Cust One', phone: '9000000002', role: 'CUSTOMER', isVerified: true, wallet: { balance: 5000 } });
    A.customer2 = await Customer.create({ name: 'Cust Two', phone: '9000000003', role: 'CUSTOMER', isVerified: true, wallet: { balance: 5000 } });
    A.worker = await Customer.create({ name: 'Worker One', phone: '9000000004', role: 'WORKER', isVerified: false, wallet: { balance: 200 } });
    A.worker2 = await Customer.create({ name: 'Worker Two', phone: '9000000005', role: 'WORKER', isVerified: false, wallet: { balance: 200 } });
    A.shopOwner = await Customer.create({ name: 'Shop Owner', phone: '9000000006', role: 'SHOP', isVerified: true });
    A.shop = await Shop.create({
        ownerId: A.shopOwner._id, name: 'Kirana Live', address: 'Andheri, Mumbai',
        location: { type: 'Point', coordinates: JOB_COORDS },
        kyc: { status: 'APPROVED', documents: [] }, isOnline: true
    });

    for (const k of ['admin', 'customer', 'customer2', 'worker', 'worker2', 'shopOwner']) A[`${k}Token`] = sign(A[k]);

    A.adminSock = await connect(A.adminToken);
    A.custSock = await connect(A.customerToken);
    A.cust2Sock = await connect(A.customer2Token);
    A.workerSock = await connect(A.workerToken);
    A.worker2Sock = await connect(A.worker2Token);
    A.shopSock = await connect(A.shopOwnerToken);
    await sleep(300); // shop_<shopId> room join is an async DB lookup
}, 120000);

afterAll(async () => {
    for (const s of sockets) { try { s.disconnect(); } catch (_) {} }
    try { getIO()?.close(); } catch (_) {}
    await new Promise(r => server ? server.close(() => r()) : r());
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
}, 30000);

// ═════════════════════════════════════════════════════════════════════════════
// 0. Socket wiring sanity
// ═════════════════════════════════════════════════════════════════════════════
describe('0. Socket auth & rooms', () => {
    test('rejects a socket without a JWT', async () => {
        await expect(connect(undefined)).rejects.toThrow(/Authentication required/);
    });

    test('rejects a socket with a forged JWT', async () => {
        const forged = jwt.sign({ id: A.customer._id, role: 'ADMIN' }, 'wrong-secret');
        await expect(connect(forged)).rejects.toThrow(/Invalid token/);
    });

    test('server put each role in the right rooms', async () => {
        const io = getIO();
        const roomsOf = (userId) => {
            for (const s of io.sockets.sockets.values()) if (String(s.userId) === String(userId)) return [...s.rooms];
            return [];
        };
        expect(roomsOf(A.admin._id)).toEqual(expect.arrayContaining([`user_${A.admin._id}`, 'admin_dashboard']));
        expect(roomsOf(A.customer._id)).toEqual(expect.arrayContaining([`user_${A.customer._id}`, `customer_${A.customer._id}`]));
        expect(roomsOf(A.customer._id)).not.toContain('admin_dashboard');
        expect(roomsOf(A.worker._id)).toEqual(expect.arrayContaining([`worker_${A.worker._id}`]));
        expect(roomsOf(A.shopOwner._id)).toEqual(expect.arrayContaining([`shop_${A.shopOwner._id}`, `shop_${A.shop._id}`]));
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. Service job — full lifecycle with live sync
// ═════════════════════════════════════════════════════════════════════════════
describe('1. Service job flow', () => {
    const QUOTE = 800;
    // Default serviceJobFee: TIERED, threshold 500, 12% above, GST 18%
    const FEE = round2(QUOTE * 0.12);       // 96
    const GST = round2(FEE * 0.18);         // 17.28
    const TOTAL = round2(QUOTE + FEE + GST); // 913.28

    test('1.1 worker onboards via API (profile, services, bank, location, KYC doc)', async () => {
        const t = A.workerToken;
        let r = await api().patch('/api/v1/workers/me/profile').set(auth(t)).send({ city: 'Mumbai', bio: 'Plumber' });
        expect(r.status).toBe(200);
        r = await api().patch('/api/v1/workers/me/services').set(auth(t)).send({
            services: [{ category: String(S.category._id), categoryName: 'Plumbing', subcategories: ['Pipe Repair'], isActive: true }]
        });
        expect(r.status).toBe(200);
        r = await api().patch('/api/v1/workers/me/bank').set(auth(t)).send({ bankDetails: { accountNumber: '1234567890', ifscCode: 'HDFC0001234', bankName: 'HDFC' }, upiId: 'w1@upi' });
        expect(r.status).toBe(200);
        r = await api().patch('/api/v1/workers/me/location').set(auth(t)).send({ coordinates: WORKER_HOME, city: 'Mumbai', radius: 10 });
        expect(r.status).toBe(200);

        // Cannot go online before KYC approval
        r = await api().patch('/api/v1/workers/me/online').set(auth(t)).send({ isOnline: true });
        expect(r.status).toBe(403);

        r = await api().patch('/api/v1/workers/me/kyc').set(auth(t)).send({ documentType: 'AADHAR', documentUrl: 'https://example.com/aadhar.jpg' });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe('PENDING');
    });

    test('1.2 admin approves KYC → worker gets NEW_NOTIFICATION, admin gets DASHBOARD_UPDATE', async () => {
        const r = await api().patch(`/api/v1/admin/workers/${A.worker._id}/kyc`).set(auth(A.adminToken)).send({ status: 'APPROVED' });
        expect(r.status).toBe(200);
        const n = await waitFor(A.workerSock, 'NEW_NOTIFICATION', d => d.action === 'KYC');
        expect(n.message).toMatch(/approved/i);
        await waitFor(A.adminSock, 'DASHBOARD_UPDATE');
        // KYC notification is targeted: no other user saw it
        expect(has(A.worker2Sock, 'NEW_NOTIFICATION', d => d.action === 'KYC')).toBe(false);
        expect(has(A.custSock, 'NEW_NOTIFICATION', d => d.action === 'KYC')).toBe(false);
    });

    test('1.3 worker goes online', async () => {
        const r = await api().patch('/api/v1/workers/me/online').set(auth(A.workerToken)).send({ isOnline: true });
        expect(r.status).toBe(200);
        expect(r.body.data.isOnline).toBe(true);
    });

    test('1.4 customer creates job → nearby worker gets NEW_JOB_ALERT, admin gets DASHBOARD_UPDATE(NEW_JOB)', async () => {
        const r = await api().post('/api/v1/jobs').set(auth(A.customerToken)).send({
            category: 'Plumbing', subcategory: 'Pipe Repair', description: 'Kitchen pipe leaking',
            location: { type: 'Point', coordinates: JOB_COORDS },
            addressDetails: { city: 'Mumbai', fullAddress: '12 MG Road, Mumbai' }, timeSlot: 'urgent'
        });
        expect(r.status).toBe(201);
        S.jobId = r.body.data._id;

        const alert = await waitFor(A.workerSock, 'NEW_JOB_ALERT', d => sameId(d.jobId, S.jobId));
        expect(alert.category).toBe('Plumbing');
        const dash = await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'NEW_JOB' && sameId(d.id, S.jobId));
        expect(dash.notifiedWorkers).toBe(1);
        // Offline / unapproved worker2 must not be alerted
        expect(has(A.worker2Sock, 'NEW_JOB_ALERT', d => sameId(d.jobId, S.jobId))).toBe(false);
        // Customer gets their own "job posted" notification
        await waitFor(A.custSock, 'NEW_NOTIFICATION', d => d.action === 'JOB_CREATED');
    });

    test('1.5 admin dashboard stats + jobs list reflect the new job', async () => {
        const stats = await api().get('/api/v1/admin/stats?range=week').set(auth(A.adminToken));
        expect(stats.status).toBe(200);
        expect(stats.body.data.activeJobs).toBe(1);
        expect(stats.body.data.totalRevenue).toBe(0);

        const list = await api().get('/api/v1/admin/jobs/all').set(auth(A.adminToken));
        expect(list.status).toBe(200);
        const job = list.body.data.jobs.find(j => j._id === S.jobId);
        expect(job).toBeDefined();
        expect(job.status).toBe('BROADCASTING');
    });

    test('1.6 worker places quote → customer gets NEW_QUOTE', async () => {
        const r = await api().post('/api/v1/quotes').set(auth(A.workerToken)).send({
            jobId: S.jobId, amount: QUOTE, description: 'Fix in 30 mins', workerLocation: { type: 'Point', coordinates: WORKER_HOME }
        });
        expect(r.status).toBe(201);
        S.quoteId = r.body.data._id;
        const q = await waitFor(A.custSock, 'NEW_QUOTE', d => sameId(d.quoteId, S.quoteId));
        expect(q.amount).toBe(QUOTE);
        expect(has(A.cust2Sock, 'NEW_QUOTE')).toBe(false);
    });

    test('1.7 customer sees quote with server-computed fee breakdown', async () => {
        const r = await api().get(`/api/v1/quotes/job/${S.jobId}`).set(auth(A.customerToken));
        expect(r.status).toBe(200);
        const q = r.body.data.find(x => x._id === S.quoteId);
        expect(q.platformFee).toBe(FEE);
        expect(q.gst).toBe(GST);
        expect(q.customerPayable).toBe(TOTAL);
    });

    test('1.8 customer accepts quote → worker gets QUOTE_ACCEPTED, admin gets DASHBOARD_UPDATE(QUOTE_ACCEPTED)', async () => {
        const r = await api().patch(`/api/v1/quotes/${S.quoteId}/accept`).set(auth(A.customerToken));
        expect(r.status).toBe(200);
        expect(r.body.data.job.status).toBe('ALLOCATED');
        expect(r.body.data.job.payment.amount).toBe(TOTAL);
        S.acceptedEvent = await waitFor(A.workerSock, 'QUOTE_ACCEPTED', d => sameId(d.jobId, S.jobId));
        await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'QUOTE_ACCEPTED' && sameId(d.id, S.jobId));
        await waitFor(A.custSock, 'NEW_NOTIFICATION', d => d.action === 'JOB_UPDATED' && sameId(d.entityId, S.jobId));
    });

    // Regression (fixed): the arrival OTP is the customer's proof that the worker is on site
    // (customer app shows it, worker app types it into /start). Sending it to the
    // worker lets the worker start the job without ever meeting the customer.
    test('1.8b QUOTE_ACCEPTED event to worker must not carry the arrival OTP', () => {
        expect(S.acceptedEvent.arrivalOtp).toBeUndefined();
    });

    test('1.8c worker GET /jobs/:id must not expose security.arrivalOtp', async () => {
        const r = await api().get(`/api/v1/jobs/${S.jobId}`).set(auth(A.workerToken));
        expect(r.status).toBe(200);
        expect(r.body.data.security?.arrivalOtp).toBeUndefined();
    });

    // Regression (fixed): the dashboard re-fetches /admin/stats on DASHBOARD_UPDATE, but quote
    // acceptance (which sets payment.amount used for totalRevenue) does not
    // invalidate the stats cache, so the admin sees stale numbers for 5 min.
    test('1.9 admin stats reflect accepted-job revenue right after DASHBOARD_UPDATE', async () => {
        const stats = await api().get('/api/v1/admin/stats?range=week').set(auth(A.adminToken));
        expect(stats.body.data.totalRevenue).toBe(TOTAL);
    });

    test('1.10 WORKER_LOCATION_UPDATE from the assigned worker reaches the customer', async () => {
        A.workerSock.emit('WORKER_LOCATION_UPDATE', { jobId: S.jobId, coords: { lat: 19.077, lng: 72.879 } });
        const loc = await waitFor(A.custSock, 'WORKER_LOCATION', d => sameId(d.jobId, S.jobId));
        expect(loc.coords.lat).toBe(19.077);
    });

    test('1.11 worker marks arriving → customer gets JOB_STATUS_CHANGED', async () => {
        const r = await api().post(`/api/v1/jobs/${S.jobId}/arrive`).set(auth(A.workerToken));
        expect(r.status).toBe(200);
        const e = await waitFor(A.custSock, 'JOB_STATUS_CHANGED', d => sameId(d.jobId, S.jobId) && d.status === 'ARRIVING');
        expect(e.status).toBe('ARRIVING');
    });

    // Regression (fixed): getStats counts active jobs with a status list that omits ARRIVING,
    // so a job disappears from "Active Jobs" while the worker is en route.
    test('1.11b admin activeJobs still counts a job in ARRIVING state', async () => {
        const stats = await api().get('/api/v1/admin/stats?range=all').set(auth(A.adminToken));
        expect(stats.body.data.activeJobs).toBe(1);
    });

    test('1.12 start with wrong arrival OTP is refused; correct OTP + geofence starts the job', async () => {
        let r = await api().post(`/api/v1/jobs/${S.jobId}/start`).set(auth(A.workerToken)).send({ arrivalOtp: '0000', currentCoordinates: AT_JOB });
        expect(r.status).toBe(400);

        // Customer reads the OTP from their job view and tells the worker
        const view = await api().get(`/api/v1/jobs/${S.jobId}`).set(auth(A.customerToken));
        const otp = view.body.data.security.arrivalOtp;
        expect(otp).toMatch(/^\d{4}$/);

        // Outside the 200 m geofence
        r = await api().post(`/api/v1/jobs/${S.jobId}/start`).set(auth(A.workerToken)).send({ arrivalOtp: otp, currentCoordinates: [72.90, 19.10] });
        expect(r.status).toBe(403);

        r = await api().post(`/api/v1/jobs/${S.jobId}/start`).set(auth(A.workerToken)).send({ arrivalOtp: otp, currentCoordinates: AT_JOB });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe('IN_PROGRESS');
        await waitFor(A.custSock, 'JOB_STARTED', d => sameId(d.jobId, S.jobId));
        await waitFor(A.workerSock, 'START_TIMER', d => sameId(d.jobId, S.jobId));
    });

    test('1.13 worker completes → customer gets JOB_COMPLETED; location tracking stops', async () => {
        const wv = await api().get(`/api/v1/jobs/${S.jobId}`).set(auth(A.workerToken));
        S.completionOtp = wv.body.data.security.completionOtp; // worker shows this to the customer
        expect(S.completionOtp).toMatch(/^\d{4}$/);

        const r = await api().post(`/api/v1/jobs/${S.jobId}/complete`).set(auth(A.workerToken)).send({ report: 'Replaced pipe' });
        expect(r.status).toBe(200);
        await waitFor(A.custSock, 'JOB_COMPLETED', d => sameId(d.jobId, S.jobId));

        const before = eventsOf(A.custSock, 'WORKER_LOCATION').length;
        A.workerSock.emit('WORKER_LOCATION_UPDATE', { jobId: S.jobId, coords: { lat: 1, lng: 1 } });
        await sleep(300);
        expect(eventsOf(A.custSock, 'WORKER_LOCATION').length).toBe(before);
    });

    test('1.14 wrong completion OTP is refused and leaves the job COMPLETED', async () => {
        const r = await api().post(`/api/v1/jobs/${S.jobId}/pay`).set(auth(A.customerToken)).send({ method: 'WALLET', completionOtp: '0000' });
        expect(r.status).toBe(400);
        expect((await Job.findById(S.jobId)).status).toBe('COMPLETED');
    });

    test('1.15 customer pays from wallet → job PAID, worker gets JOB_PAID + WALLET_CREDITED, admin gets DASHBOARD_UPDATE(JOB_SETTLED)', async () => {
        const r = await api().post(`/api/v1/jobs/${S.jobId}/pay`).set(auth(A.customerToken)).send({ method: 'WALLET', completionOtp: S.completionOtp });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe('PAID');

        await waitFor(A.workerSock, 'JOB_PAID', d => sameId(d.jobId, S.jobId));
        const credited = await waitFor(A.workerSock, 'WALLET_CREDITED', d => sameId(d.jobId, S.jobId));
        expect(credited.amount).toBe(QUOTE);
        const settled = await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'JOB_SETTLED' && sameId(d.jobId, S.jobId));
        expect(settled.workerEarnings).toBe(QUOTE);
        expect(settled.platformFee).toBe(FEE);
        expect(settled.gstAmount).toBe(GST);
    });

    test('1.16 money: worker +100% of quote, customer −(quote + fee + 18% GST on fee), ledger entry correct', async () => {
        const worker = await Customer.findById(A.worker._id).lean();
        const customer = await Customer.findById(A.customer._id).lean();
        expect(worker.wallet.balance).toBe(200 + QUOTE);
        expect(customer.wallet.balance).toBeCloseTo(5000 - TOTAL, 2);

        const ledger = await PlatformLedger.findOne({ entityType: 'SERVICE_JOB', entityId: S.jobId }).lean();
        expect(ledger.partnerAmount).toBe(QUOTE);
        expect(ledger.platformFee).toBe(FEE);
        expect(ledger.gstAmount).toBe(GST);
        expect(ledger.grossAmount).toBe(TOTAL);

        const custTxn = await WalletTxn.findOne({ userId: A.customer._id, type: 'JOB_PAYMENT', refId: S.jobId }).lean();
        expect(custTxn.amount).toBe(TOTAL);
        const workerTxn = await WalletTxn.findOne({ userId: A.worker._id, type: 'JOB_CREDIT', refId: S.jobId }).lean();
        expect(workerTxn.amount).toBe(QUOTE);
    });

    // Regression (fixed): payJob (wallet path) credits the treasury twice — settleJobCompletion
    // adds platformFee to AdminWallet, then collectPlatformFee adds fee+GST again.
    test('1.17 treasury is credited exactly once for the job (admin wallet = platform fee)', async () => {
        const txns = await AdminWalletTxn.find({ referenceId: S.jobId, type: 'PLATFORM_FEE_COLLECTED' }).lean();
        expect(txns).toHaveLength(1);
        const aw = await AdminWallet.findOne().lean();
        expect(aw.balance).toBe(FEE);
    });

    test('1.18 admin jobs list + ledger + treasury show the paid job', async () => {
        const list = await api().get('/api/v1/admin/jobs/all?status=PAID').set(auth(A.adminToken));
        const job = list.body.data.jobs.find(j => j._id === S.jobId);
        expect(job).toBeDefined();
        expect(job.payment.amount).toBe(TOTAL);
        expect(job.payment.workerPayout).toBe(QUOTE);
        expect(job.payment.status).toBe('PAID');

        const ledger = await api().get('/api/v1/admin/ledger').set(auth(A.adminToken));
        expect(ledger.status).toBe(200);
        const types = ledger.body.data.transactions.map(t => t.type);
        expect(types).toEqual(expect.arrayContaining(['JOB_PAYMENT', 'JOB_CREDIT']));

        const treasury = await api().get('/api/v1/ledger/treasury-summary').set(auth(A.adminToken));
        expect(treasury.status).toBe(200);
        expect(treasury.body.data.treasury.serviceJobPlatformFeeRevenue).toBe(FEE);
        expect(treasury.body.data.taxLiability.gstLiability).toBe(GST);
    });

    // Regression (fixed): payJob never invalidates admin_dashboard_stats_*, so the dashboard's
    // refetch on DASHBOARD_UPDATE(JOB_SETTLED) returns the cached pre-payment
    // snapshot (topWorkers empty).
    test('1.19 admin stats show the worker in topWorkers after payment', async () => {
        const stats = await api().get('/api/v1/admin/stats?range=week').set(auth(A.adminToken));
        expect(stats.body.data.topWorkers.map(w => w.name)).toContain('Worker One');
    });

    test('1.20 customer rates → job CLOSED, admin DASHBOARD_UPDATE(JOB_CLOSED), worker notified', async () => {
        const r = await api().post(`/api/v1/jobs/${S.jobId}/rate`).set(auth(A.customerToken)).send({ score: 5, review: 'Great' });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe('CLOSED');
        await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'JOB_CLOSED' && sameId(d.id, S.jobId));
        await waitFor(A.workerSock, 'NEW_NOTIFICATION', d => d.action === 'RATING_RECEIVED');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Shop order — cart → wallet order → delivery → settlement
// ═════════════════════════════════════════════════════════════════════════════
describe('2. Shop order flow', () => {
    const PRICE = 250;
    const DELIVERY = 40;                     // default deliveryCharge (subtotal < 1000)
    const FEE = round2(Math.max(PRICE * 0.05, 10)); // 12.5
    const GST = round2(FEE * 0.18);          // 2.25
    const TOTAL = round2(PRICE + DELIVERY + FEE + GST); // 304.75

    test('2.1 shop adds a product → admin gets admin-only NEW_NOTIFICATION, shop gets its own copy', async () => {
        const r = await api().post('/api/v1/products').set(auth(A.shopOwnerToken)).send({ name: 'Basmati Rice 5kg', price: PRICE, stock: 10, unit: 'Bag' });
        expect(r.status).toBe(201);
        S.productId = r.body.data._id;
        const adminN = await waitFor(A.adminSock, 'NEW_NOTIFICATION', d => d.entityType === 'PRODUCT' && d.targetRole === 'ADMIN');
        expect(adminN.type).toBe('ADMIN_ACTIVITY');
        await waitFor(A.shopSock, 'NEW_NOTIFICATION', d => d.entityType === 'PRODUCT' && d.targetRole === 'SHOP');
        await sleep(200);
        for (const s of [A.shopSock, A.custSock, A.workerSock]) {
            expect(has(s, 'NEW_NOTIFICATION', d => d.targetRole === 'ADMIN')).toBe(false);
        }
    });

    test('2.2 customer adds to cart and reads it back', async () => {
        let r = await api().post('/api/v1/cart').set(auth(A.customerToken)).send({ shopId: String(A.shop._id), productId: S.productId, qty: 1 });
        expect([200, 201]).toContain(r.status);
        r = await api().get('/api/v1/cart').set(auth(A.customerToken));
        expect(r.status).toBe(200);
        S.cart = r.body.data;
        expect(S.cart.items).toHaveLength(1);
        expect(S.cart.subtotal).toBe(PRICE);
        expect(S.cart.deliveryCharge).toBe(DELIVERY);
    });

    test('2.3 customer places WALLET order from cart → shop gets NEW_ORDER, admin gets DASHBOARD_UPDATE(NEW_SHOP_ORDER)', async () => {
        S.custBalanceBefore = (await Customer.findById(A.customer._id).lean()).wallet.balance;
        const items = S.cart.items.map(i => ({ productId: idOf(i.productId), name: i.name, price: 1, qty: i.qty })); // price is re-read server-side
        const r = await api().post('/api/v1/shoporders').set(auth(A.customerToken)).send({
            shopId: String(A.shop._id), items, deliveryAddress: '12 MG Road, Mumbai', paymentMethod: 'WALLET',
            deliveryLocation: { type: 'Point', coordinates: JOB_COORDS }
        });
        expect(r.status).toBe(201);
        S.orderId = r.body.data._id;
        expect(r.body.data.subtotal).toBe(PRICE);
        expect(r.body.data.platformFee).toBe(FEE);
        expect(r.body.data.gstAmount).toBe(GST);
        expect(r.body.data.total).toBe(TOTAL);
        expect(r.body.data.payment.status).toBe('PAID');

        const n = await waitFor(A.shopSock, 'NEW_ORDER', d => sameId(d.orderId, S.orderId));
        expect(n.total).toBe(TOTAL);
        await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'NEW_SHOP_ORDER' && sameId(d.id, S.orderId));
        expect(has(A.custSock, 'NEW_ORDER')).toBe(false);

        const cust = await Customer.findById(A.customer._id).lean();
        expect(cust.wallet.balance).toBeCloseTo(S.custBalanceBefore - TOTAL, 2);
        expect((await Product.findById(S.productId).lean()).stock).toBe(9);
    });

    test('2.4 shop sees the order in its list; admin sees it in all orders', async () => {
        const shopList = await api().get('/api/v1/shoporders/shop').set(auth(A.shopOwnerToken));
        expect(shopList.status).toBe(200);
        expect(shopList.body.data.orders.map(o => o._id)).toContain(S.orderId);

        const all = await api().get('/api/v1/shoporders/all').set(auth(A.adminToken));
        expect(all.status).toBe(200);
        const flat = JSON.stringify(all.body.data);
        expect(flat).toContain(S.orderId);
    });

    // Regression (fixed): the delivery OTP is the customer's proof of hand-over, but the shop
    // receives it (GET order + shop app shows it), so a shop can mark an order
    // DELIVERED — and trigger settlement — without the customer.
    test('2.4b shop must not be able to read the customer delivery OTP', async () => {
        const r = await api().get(`/api/v1/shoporders/${S.orderId}`).set(auth(A.shopOwnerToken));
        expect(r.status).toBe(200);
        expect(r.body.data.deliveryOtp).toBeUndefined();
    });

    test('2.5 shop adds delivery staff', async () => {
        const r = await api().post('/api/v1/delivery-staff').set(auth(A.shopOwnerToken)).send({ name: 'Raju Rider', phone: '9811111111' });
        expect(r.status).toBe(201);
        S.staff = r.body.data;
    });

    test('2.6 shop accepts → packs → out for delivery; customer gets ORDER_STATUS each time, admin DASHBOARD_UPDATE each time', async () => {
        for (const status of ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY']) {
            const body = { status };
            if (status === 'OUT_FOR_DELIVERY') Object.assign(body, { deliveryStaffId: S.staff._id, deliveryStaffName: S.staff.name, deliveryStaffPhone: S.staff.phone });
            const r = await api().patch(`/api/v1/shoporders/${S.orderId}/status`).set(auth(A.shopOwnerToken)).send(body);
            expect(r.status).toBe(200);
            expect(r.body.data.status).toBe(status);
            await waitFor(A.custSock, 'ORDER_STATUS', d => sameId(d.orderId, S.orderId) && d.status === status);
        }
        // DASHBOARD_UPDATE goes out just after the stats cache is cleared, so allow it a moment.
        const dashCount = () => eventsOf(A.adminSock, 'DASHBOARD_UPDATE').filter(d => d.type === 'ORDER_STATUS_CHANGED' && sameId(d.id, S.orderId)).length;
        for (let i = 0; i < 20 && dashCount() < 3; i++) await sleep(50);
        expect(dashCount()).toBeGreaterThanOrEqual(3);
    });

    // Regression (fixed): ShopOrder has deliveryStaffName/Phone and the customer app renders them,
    // but no route can set them — updateOrderStatus' validator strips the fields.
    test('2.6b assigning delivery staff is persisted on the order', async () => {
        const o = await ShopOrder.findById(S.orderId).lean();
        expect(o.deliveryStaffName).toBe('Raju Rider');
    });

    test('2.7 wrong delivery OTP refused; correct OTP delivers → customer ORDER_STATUS(DELIVERED), admin ORDER_SETTLED', async () => {
        let r = await api().patch(`/api/v1/shoporders/${S.orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'DELIVERED', otp: '0000' });
        expect(r.status).toBe(400);

        const view = await api().get(`/api/v1/shoporders/${S.orderId}`).set(auth(A.customerToken));
        const otp = view.body.data.deliveryOtp;
        S.shopBalanceBefore = (await Shop.findById(A.shop._id).lean()).wallet.balance;

        r = await api().patch(`/api/v1/shoporders/${S.orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'DELIVERED', otp });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe('DELIVERED');
        await waitFor(A.custSock, 'ORDER_STATUS', d => sameId(d.orderId, S.orderId) && d.status === 'DELIVERED');
        const settled = await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'ORDER_SETTLED' && sameId(d.orderId, S.orderId));
        expect(settled.platformFee).toBe(FEE);
        expect(settled.gstAmount).toBe(GST);
        S.shopCredited = await waitFor(A.shopSock, 'WALLET_CREDITED', d => sameId(d.orderId, S.orderId));
    });

    test('2.8 settlement: shop keeps 100% of products (+ delivery), ledger/treasury record fee + GST', async () => {
        const shop = await Shop.findById(A.shop._id).lean();
        expect(shop.wallet.balance).toBe(S.shopBalanceBefore + PRICE + DELIVERY);

        const ledger = await PlatformLedger.findOne({ entityType: 'SHOP_ORDER', entityId: S.orderId }).lean();
        expect(ledger.partnerAmount).toBe(PRICE);
        expect(ledger.deliveryFee).toBe(DELIVERY);
        expect(ledger.platformFee).toBe(FEE);
        expect(ledger.gstAmount).toBe(GST);
        expect(ledger.grossAmount).toBe(TOTAL);

        const treasury = await api().get('/api/v1/ledger/treasury-summary').set(auth(A.adminToken));
        expect(treasury.body.data.treasury.shopOrderPlatformFeeRevenue).toBe(FEE);

        const order = await api().get(`/api/v1/shoporders/${S.orderId}`).set(auth(A.adminToken));
        expect(order.body.data.payment.escrowStatus).toBe('SETTLED');
    });

    // Regression (fixed): WALLET_CREDITED to the shop reports netProductSales (250) while the
    // wallet was actually credited netProductSales + deliveryFee (290).
    test('2.8b shop WALLET_CREDITED amount equals the actual wallet credit', () => {
        expect(S.shopCredited.amount).toBe(PRICE + DELIVERY);
    });

    // Regression (fixed): the delivery OTP is generated at order placement with a 5-minute TTL
    // and there is no endpoint to regenerate it, so any real delivery that takes
    // longer than 5 minutes can never be marked DELIVERED (and never settles).
    test('2.9 an order delivered 30 min after placement can still be completed with the customer OTP', async () => {
        const items = [{ productId: S.productId, name: 'Basmati Rice 5kg', price: PRICE, qty: 1 }];
        const r = await api().post('/api/v1/shoporders').set(auth(A.customerToken)).send({
            shopId: String(A.shop._id), items, deliveryAddress: '12 MG Road, Mumbai', paymentMethod: 'WALLET', deliveryLocation: { type: 'Point', coordinates: JOB_COORDS }
        });
        expect(r.status).toBe(201);
        const orderId = r.body.data._id;
        for (const status of ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY']) {
            await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status });
        }
        const otp = (await api().get(`/api/v1/shoporders/${orderId}`).set(auth(A.customerToken))).body.data.deliveryOtp;
        const realNow = Date.now;
        const spy = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 30 * 60 * 1000);
        try {
            const d = await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'DELIVERED', otp });
            expect(d.body.message).toBe('Order status updated');
            expect(d.status).toBe(200);
        } finally {
            spy.mockRestore();
        }
    });

    test('2.10 delivered order frees the rider and counts the delivery', async () => {
        const staff = await DeliveryStaff.findById(S.staff._id).lean();
        expect(staff.activeOrderId).toBeUndefined();
        expect(staff.totalDeliveries).toBe(1);
    });

    test('2.11 customer can issue a new delivery OTP after wrong attempts lock it; shop cannot', async () => {
        const items = [{ productId: S.productId, name: 'Basmati Rice 5kg', price: PRICE, qty: 1 }];
        const r = await api().post('/api/v1/shoporders').set(auth(A.customerToken)).send({
            shopId: String(A.shop._id), items, deliveryAddress: '12 MG Road, Mumbai', paymentMethod: 'WALLET', deliveryLocation: { type: 'Point', coordinates: JOB_COORDS }
        });
        const orderId = r.body.data._id;
        for (const status of ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY']) {
            await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status }).expect(200);
        }
        for (let i = 0; i < 5; i++) {
            await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'DELIVERED', otp: '0000' });
        }
        const oldOtp = (await ShopOrder.findById(orderId).lean()).deliveryOtp;
        const locked = await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'DELIVERED', otp: oldOtp });
        expect(locked.status).toBe(400);

        expect((await api().post(`/api/v1/shoporders/${orderId}/delivery-otp`).set(auth(A.shopOwnerToken))).status).toBe(403);
        const fresh = await api().post(`/api/v1/shoporders/${orderId}/delivery-otp`).set(auth(A.customerToken));
        expect(fresh.status).toBe(200);
        const d = await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'DELIVERED', otp: fresh.body.data.deliveryOtp });
        expect(d.status).toBe(200);
        expect(d.body.data.deliveryOtp).toBeUndefined();
    });

    test('2.12 a staff member from another shop cannot be assigned', async () => {
        const items = [{ productId: S.productId, name: 'Basmati Rice 5kg', price: PRICE, qty: 1 }];
        const r = await api().post('/api/v1/shoporders').set(auth(A.customerToken)).send({
            shopId: String(A.shop._id), items, deliveryAddress: '12 MG Road, Mumbai', paymentMethod: 'WALLET', deliveryLocation: { type: 'Point', coordinates: JOB_COORDS }
        });
        const orderId = r.body.data._id;
        for (const status of ['CONFIRMED', 'PACKING']) {
            await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status }).expect(200);
        }
        const foreign = await DeliveryStaff.create({ shopId: new mongoose.Types.ObjectId(), name: 'Other Rider' });
        const bad = await api().patch(`/api/v1/shoporders/${orderId}/status`).set(auth(A.shopOwnerToken)).send({ status: 'OUT_FOR_DELIVERY', deliveryStaffId: String(foreign._id) });
        expect(bad.status).toBe(404);
        expect((await ShopOrder.findById(orderId).lean()).status).toBe('PACKING');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Admin actions sync back to users
// ═════════════════════════════════════════════════════════════════════════════
describe('3. Admin actions sync back', () => {
    test('3.1 worker2 completes onboarding and uploads KYC; it is in the admin pending-KYC badge', async () => {
        const t = A.worker2Token;
        // worker2 sets its city only on the work location, not on the profile
        await api().patch('/api/v1/workers/me/services').set(auth(t)).send({
            services: [{ category: String(S.category._id), categoryName: 'Plumbing', subcategories: ['Pipe Repair'], isActive: true }]
        }).expect(200);
        await api().patch('/api/v1/workers/me/bank').set(auth(t)).send({ upiId: 'w2@upi' }).expect(200);
        await api().patch('/api/v1/workers/me/location').set(auth(t)).send({ coordinates: WORKER_HOME, city: 'Mumbai', radius: 10 }).expect(200);

        const dashBefore = eventsOf(A.adminSock, 'DASHBOARD_UPDATE').length;
        await api().patch('/api/v1/workers/me/kyc').set(auth(t)).send({ documentType: 'PAN', documentUrl: 'https://example.com/pan.jpg' }).expect(200);
        await sleep(200);
        expect(eventsOf(A.adminSock, 'DASHBOARD_UPDATE').length).toBeGreaterThan(dashBefore);
        const badges = await api().get('/api/v1/admin/badges').set(auth(A.adminToken)); // cached from here on
        expect(badges.body.data.kyc).toBe(1);
    });

    test('3.2 admin approves worker2 KYC → worker2 notified live, badge drops, worker2 can go online', async () => {
        const r = await api().patch(`/api/v1/admin/workers/${A.worker2._id}/kyc`).set(auth(A.adminToken)).send({ status: 'APPROVED' });
        expect(r.status).toBe(200);
        await waitFor(A.worker2Sock, 'NEW_NOTIFICATION', d => d.action === 'KYC');
        await waitFor(A.adminSock, 'NEW_NOTIFICATION', d => d.type === 'ADMIN_ACTIVITY' && d.entityType === 'KYC');

        const badges = await api().get('/api/v1/admin/badges').set(auth(A.adminToken));
        expect(badges.body.data.kyc).toBe(0);

        const on = await api().patch('/api/v1/workers/me/online').set(auth(A.worker2Token)).send({ isOnline: true });
        expect(on.status).toBe(200);
    });

    test('3.3 admin changes fee settings → /settings/public reflects it immediately; admin dashboard pinged', async () => {
        const pub0 = await api().get('/api/v1/settings/public');
        expect(pub0.body.data.serviceJobFee.mode).toBe('TIERED'); // warm the cache

        const dashBefore = eventsOf(A.adminSock, 'DASHBOARD_UPDATE').length;
        const r = await api().patch('/api/v1/settings').set(auth(A.adminToken)).send({ feeType: 'percentage', feePercentage: 10, feeMinAmount: 30 });
        expect(r.status).toBe(200);

        const pub = await api().get('/api/v1/settings/public');
        expect(pub.status).toBe(200);
        expect(pub.body.data.serviceJobFee.mode).toBe('PERCENTAGE');
        expect(pub.body.data.serviceJobFee.percentage).toBe(10);
        expect(pub.body.data.serviceJobFee.minFee).toBe(30);

        await sleep(200);
        expect(eventsOf(A.adminSock, 'DASHBOARD_UPDATE').length).toBeGreaterThan(dashBefore);
    });

    test('3.4 new fee is charged on the next quote immediately (server-side settings cache invalidated)', async () => {
        const job = await api().post('/api/v1/jobs').set(auth(A.customer2Token)).send({
            category: 'Plumbing', description: 'Tap', location: { type: 'Point', coordinates: JOB_COORDS },
            addressDetails: { city: 'Mumbai', fullAddress: 'Bandra' }
        });
        expect(job.status).toBe(201);
        S.feeJobId = job.body.data._id;
        const q = await api().post('/api/v1/quotes').set(auth(A.workerToken)).send({ jobId: S.feeJobId, amount: 1000 });
        expect(q.status).toBe(201);
        const list = await api().get(`/api/v1/quotes/job/${S.feeJobId}`).set(auth(A.customer2Token));
        expect(list.body.data[0].platformFee).toBe(100);   // 10% of 1000
        expect(list.body.data[0].gst).toBe(18);
        expect(list.body.data[0].customerPayable).toBe(1118);
        await api().patch(`/api/v1/jobs/${S.feeJobId}/cancel`).set(auth(A.customer2Token)).expect(200);
    });

    test('3.5 subscription plan update → workers and shops notified live, customers are not', async () => {
        const r = await api().patch('/api/v1/settings').set(auth(A.adminToken)).send({
            subscriptionPlans: [{ id: 'worker_monthly', name: 'Worker Monthly', price: 399, durationDays: 30, targetRole: 'WORKER' }]
        });
        expect(r.status).toBe(200);
        const isPlan = d => d.title === 'Subscription Plans Updated';
        await waitFor(A.workerSock, 'NEW_NOTIFICATION', isPlan);
        await waitFor(A.worker2Sock, 'NEW_NOTIFICATION', isPlan);
        await waitFor(A.shopSock, 'NEW_NOTIFICATION', isPlan);
        await sleep(200);
        expect(has(A.custSock, 'NEW_NOTIFICATION', isPlan)).toBe(false);
        expect(has(A.cust2Sock, 'NEW_NOTIFICATION', isPlan)).toBe(false);

        const pub = await api().get('/api/v1/settings/public');
        expect(pub.body.data.subscriptionPlans[0].price).toBe(399);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Negative / isolation checks
// ═════════════════════════════════════════════════════════════════════════════
describe('4. Isolation & negative checks', () => {
    test('4.1 job B: both approved+online workers in range get NEW_JOB_ALERT', async () => {
        const r = await api().post('/api/v1/jobs').set(auth(A.customerToken)).send({
            category: 'Plumbing', description: 'Bathroom leak', location: { type: 'Point', coordinates: JOB_COORDS },
            addressDetails: { city: 'Mumbai', fullAddress: '12 MG Road, Mumbai' }
        });
        expect(r.status).toBe(201);
        S.jobB = r.body.data._id;
        await waitFor(A.workerSock, 'NEW_JOB_ALERT', d => sameId(d.jobId, S.jobB));
    });

    // Regression (fixed): findEligibleWorkers filters on the worker's *profile* `city` field,
    // while /workers/me/location (and /me/addresses) store the work city in
    // activeLocation.addressDetails.city. A worker who set their work location
    // in Mumbai, inside radius, online and KYC-approved, never gets Mumbai jobs.
    test('4.1b worker whose work-location city matches (profile city unset) gets the alert', async () => {
        await waitFor(A.worker2Sock, 'NEW_JOB_ALERT', d => sameId(d.jobId, S.jobB), 2000);
    });

    test('4.2 both workers quote; another customer cannot list or accept those quotes', async () => {
        const q1 = await api().post('/api/v1/quotes').set(auth(A.workerToken)).send({ jobId: S.jobB, amount: 400 });
        expect(q1.status).toBe(201);
        S.quoteB1 = q1.body.data._id;
        const q2 = await api().post('/api/v1/quotes').set(auth(A.worker2Token)).send({ jobId: S.jobB, amount: 350 });
        expect(q2.status).toBe(201);
        S.quoteB2 = q2.body.data._id;

        const peek = await api().get(`/api/v1/quotes/job/${S.jobB}`).set(auth(A.customer2Token));
        expect(peek.status).toBe(403);
        const steal = await api().patch(`/api/v1/quotes/${S.quoteB1}/accept`).set(auth(A.customer2Token));
        expect(steal.status).toBe(403);
        // A worker cannot use customer routes either
        const wpeek = await api().get(`/api/v1/quotes/job/${S.jobB}`).set(auth(A.worker2Token));
        expect(wpeek.status).toBe(403);
        // Customer2 got no NEW_QUOTE for someone else's job
        expect(has(A.cust2Sock, 'NEW_QUOTE', d => sameId(d.jobId, S.jobB))).toBe(false);
    });

    test('4.3 owner accepts worker1 quote → worker2 gets JOB_TAKEN', async () => {
        const r = await api().patch(`/api/v1/quotes/${S.quoteB1}/accept`).set(auth(A.customerToken));
        expect(r.status).toBe(200);
        await waitFor(A.worker2Sock, 'JOB_TAKEN', d => sameId(d.jobId, S.jobB));
        expect(has(A.worker2Sock, 'QUOTE_ACCEPTED', d => sameId(d.jobId, S.jobB))).toBe(false);
        // second accept of the other quote is refused
        const again = await api().patch(`/api/v1/quotes/${S.quoteB2}/accept`).set(auth(A.customerToken));
        expect(again.status).toBe(409);
    });

    test('4.4 worker2 cannot act on worker1\'s job', async () => {
        expect((await api().post(`/api/v1/jobs/${S.jobB}/arrive`).set(auth(A.worker2Token))).status).toBe(404);
        expect((await api().post(`/api/v1/jobs/${S.jobB}/start`).set(auth(A.worker2Token)).send({ arrivalOtp: '1234', currentCoordinates: AT_JOB })).status).toBe(404);
        expect((await api().post(`/api/v1/jobs/${S.jobB}/complete`).set(auth(A.worker2Token)).send({})).status).toBe(404);
        expect((await api().get(`/api/v1/jobs/${S.jobB}`).set(auth(A.worker2Token))).status).toBe(403);
        expect([400, 409]).toContain((await api().post('/api/v1/quotes').set(auth(A.worker2Token)).send({ jobId: S.jobB, amount: 300 })).status);
        expect((await Job.findById(S.jobB)).workerId.toString()).toBe(String(A.worker._id));
    });

    // Regression (fixed): Express 5 leaves req.body undefined when a POST has no body; completeJob
    // (and payJob/rateJob) destructure req.body before anything else → 500.
    test('4.4b POST /jobs/:id/complete without a body is a 4xx, not a 500 crash', async () => {
        const r = await api().post(`/api/v1/jobs/${S.jobB}/complete`).set(auth(A.worker2Token));
        expect(r.status).toBeLessThan(500);
    });

    test('4.5 JOIN_JOB_ROOM is refused for non-participants', async () => {
        A.worker2Sock.emit('JOIN_JOB_ROOM', { jobId: S.jobB });
        A.cust2Sock.emit('JOIN_JOB_ROOM', { jobId: S.jobB });
        await waitFor(A.worker2Sock, 'ERROR', d => d.message === 'Access denied');
        await waitFor(A.cust2Sock, 'ERROR', d => d.message === 'Access denied');
        A.custSock.emit('JOIN_JOB_ROOM', { jobId: S.jobB });
        A.workerSock.emit('JOIN_JOB_ROOM', { jobId: S.jobB });
        await sleep(300);
        expect(has(A.custSock, 'ERROR')).toBe(false);
        expect(has(A.workerSock, 'ERROR')).toBe(false);
    });

    test('4.6 SEND_MESSAGE into a job room the sender has not joined is ignored; participants can chat', async () => {
        A.worker2Sock.emit('SEND_MESSAGE', { jobId: S.jobB, senderId: String(A.worker2._id), message: 'intruder', timestamp: Date.now() });
        A.cust2Sock.emit('SEND_MESSAGE', { jobId: S.jobB, senderId: String(A.customer2._id), message: 'intruder2', timestamp: Date.now() });
        // spoofed senderId from a participant is ignored too
        A.workerSock.emit('SEND_MESSAGE', { jobId: S.jobB, senderId: String(A.customer._id), message: 'spoof', timestamp: Date.now() });
        await sleep(400);
        expect(eventsOf(A.custSock, 'NEW_MESSAGE').filter(m => sameId(m.jobId, S.jobB))).toHaveLength(0);
        expect(eventsOf(A.workerSock, 'NEW_MESSAGE').filter(m => sameId(m.jobId, S.jobB))).toHaveLength(0);

        A.workerSock.emit('SEND_MESSAGE', { jobId: S.jobB, senderId: String(A.worker._id), message: '<b>On my way</b>', timestamp: Date.now() });
        const m = await waitFor(A.custSock, 'NEW_MESSAGE', d => sameId(d.jobId, S.jobB));
        expect(m.message).toBe('On my way');
        expect(m.senderRole).toBe('WORKER');
        await sleep(200);
        expect(has(A.worker2Sock, 'NEW_MESSAGE')).toBe(false);
        expect(has(A.cust2Sock, 'NEW_MESSAGE')).toBe(false);
    });

    test('4.7 WORKER_LOCATION_UPDATE from a non-assigned worker is ignored', async () => {
        const before = eventsOf(A.custSock, 'WORKER_LOCATION').filter(d => sameId(d.jobId, S.jobB)).length;
        A.worker2Sock.emit('WORKER_LOCATION_UPDATE', { jobId: S.jobB, coords: { lat: 0, lng: 0 } });
        // a customer socket cannot inject locations either
        A.cust2Sock.emit('WORKER_LOCATION_UPDATE', { jobId: S.jobB, coords: { lat: 0, lng: 0 } });
        await sleep(400);
        expect(eventsOf(A.custSock, 'WORKER_LOCATION').filter(d => sameId(d.jobId, S.jobB)).length).toBe(before);

        A.workerSock.emit('WORKER_LOCATION_UPDATE', { jobId: S.jobB, coords: { lat: 19.08, lng: 72.88 } });
        const loc = await waitFor(A.custSock, 'WORKER_LOCATION', d => sameId(d.jobId, S.jobB) && d.coords.lat === 19.08);
        expect(loc.coords.lng).toBe(72.88);
        expect(has(A.cust2Sock, 'WORKER_LOCATION')).toBe(false);
    });

    test('4.8 customer cancels job B → assigned worker notified, admin DASHBOARD_UPDATE(JOB_CANCELLED), tracking revoked', async () => {
        const r = await api().patch(`/api/v1/jobs/${S.jobB}/cancel`).set(auth(A.customerToken)).send({ reason: 'Changed mind' });
        expect(r.status).toBe(200);
        await waitFor(A.workerSock, 'JOB_STATUS_CHANGED', d => sameId(d.jobId, S.jobB));
        await waitFor(A.adminSock, 'DASHBOARD_UPDATE', d => d.type === 'JOB_CANCELLED' && sameId(d.id, S.jobB));

        const before = eventsOf(A.custSock, 'WORKER_LOCATION').length;
        A.workerSock.emit('WORKER_LOCATION_UPDATE', { jobId: S.jobB, coords: { lat: 5, lng: 5 } });
        await sleep(300);
        expect(eventsOf(A.custSock, 'WORKER_LOCATION').length).toBe(before);
    });

    test('4.9 non-admin REST access to admin endpoints is refused', async () => {
        for (const t of [A.customerToken, A.workerToken, A.shopOwnerToken]) {
            expect((await api().get('/api/v1/admin/stats').set(auth(t))).status).toBe(403);
            expect((await api().patch('/api/v1/settings').set(auth(t)).send({ feePercentage: 1 })).status).toBe(403);
        }
    });

    test('4.10 across the whole run, no non-admin socket received an admin-only event', () => {
        const adminOnly = (e) => e.event === 'DASHBOARD_UPDATE' ||
            (e.event === 'NEW_NOTIFICATION' && (e.data?.targetRole === 'ADMIN' || e.data?.type === 'ADMIN_ACTIVITY'));
        for (const s of [A.custSock, A.cust2Sock, A.workerSock, A.worker2Sock, A.shopSock]) {
            expect(s.rec.filter(adminOnly)).toEqual([]);
        }
        expect(A.adminSock.rec.filter(e => e.event === 'DASHBOARD_UPDATE').length).toBeGreaterThan(5);
    });
});
