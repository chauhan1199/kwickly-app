const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyJobsAndOrders() {
    console.log('🚀 Starting Comprehensive Jobs & Orders Module Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        const Customer = require('../src/modules/customer/customer.model');
        const admin = await Customer.findOne({ role: 'ADMIN' });
        if (!admin) throw new Error("Admin not found");
        const adminToken = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const auth = { headers: { Authorization: `Bearer ${adminToken}` } };

        const testSuffix = Date.now().toString().slice(-8);

        // 1. SETUP PREREQUISITES
        console.log('⚙️ Setting up test entities...');
        const custRes = await axios.post(`${BASE_URL}/admin/users`, { name: `Customer Test`, phone: testSuffix + "11", role: 'CUSTOMER', city: 'Test' }, auth);
        const customerId = custRes.data.data._id;
        
        const workRes = await axios.post(`${BASE_URL}/admin/users`, { name: `Worker Test`, phone: testSuffix + "22", role: 'WORKER', city: 'Test' }, auth);
        const workerId = workRes.data.data._id;
        
        const shopRes = await axios.post(`${BASE_URL}/admin/shops`, { name: `S ${testSuffix}`, ownerPhone: testSuffix + "33", ownerEmail:`s${testSuffix}@t.com`, category: 'General', address: '123 Test St' }, auth);
        const shopId = shopRes.data.data._id;
        const ownerId = shopRes.data.data.ownerId._id || shopRes.data.data.ownerId;
        
        await axios.patch(`${BASE_URL}/admin/shops/${shopId}/kyc`, { status: "APPROVED" }, auth);
        
        console.log(`✅ Setup complete. Customer: ${customerId}, Worker: ${workerId}, Shop: ${shopId} (KYC APPROVED)`);

        // --- JOBS FLOW ---
        let jobId;
        console.log('\n--- 🛠️ JOBS FLOW ---');
        console.log('1️⃣ Admin Creates Job');
        const jobRes = await axios.post(`${BASE_URL}/admin/customers/${customerId}/jobs`, {
            customerId: customerId,
            category: "General",
            description: "Fix my plumbing",
            location: { type: 'Point', coordinates: [77.0, 28.0] },
            addressDetails: "123 Test St"
        }, auth);
        jobId = jobRes.data.data._id;
        console.log(`✅ Job Created! ID: ${jobId}`);

        console.log('2️⃣ Admin Updates Job Details');
        await axios.patch(`${BASE_URL}/admin/jobs/${jobId}/details`, { description: "Fix plumbing ASAP", amount: 600 }, auth);
        console.log('✅ Job Details Updated!');

        console.log('3️⃣ Admin Reassigns Worker');
        await axios.patch(`${BASE_URL}/jobs/${jobId}/reassign`, { workerId }, auth);
        console.log('✅ Worker Assigned!');

        console.log('4️⃣ Filter & Search Jobs');
        const jobsList = await axios.get(`${BASE_URL}/jobs/all?status=ALLOCATED`, auth);
        if(jobsList.data.data.jobs) console.log(`✅ Jobs Filter fetched successfully`);

        console.log('5️⃣ Admin Cancels Job');
        await axios.patch(`${BASE_URL}/jobs/${jobId}/cancel`, { reason: "Customer changed mind" }, auth);
        console.log('✅ Job Cancelled!');


        // --- ORDERS FLOW ---
        let orderId;
        console.log('\n--- 📦 ORDERS FLOW ---');
        
        console.log('1️⃣ Setup Product for Shop');
        const tokRes = await axios.post(`${BASE_URL}/admin/users/${ownerId}/impersonate`, {}, auth);
        const shopAuth = { headers: { Authorization: `Bearer ${tokRes.data.data.token}` } };
        const prodRes = await axios.post(`${BASE_URL}/products`, { name: "Test Item", price: 100, category: "General", stock: 10, isAvailable: true }, shopAuth);
        const productId = prodRes.data.data._id;
        console.log(`✅ Product Created: ${productId}`);

        console.log('2️⃣ Admin Creates Order');
        const orderRes = await axios.post(`${BASE_URL}/admin/customers/${customerId}/orders`, {
            customerId: customerId,
            shopId: shopId,
            items: [{ productId, name: "Test Item", price: 100, qty: 2 }],
            deliveryAddress: "123 St",
            deliveryLocation: { type: 'Point', coordinates: [77.0, 28.0] },
            paymentMethod: 'CASH'
        }, auth);
        orderId = orderRes.data.data._id;
        console.log(`✅ Order Created! ID: ${orderId}`);

        console.log('3️⃣ Admin Updates Order Status');
        await axios.patch(`${BASE_URL}/shoporders/${orderId}/status`, { status: "OUT_FOR_DELIVERY" }, auth);
        console.log('✅ Order Status Updated to OUT_FOR_DELIVERY!');

        console.log('4️⃣ Filter & Search Orders');
        const ordList = await axios.get(`${BASE_URL}/shoporders/all?status=OUT_FOR_DELIVERY`, auth);
        if(ordList.data.data.orders) console.log(`✅ Orders Filter fetched successfully`);

        console.log('\n🎉 ALL JOBS & ORDERS ENDPOINTS VERIFIED SUCCESSFULLY!');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyJobsAndOrders();
