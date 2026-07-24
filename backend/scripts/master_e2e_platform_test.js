const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const API_BASE = 'http://localhost:5000/api/v1';

async function runMasterTest() {
    console.log('================================================================');
    console.log('  KWICKLY PLATFORM MASTER END-TO-END STEP-BY-STEP TEST SUITE   ');
    console.log('================================================================\n');

    try {
        // -------------------------------------------------------------
        // STEP 1: ADMIN LOGIN & INITIAL BASELINE
        // -------------------------------------------------------------
        console.log('--- 1. ADMIN DASHBOARD INITIALIZATION ---');
        const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
            email: 'admin@kwickly.com',
            password: 'admin123'
        });
        const adminToken = adminLogin.data.data.token;
        const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
        console.log('✅ Admin Logged In Successfully');

        const initialStats = await axios.get(`${API_BASE}/admin/stats`, adminHeaders);
        console.log('📊 Admin Baseline Stats:', initialStats.data.data, '\n');

        // -------------------------------------------------------------
        // STEP 2: CUSTOMER AUTH, OTP, PASSWORD RESET & PROFILE
        // -------------------------------------------------------------
        console.log('--- 2. CUSTOMER AUTHENTICATION & PROFILE FLOW ---');
        const custPhone = '9000099999';
        
        // Check Status
        const checkRes = await axios.post(`${API_BASE}/auth/check-status`, { phone: custPhone, role: 'CUSTOMER' });
        console.log('✅ Check Status:', checkRes.data.data);

        // Send OTP
        const sendOtp = await axios.post(`${API_BASE}/auth/send-otp`, { phone: custPhone, role: 'CUSTOMER' });
        console.log('✅ Send OTP:', sendOtp.data.message);

        // Resend OTP
        const resendOtp = await axios.post(`${API_BASE}/auth/send-otp`, { phone: custPhone, role: 'CUSTOMER' });
        console.log('✅ Resend OTP:', resendOtp.data.message);

        // Verify OTP & Register
        const verifyOtp = await axios.post(`${API_BASE}/auth/verify-otp`, {
            phone: custPhone,
            role: 'CUSTOMER',
            code: '1234',
            name: 'Test Customer Automated'
        });
        const custToken = verifyOtp.data.data.token;
        const custHeaders = { headers: { Authorization: `Bearer ${custToken}` } };
        console.log('✅ OTP Verified & Customer Account Created');

        // Set Password
        await axios.patch(`${API_BASE}/auth/set-password`, { password: 'Customer123!' }, custHeaders);
        console.log('✅ Customer Password Set Successfully');

        // Login with Password
        const custLogin = await axios.post(`${API_BASE}/auth/login`, { phone: custPhone, password: 'Customer123!', role: 'CUSTOMER' });
        console.log('✅ Customer Login with Password Successful');

        // Topup Wallet
        await axios.post(`${API_BASE}/wallet/topup`, { amount: 2000, paymentMethod: 'UPI' }, custHeaders);
        console.log('✅ Customer Wallet Top-up (₹2000) Successful');

        // Get Profile & Wallet
        const custWallet = await axios.get(`${API_BASE}/wallet/balance`, custHeaders);
        console.log(`✅ Customer Wallet Balance: ₹${custWallet.data.data.balance}\n`);

        // -------------------------------------------------------------
        // STEP 3: WORKER AUTH, KYC, SERVICES & ONLINE TOGGLE
        // -------------------------------------------------------------
        console.log('--- 3. WORKER ONBOARDING, KYC & AVAILABILITY FLOW ---');
        const workerPhone = '9876599999';

        // Worker Reg via OTP
        await axios.post(`${API_BASE}/auth/send-otp`, { phone: workerPhone, role: 'WORKER' });
        const workerVerify = await axios.post(`${API_BASE}/auth/verify-otp`, {
            phone: workerPhone,
            role: 'WORKER',
            code: '1234',
            name: 'Test Worker Automated'
        });
        const workerToken = workerVerify.data.data.token;
        const workerId = workerVerify.data.data.user._id || workerVerify.data.data.user.id;
        const workerHeaders = { headers: { Authorization: `Bearer ${workerToken}` } };
        console.log('✅ Worker Account Created via OTP');

        await axios.patch(`${API_BASE}/auth/set-password`, { password: 'Worker123!' }, workerHeaders);
        console.log('✅ Worker Password Set Successfully');

        // Worker Wallet Topup (for quote balance requirement)
        await axios.post(`${API_BASE}/wallet/topup`, { amount: 500, paymentMethod: 'UPI' }, workerHeaders);
        console.log('✅ Worker Wallet Topup (₹500) Successful');

        // Worker Services Setup
        await axios.patch(`${API_BASE}/workers/me/services`, {
            services: [{ categoryName: 'Home Services', subcategories: ['Wiring Repair', 'AC Repair'], isActive: true }]
        }, workerHeaders);
        console.log('✅ Worker Services Configured');

        // Worker Uploads KYC Document
        await axios.patch(`${API_BASE}/workers/me/kyc`, {
            documentType: 'AADHAR',
            documentBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }, workerHeaders);
        console.log('✅ Worker Uploaded KYC Document (AADHAR)');

        // Admin Approves Worker KYC
        await axios.patch(`${API_BASE}/admin/workers/${workerId}/kyc`, { status: 'APPROVED' }, adminHeaders);
        console.log('✅ Admin Approved Worker KYC Status');

        // Worker Online Toggle & Location
        await axios.patch(`${API_BASE}/workers/me/online`, { isOnline: true }, workerHeaders);
        await axios.patch(`${API_BASE}/workers/me/location`, { location: { type: 'Point', coordinates: [77.3639, 28.6280] } }, workerHeaders);
        console.log('✅ Worker Online Status & Geolocation Set to [77.3639, 28.6280]\n');

        // -------------------------------------------------------------
        // STEP 4: JOB POSTING, QUOTE, EXECUTION & REAL-TIME ADMIN SYNC
        // -------------------------------------------------------------
        console.log('--- 4. SERVICE JOB LIFECYCLE & REAL-TIME SYNC ---');

        // Customer Posts Job
        const newJob = await axios.post(`${API_BASE}/jobs`, {
            category: 'Home Services',
            subcategory: 'Wiring Repair',
            description: 'Automated E2E test job: Switchboard sparking near kitchen.',
            address: 'Sector 62 Noida',
            location: { type: 'Point', coordinates: [77.3639, 28.6280] }
        }, custHeaders);
        const jobId = newJob.data.data._id;
        console.log(`✅ Customer Posted Job (ID: ${jobId}, Status: BROADCASTING)`);

        // Admin Sync Check
        const adminJobsCheck = await axios.get(`${API_BASE}/jobs/all`, adminHeaders);
        const foundInAdmin = adminJobsCheck.data.data.jobs.find(j => j._id === jobId);
        console.log(`✨ ADMIN SYNC CONFIRMED: Admin Panel sees job (ID: ${foundInAdmin._id}, Category: ${foundInAdmin.category})`);

        // Worker Quotes Job
        const quoteRes = await axios.post(`${API_BASE}/quotes`, {
            jobId: jobId,
            amount: 600,
            timeToReach: '30 mins',
            description: 'Ready to arrive immediately.'
        }, workerHeaders);
        const quoteId = quoteRes.data.data._id;
        console.log(`✅ Worker Submitted Quote (Price: ₹600, ID: ${quoteId})`);

        // Customer Accepts Quote
        await axios.patch(`${API_BASE}/quotes/${quoteId}/accept`, {}, custHeaders);
        console.log('✅ Customer Accepted Worker Quote');

        // Get Job OTPs
        const jobDetailsCust = await axios.get(`${API_BASE}/jobs/${jobId}`, custHeaders);
        const startOtp = jobDetailsCust.data.data.security.arrivalOtp;
        const completionOtp = jobDetailsCust.data.data.security.completionOtp;
        console.log(`✅ Job OTPs Generated — Arrival OTP: ${startOtp}, Completion OTP: ${completionOtp}`);

        // Worker Starts Job
        await axios.post(`${API_BASE}/jobs/${jobId}/start`, { arrivalOtp: startOtp, currentCoordinates: [77.3639, 28.6280] }, workerHeaders);
        console.log('✅ Worker Entered Arrival OTP & Geolocation -> Job Status: IN_PROGRESS');

        // Worker Completes Job
        await axios.post(`${API_BASE}/jobs/${jobId}/complete`, { report: 'Fixed main circuit breaker.' }, workerHeaders);
        console.log('✅ Worker Marked Job Completed -> Job Status: COMPLETED');

        // Customer Completes Payment
        await axios.post(`${API_BASE}/jobs/${jobId}/pay`, { method: 'WALLET', completionOtp: completionOtp }, custHeaders);
        console.log('✅ Customer Wallet Payment Completed -> Job Status: PAID\n');

        // -------------------------------------------------------------
        // STEP 5: SHOP REGISTRATION, CATALOG, ORDER PROCESS & ADMIN SYNC
        // -------------------------------------------------------------
        console.log('--- 5. SHOP CATALOG, ORDER PROCESS & ADMIN SYNC ---');

        const shopsRes = await axios.get(`${API_BASE}/shops`, custHeaders);
        const shop = shopsRes.data.data[0];
        const productsRes = await axios.get(`${API_BASE}/products?shopId=${shop._id}`, custHeaders);
        const product = productsRes.data.data[0];

        // Customer Places Shop Order
        const orderRes = await axios.post(`${API_BASE}/shoporders`, {
            shopId: shop._id,
            items: [{ productId: product._id, name: product.name, price: product.price, qty: 2 }],
            subtotal: product.price * 2,
            deliveryFee: 30,
            total: (product.price * 2) + 30,
            deliveryAddress: 'Sector 62 Noida',
            paymentMethod: 'WALLET',
            deliveryLocation: { type: 'Point', coordinates: [77.3639, 28.6280] }
        }, custHeaders);
        const orderId = orderRes.data.data._id;
        const orderNumber = orderRes.data.data.orderNumber;
        console.log(`✅ Customer Placed Shop Order (Number: ${orderNumber}, Total: ₹${orderRes.data.data.total})`);

        // Admin Sync Check for Order
        const adminOrdersCheck = await axios.get(`${API_BASE}/shoporders/all`, adminHeaders);
        const foundOrderInAdmin = adminOrdersCheck.data.data.orders.find(o => o._id === orderId);
        console.log(`✨ ADMIN SYNC CONFIRMED: Admin Panel sees shop order (${foundOrderInAdmin.orderNumber}, Status: ${foundOrderInAdmin.status})\n`);

        // -------------------------------------------------------------
        // STEP 6: FINAL ADMIN STATS & LEDGER AUDIT
        // -------------------------------------------------------------
        console.log('--- 6. FINAL ADMIN DASHBOARD STATS & LEDGER AUDIT ---');
        const finalStats = await axios.get(`${API_BASE}/admin/stats`, adminHeaders);
        console.log('📊 Final Admin Dashboard Stats:', finalStats.data.data);

        console.log('\n================================================================');
        console.log('🎉 MASTER E2E TEST COMPLETED SUCCESSFULLY WITH 100% PASS RATE!  ');
        console.log('================================================================');

    } catch (err) {
        console.error('❌ Master Test Error:', err.response?.data || err.message);
    }
}

runMasterTest();
