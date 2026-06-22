const axios = require('axios');
const { io } = require('socket.io-client');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000/api/v1';
const SOCKET_URL = 'http://localhost:5000';

const generatePhone = () => `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runE2ETest() {
    console.log('🚀 Starting Kwickly Platform Complete E2E Flow Test...\n');

    try {
        // --- 1. Registration & Auth ---
        console.log('--- 1. Authentication ---');
        const customerPhone = generatePhone();
        const workerPhone = generatePhone();

        console.log(`👤 Customer Phone: ${customerPhone}`);
        console.log(`👷 Worker Phone: ${workerPhone}`);

        // Get OTP from Redis manually since we don't have SMS delivery in test
        const Redis = require('ioredis');
        const redis = new Redis();

        // Register Customer
        await axios.post(`${BASE_URL}/auth/send-otp`, { phone: customerPhone, role: 'CUSTOMER' });
        // Give Redis a tiny moment
        await delay(500);
        let customerOtp = await redis.get(`otp:${customerPhone}`) || '4729';
        // Fallback to static dev OTP in case redis pull misses
        const customerAuthRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: customerPhone, code: String(customerOtp).replace(/['"]+/g, ''), role: 'CUSTOMER' });
        const customerToken = customerAuthRes.data.data.token;
        const customerId = customerAuthRes.data.data.user._id;
        console.log('✅ Customer authenticated');

        // Complete Customer Profile
        await axios.put(`${BASE_URL}/customers/me/profile`, { name: 'E2E Customer Test', email: `cust_${Date.now()}@test.com` }, { headers: { Authorization: `Bearer ${customerToken}` } });

        // Register Worker
        await axios.post(`${BASE_URL}/auth/send-otp`, { phone: workerPhone, role: 'WORKER' });
        await delay(500);
        let workerOtp = await redis.get(`otp:${workerPhone}`) || '4729';
        const workerAuthRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: workerPhone, code: String(workerOtp).replace(/['"]+/g, ''), role: 'WORKER' });
        const workerToken = workerAuthRes.data.data.token;
        const workerId = workerAuthRes.data.data.user._id;
        console.log('✅ Worker authenticated');

        // Complete Worker Profile & Approve KYC + Subscribe + Add Funds via Mongo directly to bypass manual admin steps
        const mongoose = require('mongoose');
        // use port 27018 since we remapped it for the replica set
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/kwickly');
        const Customer = require('../src/modules/customer/customer.model');

        await Customer.findByIdAndUpdate(workerId, {
            name: 'E2E Worker Test',
            email: `worker_${Date.now()}@test.com`,
            category: 'Plumber',
            kyc: { status: 'APPROVED', documents: [] },
            'subscription.isTrial': true,
            'wallet.balance': 500, // min balance to quote
            activeLocation: { type: 'Point', coordinates: [77.2090, 28.6139] }
        });

        // flush redis session cache for the worker so they get the updated KYC status
        await redis.del(`session:${workerId}`);
        console.log('✅ Worker profile completed, KYC approved, and Wallet funded');

        // --- 2. WebSocket Connections ---
        console.log('\n--- 2. Connecting WebSockets ---');
        const customerSocket = io(SOCKET_URL, { auth: { token: customerToken } });
        const workerSocket = io(SOCKET_URL, { auth: { token: workerToken } });

        await new Promise((resolve) => {
            let connected = 0;
            const check = () => { if (++connected === 2) resolve(); };
            customerSocket.on('connect', check);
            workerSocket.on('connect', check);
        });
        console.log('✅ WebSockets connected');

        // Join rooms so they receive notifications
        customerSocket.emit('JOIN_CUSTOMER_ROOM', { userId: customerId });
        workerSocket.emit('JOIN_WORKER_ROOM', { userId: workerId });

        let receivedQuoteId = null;
        let jobArrivalOtp = null;
        let jobCompletionOtp = null;

        // Listen for new quotes on customer socket
        customerSocket.on('NEW_QUOTE', (data) => {
            console.log(`📩 Customer received quote from worker: ₹${data.amount} (${data.timeToReach})`);
            receivedQuoteId = data.quoteId;
        });

        // Listen for accepted quote on worker socket
        workerSocket.on('QUOTE_ACCEPTED', (data) => {
            console.log(`🎉 Worker's quote accepted! Arrival OTP: ${data.arrivalOtp}`);
            jobArrivalOtp = data.arrivalOtp;
        });


        // --- 3. Job Booking Flow ---
        console.log('\n--- 3. Job Booking ---');
        const createJobRes = await axios.post(`${BASE_URL}/jobs`, {
            category: 'Plumber',
            description: 'Fix leaking pipe under sink',
            location: { type: 'Point', coordinates: [77.2090, 28.6139] },
            addressDetails: '123 Test St, Testville, TS 110001',
            preferredDate: new Date().toISOString(),
            timeSlot: 'urgent'
        }, { headers: { Authorization: `Bearer ${customerToken}` } });

        const jobId = createJobRes.data.data._id;
        console.log(`✅ Customer created Job ID: ${jobId}`);

        // Worker places a quote
        await delay(1000); // Give sockets a moment
        const quoteRes = await axios.post(`${BASE_URL}/quotes`, {
            jobId: jobId,
            amount: 500,
            description: 'Can fix it in 30 mins',
            timeToReach: '10 mins',
            workerLocation: { type: 'Point', coordinates: [77.2090, 28.6139] }
        }, { headers: { Authorization: `Bearer ${workerToken}` } });
        console.log(`✅ Worker placed quote of ₹500`);

        // Wait for customer to receive the quote over socket
        await delay(1000);

        if (!receivedQuoteId) throw new Error('Customer did not receive quote via WebSocket');

        // Customer accepts the quote
        const acceptRes = await axios.patch(`${BASE_URL}/quotes/${receivedQuoteId}/accept`, {}, { headers: { Authorization: `Bearer ${customerToken}` } });
        console.log(`✅ Customer accepted quote`);

        jobCompletionOtp = acceptRes.data.data.job.security.completionOtp;

        await delay(1000); // Wait for worker to get arrival OTP

        // --- 4. Job Execution Flow ---
        console.log('\n--- 4. Job Execution ---');
        // Worker starts the job using Arrival OTP
        await axios.post(`${BASE_URL}/jobs/${jobId}/start`, { arrivalOtp: jobArrivalOtp }, { headers: { Authorization: `Bearer ${workerToken}` } });
        console.log(`✅ Worker started the job (Status: IN_PROGRESS)`);

        // Worker completes the job
        await axios.post(`${BASE_URL}/jobs/${jobId}/complete`, { report: 'Pipe replaced successfully' }, { headers: { Authorization: `Bearer ${workerToken}` } });
        console.log(`✅ Worker completed the job (Status: COMPLETED)`);

        // --- 5. Payment Flow ---
        console.log('\n--- 5. Payment ---');
        const payRes = await axios.post(`${BASE_URL}/jobs/${jobId}/pay`, { method: 'CASH', completionOtp: jobCompletionOtp }, { headers: { Authorization: `Bearer ${customerToken}` } });
        console.log(`✅ Customer paid for the job in CASH`);
        console.log(`   Platform Fee Deducted: ₹${payRes.data.data.payment.platformFee}`);
        console.log(`   Worker Net Payout: ₹${payRes.data.data.payment.workerPayout}`);

        // --- 6. Verification ---
        console.log('\n--- 6. Final State Verification ---');
        const jobFinal = await axios.get(`${BASE_URL}/jobs/my`, { headers: { Authorization: `Bearer ${customerToken}` } });
        const finalJobState = jobFinal.data.data.find(j => j._id === jobId);

        if (finalJobState.status !== 'PAID') {
            throw new Error(`Expected job status to be PAID, got ${finalJobState.status}`);
        }
        console.log(`✅ Job Final Status: ${finalJobState.status}`);

        const workerFinal = await Customer.findById(workerId);
        console.log(`✅ Worker Final Wallet Balance: ₹${workerFinal.wallet.balance}`); // Started with 500, minus platform fee

        console.log('\n🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY! 🎉');

        // Cleanup
        customerSocket.disconnect();
        workerSocket.disconnect();
        await mongoose.disconnect();
        await redis.quit();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        console.error(error.response?.data || error.message);
        process.exit(1);
    }
}

runE2ETest();
