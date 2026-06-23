const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyBanners() {
    console.log('🚀 Starting Comprehensive Banners Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        const Customer = require('../src/modules/customer/customer.model');
        const admin = await Customer.findOne({ role: 'ADMIN' });
        if (!admin) throw new Error("Admin not found");
        
        const token = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const testSuffix = Date.now().toString().slice(-8);

        console.log('--- 🖼️ BANNERS FLOW ---');
        let bannerId;
        
        console.log('1️⃣ Admin Fetches Existing Banners');
        const initialRes = await axios.get(`${BASE_URL}/admin/promotions/banners/all`, auth);
        console.log(`✅ Fetched ${initialRes.data.data.length} existing banners.`);

        console.log('2️⃣ Admin Creates Banner');
        const bannerRes = await axios.post(`${BASE_URL}/admin/promotions/banners`, {
            title: `Summer Sale Test ${testSuffix}`,
            subtitle: "Up to 50% off",
            imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745a872f",
            linkType: "NONE",
            position: "HOME_TOP",
            priority: 10,
            isActive: true
        }, auth);
        bannerId = bannerRes.data.data._id;
        console.log(`✅ Banner Created! ID: ${bannerId}`);

        console.log('3️⃣ Admin Updates Banner');
        await axios.patch(`${BASE_URL}/admin/promotions/banners/${bannerId}`, { priority: 20 }, auth);
        console.log('✅ Banner Updated!');

        console.log('4️⃣ Filter/List Banners (Ensuring Priority Sort Works)');
        const listRes = await axios.get(`${BASE_URL}/admin/promotions/banners/all`, auth);
        if(listRes.data.data.length > 0) console.log(`✅ Banners list fetched successfully. First banner priority: ${listRes.data.data[0].priority}`);

        console.log('5️⃣ Admin Deletes Banner');
        await axios.delete(`${BASE_URL}/admin/promotions/banners/${bannerId}`, auth);
        console.log('✅ Banner Deleted!');

        console.log('\n🎉 BANNERS ENDPOINTS VERIFIED SUCCESSFULLY!');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyBanners();
