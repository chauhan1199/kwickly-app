const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Category = require('../modules/category/category.model');
const Job = require('../modules/job/job.model');
const Shop = require('../modules/shop/shop.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

const makeJob = (customerId, category, score) => Job.create({
    customerId,
    category,
    location: { type: 'Point', coordinates: [72.57, 23.02] },
    status: 'COMPLETED',
    ...(score ? { rating: { score, createdAt: new Date() } } : {})
});

describe('GET /api/v1/settings/public/stats', () => {
    it('returns zeros on an empty platform instead of made-up numbers', async () => {
        const res = await request(app).get('/api/v1/settings/public/stats');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ categories: 0, customers: 0, averageRating: 0, ratingCount: 0 });
    });

    it('counts real active categories, live customers and job ratings', async () => {
        await Category.create([
            { name: 'Plumbing' },
            { name: 'Cleaning' },
            { name: 'Hidden', active: false }
        ]);
        const c1 = await createTestUser({ role: 'CUSTOMER', phone: '9000000001', email: 'c1@test.com' });
        await createTestUser({ role: 'CUSTOMER', phone: '9000000002', email: 'c2@test.com' });
        await createTestUser({ role: 'CUSTOMER', phone: '9000000003', email: 'c3@test.com', isDeleted: true });
        await createTestUser({ role: 'WORKER', phone: '9000000004', email: 'w1@test.com' });

        await makeJob(c1._id, 'Plumbing', 5);
        await makeJob(c1._id, 'Plumbing', 4);
        await makeJob(c1._id, 'Cleaning', 4);
        await makeJob(c1._id, 'Cleaning'); // unrated — must not count

        const res = await request(app).get('/api/v1/settings/public/stats');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ categories: 2, customers: 2, averageRating: 4.3, ratingCount: 3 });
    });
});

describe('GET /api/v1/categories — real per-category ratings', () => {
    it('attaches average/count from rated jobs of exactly that category', async () => {
        await Category.create([{ name: 'Plumbing' }, { name: 'Home Cook' }, { name: 'Home Cleaning' }]);
        const c1 = await createTestUser({ role: 'CUSTOMER', phone: '9000000011', email: 'cc1@test.com' });
        await makeJob(c1._id, 'Plumbing', 5);
        await makeJob(c1._id, 'Plumbing', 3);
        await makeJob(c1._id, 'Home Cleaning', 4);

        const res = await request(app).get('/api/v1/categories');
        expect(res.status).toBe(200);
        const byName = Object.fromEntries(res.body.data.map(c => [c.name, c.rating]));
        expect(byName.Plumbing).toEqual({ average: 4, count: 2 });
        expect(byName['Home Cleaning']).toEqual({ average: 4, count: 1 });
        expect(byName['Home Cook']).toEqual({ average: 0, count: 0 });
    });
});

describe('GET /api/v1/shops — no invented distance/ETA', () => {
    it('returns null distanceFormatted/deliveryEstimate when the user location is unknown', async () => {
        const owner = await createTestUser({ role: 'SHOP', phone: '9000000021', email: 'shop1@test.com' });
        await Shop.create({
            ownerId: owner._id,
            name: 'Real Shop',
            category: 'Grocery',
            phone: '9000000021',
            address: 'Somewhere',
            location: { type: 'Point', coordinates: [72.57, 23.02] },
            kyc: { status: 'APPROVED' },
            isOnline: true
        });
        const customer = await createTestUser({ role: 'CUSTOMER', phone: '9000000022', email: 'shopc@test.com' });
        const res = await request(app).get('/api/v1/shops').set('Authorization', `Bearer ${generateToken(customer)}`);
        expect(res.status).toBe(200);
        const payload = res.body.data;
        const list = Array.isArray(payload) ? payload : (payload.shops || []);
        expect(list.length).toBe(1);
        list.forEach(s => {
            expect(s.distanceFormatted).toBeNull();
            expect(s.deliveryEstimate).toBeNull();
        });
    });
});

describe('GET /api/v1/quotes/job/:jobId — real worker job count', () => {
    it('attaches the worker\'s actual completed-job count', async () => {
        const Quote = require('../modules/quote/quote.model');
        const customer = await createTestUser({ role: 'CUSTOMER', phone: '9000000031', email: 'qc@test.com' });
        const worker = await createTestUser({ role: 'WORKER', phone: '9000000032', email: 'qw@test.com' });
        const openJob = await Job.create({
            customerId: customer._id, category: 'Plumbing', status: 'QUOTES_RECEIVED',
            location: { type: 'Point', coordinates: [72.57, 23.02] }
        });
        await Job.create([
            { customerId: customer._id, workerId: worker._id, category: 'Plumbing', status: 'COMPLETED', location: { type: 'Point', coordinates: [72.57, 23.02] } },
            { customerId: customer._id, workerId: worker._id, category: 'Plumbing', status: 'PAID', location: { type: 'Point', coordinates: [72.57, 23.02] } },
            { customerId: customer._id, workerId: worker._id, category: 'Plumbing', status: 'CANCELLED', location: { type: 'Point', coordinates: [72.57, 23.02] } }
        ]);
        await Quote.create({ jobId: openJob._id, workerId: worker._id, amount: 400 });

        const res = await request(app)
            .get(`/api/v1/quotes/job/${openJob._id}`)
            .set('Authorization', `Bearer ${generateToken(customer)}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].workerId.completedJobs).toBe(2);
        expect(res.body.data[0].timeToReach).toBeUndefined();
    });
});
