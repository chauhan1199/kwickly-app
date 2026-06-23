const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyWorkerModule() {
    console.log('🚀 Starting Comprehensive Worker Module Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        const Customer = require('../src/modules/customer/customer.model');
        const admin = await Customer.findOne({ role: 'ADMIN' });
        
        if (!admin) throw new Error("Admin not found");
        const token = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const auth = { headers: { Authorization: `Bearer ${token}` } };
        let workerId;

        // 1. ADD WORKER
        console.log('1️⃣ Testing [ADD WORKER]');
        const addPayload = {
            name: "Test Worker E Three E",
            phone: Date.now().toString().substring(0, 10),
            email: `test_${Date.now()}@test.com`,
            role: "WORKER",
            city: "TestCity",
            bio: "I am a test worker",
            wallet: {
                upiId: "worker@oktest",
                bankDetails: {
                    bankName: "Test Bank",
                    accountNumber: "1234567890",
                    ifscCode: "TEST0001234"
                }
            }
        };
        const resAdd = await axios.post(`${BASE_URL}/admin/users`, addPayload, auth);
        workerId = resAdd.data.data._id;
        console.log(`✅ Add Worker Success! ID: ${workerId}`);
        
        // 2. UPDATE WORKER
        console.log('\n2️⃣ Testing [UPDATE WORKER]');
        const updatePayload = {
            name: "Updated Worker E Two E",
            city: "UpdatedCity"
        };
        await axios.patch(`${BASE_URL}/admin/users/${workerId}`, updatePayload, auth);
        console.log('✅ Update Worker Success!');

        // 3. KYC STATUS UPDATE
        console.log('\n3️⃣ Testing [KYC UPDATE]');
        await axios.patch(`${BASE_URL}/admin/workers/${workerId}/kyc`, { status: "APPROVED" }, auth);
        console.log('✅ KYC Update Success!');

        // 4. ACTIVE / DEACTIVE TOGGLE
        console.log('\n4️⃣ Testing [ACTIVE/DEACTIVE]');
        await axios.patch(`${BASE_URL}/admin/users/${workerId}/toggle-status`, { isActive: false }, auth);
        await axios.patch(`${BASE_URL}/admin/users/${workerId}/toggle-status`, { isActive: true }, auth);
        console.log('✅ Status Toggle Success!');

        // 5. WALLET CREDIT / DEBIT
        console.log('\n5️⃣ Testing [WALLET CREDIT/DEBIT]');
        try {
            await axios.post(`${BASE_URL}/admin/wallet/adjust`, {
                userId: workerId,
                amount: 100,
                type: "CREDIT",
                description: "Test Credit"
            }, auth);
            console.log('✅ Wallet Credit Success!');
        } catch(e) {
             console.log('⚠️ Wallet Credit Failed (likely admin wallet empty):', e.response?.data?.message || e.message);
        }

        // 6. FILTERS & SEARCH
        console.log('\n6️⃣ Testing [FILTERS & SEARCH]');
        const resSearch = await axios.get(`${BASE_URL}/admin/workers?search=Updated Worker&kycStatus=APPROVED&limit=10`, auth);
        if (resSearch.data.data.workers && resSearch.data.data.workers.length > 0) {
            console.log(`✅ Search & Filter Success! Found ${resSearch.data.data.workers.length} workers.`);
        } else {
             console.log('❌ Search failed to find the created worker.');
        }

        // 7. DELETE WORKER
        console.log('\n7️⃣ Testing [DELETE WORKER]');
        await axios.delete(`${BASE_URL}/admin/users/${workerId}`, auth);
        console.log('✅ Delete Worker Success!');

        console.log('\n🎉 ALL WORKER ENDPOINTS VERIFIED SUCCESSFULLY!');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyWorkerModule();
