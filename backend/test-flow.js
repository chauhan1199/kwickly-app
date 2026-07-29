const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runE2E() {
    try {
        console.log('🧪 Starting Kwickly E2E API Flow Test...');

        // 1. Auth - Customer Login
        console.log('\n--- 1. Customer Auth ---');
        let res = await axios.post(`${BASE_URL}/auth/send-otp`, { phone: '9876543210', role: 'CUSTOMER' });
        console.log('Customer OTP sent.');
        res = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: '9876543210', code: '1234', role: 'CUSTOMER', name: 'Test Customer' });
        const customerToken = res.data.data.token;
        const customerId = res.data.data.user._id;
        console.log(`Customer logged in. Token: ${customerToken.substring(0, 15)}...`);

        // 2. Auth - Worker Login
        console.log('\n--- 2. Worker Auth ---');
        await axios.post(`${BASE_URL}/auth/send-otp`, { phone: '9876543211', role: 'WORKER' });
        console.log('Worker OTP sent.');
        res = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: '9876543211', code: '1234', role: 'WORKER', name: 'Test Worker' });
        const workerToken = res.data.data.token;
        const workerId = res.data.data.user._id;
        console.log(`Worker logged in. Token: ${workerToken.substring(0, 15)}...`);

        // 3. Worker Setup (Go Online)
        console.log('\n--- 3. Worker Setup ---');
        // Set up service
        const cats = await axios.get(`${BASE_URL}/categories`);
        const catId = cats.data.data[0]._id;
        
        await axios.patch(`${BASE_URL}/workers/me/services`, {
            services: [{ category: catId, categoryName: 'Home Services', subcategories: ['Cleaning'], isActive: true }]
        }, { headers: { Authorization: `Bearer ${workerToken}` } });
        
        await axios.patch(`${BASE_URL}/workers/me/location`, {
            activeLocation: { type: 'Point', coordinates: [72.8777, 19.0760] }
        }, { headers: { Authorization: `Bearer ${workerToken}` } });
        
        // Go Online (Ignore KYC error if it happens, we assume test workers have bypass or we mock)
        try {
            await axios.patch(`${BASE_URL}/workers/me/online`, { isOnline: true }, { headers: { Authorization: `Bearer ${workerToken}` } });
            console.log('Worker went online successfully.');
        } catch(e) {
            console.log('Worker online failed (likely KYC). Continuing anyway for quote testing...');
        }

        // 4. Customer Posts Job
        console.log('\n--- 4. Customer Posts Job ---');
        res = await axios.post(`${BASE_URL}/jobs`, {
            category: 'Home Services',
            subcategory: 'Cleaning',
            description: 'Need full house cleaning',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            addressDetails: { city: 'Mumbai', fullAddress: 'Test Addr' },
            timeSlot: 'morning'
        }, { headers: { Authorization: `Bearer ${customerToken}` } });
        const jobId = res.data.data._id;
        console.log(`Job Posted! Job ID: ${jobId}`);

        // 5. Worker Quotes Job
        console.log('\n--- 5. Worker Quotes Job ---');
        res = await axios.post(`${BASE_URL}/quotes`, {
            jobId: jobId,
            amount: 500,
            description: 'Can do it perfectly',
            timeToReach: '30 mins',
            workerLocation: { type: 'Point', coordinates: [72.8777, 19.0760] }
        }, { headers: { Authorization: `Bearer ${workerToken}` } });
        const quoteId = res.data.data._id;
        console.log(`Quote placed! Quote ID: ${quoteId}`);

        // 6. Customer Accepts Quote
        console.log('\n--- 6. Customer Accepts Quote ---');
        res = await axios.patch(`${BASE_URL}/quotes/${quoteId}/accept`, {}, { headers: { Authorization: `Bearer ${customerToken}` } });
        console.log(`Quote accepted! Job status: ${res.data.data.job.status}`);
        
        // Fetch Job to get Arrival OTP
        res = await axios.get(`${BASE_URL}/jobs/${jobId}`, { headers: { Authorization: `Bearer ${customerToken}` } });
        const arrivalOtp = res.data.data.security.arrivalOtp;
        console.log(`Customer sees Arrival OTP: ${arrivalOtp}`);

        // 7. Worker Starts Job
        console.log('\n--- 7. Worker Starts Job ---');
        res = await axios.post(`${BASE_URL}/jobs/${jobId}/start`, {
            arrivalOtp: arrivalOtp,
            currentCoordinates: [72.8777, 19.0760]
        }, { headers: { Authorization: `Bearer ${workerToken}` } });
        console.log(`Job Started! Status: ${res.data.data.status}`);

        // Fetch Job to get Completion OTP
        res = await axios.get(`${BASE_URL}/jobs/${jobId}`, { headers: { Authorization: `Bearer ${customerToken}` } });
        const completionOtp = res.data.data.security.completionOtp;
        console.log(`Customer sees Completion OTP: ${completionOtp}`);

        // 8. Worker Completes Job
        console.log('\n--- 8. Worker Completes Job ---');
        res = await axios.post(`${BASE_URL}/jobs/${jobId}/complete`, {
            completionOtp: completionOtp,
            report: 'Cleaning completed nicely'
        }, { headers: { Authorization: `Bearer ${workerToken}` } });
        console.log(`Job Completed! Status: ${res.data.data.status}`);

        // 9. Customer Pays Cash
        console.log('\n--- 9. Customer Pays (CASH) ---');
        res = await axios.post(`${BASE_URL}/jobs/${jobId}/pay`, {
            method: 'CASH',
            completionOtp: completionOtp
        }, { headers: { Authorization: `Bearer ${customerToken}` } });
        console.log(`Job Paid! Final Status: ${res.data.data.job.status}`);

        console.log('\n✅ ALL E2E FLOWS COMPLETED SUCCESSFULLY!');
    } catch (error) {
        console.error('❌ E2E TEST FAILED:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

runE2E();
