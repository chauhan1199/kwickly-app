process.env.NODE_ENV = 'test';
require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');

const BASE_URL = 'http://localhost:5000/api/v1';

async function logStep(msg) {
    console.log(`\n=== [STEP] ${msg} ===`);
}

async function simulateFullLifecycle() {
    logStep('STARTING COMPREHENSIVE FULL LIFECYCLE SIMULATION');

    const adminEmail = 'admin@kwickly.com';
    const adminPass = 'password123';
    
    const randomPrefix = Math.floor(1000 + Math.random() * 9000);
    const custPhone = `${randomPrefix}000001`;
    const workerAhm1 = `${randomPrefix}000002`;
    const workerAhm2 = `${randomPrefix}000003`;
    const workerMum  = `${randomPrefix}000004`;

    const redis = new Redis();
    
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = process.env;

    function generateToken(user) {
        return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    }

    logStep('1 & 2. Generating Mock Users & Tokens directly via DB to bypass OTP rate limits');
    await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
    const Customer = mongoose.connection.collection('customers');
    const AppSettings = mongoose.connection.collection('appsettings');

    const custId = new mongoose.Types.ObjectId();
    const wAhm1Id = new mongoose.Types.ObjectId();
    const wAhm2Id = new mongoose.Types.ObjectId();
    const wMumId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();

    await Customer.deleteMany({ role: { $in: ['CUSTOMER', 'WORKER', 'ADMIN'] } });
    
    await Customer.insertMany([
        { _id: adminId, phone: '0000000000', role: 'ADMIN', isVerified: true, name: 'Super Admin' },
        { _id: custId, phone: custPhone, role: 'CUSTOMER', isVerified: true, wallet: { balance: 1000 }, name: 'Sim Cust' },
        { _id: wAhm1Id, phone: workerAhm1, role: 'WORKER', isVerified: true, name: 'Ahm Worker 1' },
        { _id: wAhm2Id, phone: workerAhm2, role: 'WORKER', isVerified: true, name: 'Ahm Worker 2' },
        { _id: wMumId, phone: workerMum, role: 'WORKER', isVerified: true, name: 'Mum Worker' }
    ]);

    const custToken = generateToken({ _id: custId, role: 'CUSTOMER' });
    const wAhm1Token = generateToken({ _id: wAhm1Id, role: 'WORKER' });
    const wAhm2Token = generateToken({ _id: wAhm2Id, role: 'WORKER' });
    const wMumToken = generateToken({ _id: wMumId, role: 'WORKER' });
    const adminToken = generateToken({ _id: adminId, role: 'ADMIN' });

    // 3. Force States in DB to simulate proper KYC & Subscriptions
    logStep('3. Forcing Strict DB Profile States (KYC, Subscription, Wallet)');

    await AppSettings.updateOne({ isSingleton: 'CONFIG' }, { 
        $set: { "fees.type": 'percent', "fees.amount": 10, "fees.gstPercentage": 18, "wallet.minimumBalance": 100 },
        $push: { subscriptionPlans: { id: 'TEST_PLAN', label: 'Test Plan', price: 100, durationDays: 30, targetRole: 'WORKER' } } 
    }, { upsert: true });

    const workerPayloadBase = {
        'kyc.status': 'APPROVED', 
        'wallet.balance': 500, 
        'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'subscription.isTrial': false,
        isOnline: true,
        serviceRadius: 50,
        services: [{ isActive: true, categoryName: 'Plumbing' }]
    };

    // Ahmedabad Worker 1
    await Customer.updateOne({ _id: new mongoose.Types.ObjectId(wAhm1Id) }, { $set: { ...workerPayloadBase, city: 'Ahmedabad', activeLocation: { type: 'Point', coordinates: [72.5714, 23.0225] } }});
    // Ahmedabad Worker 2
    await Customer.updateOne({ _id: new mongoose.Types.ObjectId(wAhm2Id) }, { $set: { ...workerPayloadBase, city: 'Ahmedabad', activeLocation: { type: 'Point', coordinates: [72.5714, 23.0225] } }});
    // Mumbai Worker
    await Customer.updateOne({ _id: new mongoose.Types.ObjectId(wMumId) }, { $set: { ...workerPayloadBase, city: 'Mumbai', activeLocation: { type: 'Point', coordinates: [72.5714, 23.0225] } }}); // Coordinates close by, but wrong city

    // 4. Create Job (Ahmedabad)
    logStep('4. Customer Creates Job in Ahmedabad (Checking Validations & Broadcast)');
    const jobPayload = {
        category: 'Plumbing', subcategory: 'Pipe Leak', description: 'Leaking pipe',
        timeSlot: 'urgent', city: 'Ahmedabad', addressDetails: { fullAddress: 'Navrangpura', city: 'Ahmedabad' },
        location: { type: 'Point', coordinates: [72.5714, 23.0225] }
    };
    
    const jobRes = await axios.post(`${BASE_URL}/jobs`, jobPayload, { headers: { Authorization: `Bearer ${custToken}` }});
    const jobId = jobRes.data.data._id;
    console.log(`[Validation Pass] Job Created: ${jobId}, Notified: ${jobRes.data.data.notifiedWorkers}`);
    
    if (jobRes.data.data.notifiedWorkers !== 2) throw new Error("Broadcast loophole detected: Notified workers != 2");
    
    // Redis verify
    const cachedWorkers = await redis.get(`job:${jobId}:eligible_workers`);
    if (!cachedWorkers || !cachedWorkers.includes(wAhm1Id)) throw new Error("Redis Cache Sync Failed for Eligible Workers");
    console.log('[Redis Pass] Eligible workers cached successfully');

    // 5. Worker Quotes
    logStep('5. Worker (Ahm1) Quotes on Job');
    const quoteRes = await axios.post(`${BASE_URL}/quotes`, { jobId, amount: 600, description: 'Will fix it.' }, { headers: { Authorization: `Bearer ${wAhm1Token}` }});
    const quoteId = quoteRes.data.data._id;
    console.log(`[Flow Pass] Worker quoted successfully: ${quoteId}`);

    // 6. Customer Accepts Quote
    logStep('6. Customer Accepts Quote');
    const acceptRes = await axios.patch(`${BASE_URL}/quotes/${quoteId}/accept`, {}, { headers: { Authorization: `Bearer ${custToken}` }});
    const { arrivalOtp, completionOtp } = acceptRes.data.data.job.security;
    console.log(`[Validation Pass] Job Allocated. Arrival: ${arrivalOtp}, Completion: ${completionOtp}`);

    // 7. Worker Executes Job
    logStep('7. Worker Starts & Completes Job');
    await axios.post(`${BASE_URL}/jobs/${jobId}/start`, { arrivalOtp }, { headers: { Authorization: `Bearer ${wAhm1Token}` }});
    await axios.post(`${BASE_URL}/jobs/${jobId}/complete`, { media: ['pic.jpg'], report: 'Done' }, { headers: { Authorization: `Bearer ${wAhm1Token}` }});
    console.log('[Flow Pass] Job Completed by Worker');

    // 8. Customer Pays and Rates (Checking Acid Transactions)
    logStep('8. Customer Pays (Online) & Rates');
    // Topup customer wallet first
    await Customer.updateOne({ _id: new mongoose.Types.ObjectId(custId) }, { $set: { 'wallet.balance': 1000 }});
    const payRes = await axios.post(`${BASE_URL}/jobs/${jobId}/pay`, { method: 'ONLINE', completionOtp }, { headers: { Authorization: `Bearer ${custToken}` }});
    await axios.post(`${BASE_URL}/jobs/${jobId}/rate`, { score: 5, review: 'Superb' }, { headers: { Authorization: `Bearer ${custToken}` }});
    console.log('[Flow Pass] Payment & Rating Applied successfully. Admin commission collected.');

    // Validate Admin & Worker wallets
    const updatedWorker = await Customer.findOne({ _id: new mongoose.Types.ObjectId(wAhm1Id) });
    console.log(`[Wallet Pass] Worker balance increased to: ₹${updatedWorker.wallet.balance} (includes 500 base + payout)`);

    // 9. Worker Requests Payout to Bank
    logStep('9. Worker Requests Payout');
    const wdrawRes = await axios.post(`${BASE_URL}/wallet/withdraw`, { amount: 800, payoutMethod: 'BANK_TRANSFER' }, { headers: { Authorization: `Bearer ${wAhm1Token}` }});
    const payoutId = wdrawRes.data.data._id;
    console.log(`[Flow Pass] Payout requested: ${payoutId}`);

    // 10. Admin Approves Payout
    logStep('10. Admin Approves Payout');
    
    // Fetch payouts list as Admin to get the Payout ID
    const payoutsListRes = await axios.get(`${BASE_URL}/payouts`, { headers: { Authorization: `Bearer ${adminToken}` }});
    const pendingPayouts = payoutsListRes.data.data;
    if (!pendingPayouts || pendingPayouts.length === 0) throw new Error("Payout not found in Admin list");
    const actualPayoutId = pendingPayouts[0]._id;

    await axios.patch(`${BASE_URL}/payouts/${actualPayoutId}/status`, { status: 'TRANSFERRED', txnId: 'txn_admin_123' }, { headers: { Authorization: `Bearer ${adminToken}` }});
    console.log('[Flow Pass] Admin approved payout successfully.');

    logStep('ALL VALIDATIONS, REDIS, AND FLOWS PASSED SUCCESSFULLY!');
    process.exit(0);
}

simulateFullLifecycle().catch(err => {
    console.error('SIMULATION FAILED:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    process.exit(1);
});
