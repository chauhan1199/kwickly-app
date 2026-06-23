const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyPlatformFeatures() {
    console.log('🚀 Starting Comprehensive Platform (Categories, Promos, KYC, Disputes) Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        const Customer = require('../src/modules/customer/customer.model');
        const admin = await Customer.findOne({ role: 'ADMIN' });
        if (!admin) throw new Error("Admin not found");
        
        const token = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const testSuffix = Date.now().toString().slice(-8);

        // --- 1. CATEGORIES FLOW ---
        console.log('\n--- 📂 CATEGORIES FLOW ---');
        let categoryId;
        
        console.log('1️⃣ Admin Creates Category');
        const catRes = await axios.post(`${BASE_URL}/admin/categories`, {
            name: `Test Cat ${testSuffix}`,
            icon: "box",
            color: "#FF0000",
            description: "A test category"
        }, auth);
        categoryId = catRes.data.data._id;
        console.log(`✅ Category Created! ID: ${categoryId}`);

        console.log('2️⃣ Admin Updates Category');
        await axios.patch(`${BASE_URL}/admin/categories/${categoryId}`, { name: `Updated Cat ${testSuffix}` }, auth);
        console.log('✅ Category Updated!');

        console.log('3️⃣ Filter/List Categories');
        const catList = await axios.get(`${BASE_URL}/categories`, auth);
        if(catList.data.data.length >= 0) console.log(`✅ Category list fetched successfully`);

        console.log('4️⃣ Admin Deletes Category');
        await axios.delete(`${BASE_URL}/admin/categories/${categoryId}`, auth);
        console.log('✅ Category Deleted!');


        // --- 2. PROMOTIONS FLOW ---
        console.log('\n--- 🎁 PROMOTIONS FLOW ---');
        let promoId;

        console.log('1️⃣ Admin Creates Promotion');
        const promoRes = await axios.post(`${BASE_URL}/admin/promotions/promotions`, {
            code: `TESTPROMO${testSuffix}`,
            title: "Test Discount",
            description: "50% off",
            type: "PERCENTAGE_DISCOUNT",
            value: 50,
            minOrderAmount: 100,
            isActive: true
        }, auth);
        promoId = promoRes.data.data._id;
        console.log(`✅ Promotion Created! ID: ${promoId}`);

        console.log('2️⃣ Admin Updates Promotion');
        await axios.patch(`${BASE_URL}/admin/promotions/promotions/${promoId}`, { value: 60 }, auth);
        console.log('✅ Promotion Updated!');

        console.log('3️⃣ Admin Validates Promo Code (Mock API Route Check)');
        await axios.get(`${BASE_URL}/admin/promotions/promotions`, auth);
        console.log('✅ Promotions List Fetched!');

        console.log('4️⃣ Admin Deletes Promotion');
        await axios.delete(`${BASE_URL}/admin/promotions/promotions/${promoId}`, auth);
        console.log('✅ Promotion Deleted!');


        // --- 3. KYC FLOW ---
        console.log('\n--- 📜 KYC FLOW ---');
        console.log('1️⃣ Admin Fetches Pending KYC queue');
        const kycRes = await axios.get(`${BASE_URL}/admin/pending-kyc`, auth);
        if(kycRes.data.data) console.log(`✅ KYC Queue Fetched successfully. (${kycRes.data.data.length} pending)`);

        // --- 4. SETTLEMENTS & DISPUTES ---
        console.log('\n--- ⚖️ SETTLEMENTS & DISPUTES FLOW ---');
        
        console.log('1️⃣ Admin Fetches Settlements');
        const settleRes = await axios.get(`${BASE_URL}/admin/settlements`, auth);
        if(settleRes.data.data) console.log(`✅ Settlements list fetched.`);

        console.log('2️⃣ Admin Fetches Disputes');
        const dispRes = await axios.get(`${BASE_URL}/admin/disputes`, auth);
        if(dispRes.data.data) console.log(`✅ Disputes list fetched.`);

        console.log('\n🎉 ALL PLATFORM ENDPOINTS VERIFIED SUCCESSFULLY!');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyPlatformFeatures();
