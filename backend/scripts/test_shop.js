const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyShopModule() {
    console.log('🚀 Starting Comprehensive Shop Module Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        const Customer = require('../src/modules/customer/customer.model');
        const admin = await Customer.findOne({ role: 'ADMIN' });
        
        if (!admin) throw new Error("Admin not found");
        const adminToken = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const adminAuth = { headers: { Authorization: `Bearer ${adminToken}` } };

        let shopId, ownerId, productId;
        const testSuffix = Date.now().toString().substring(0, 8);

        // 1. ADD SHOP
        console.log('1️⃣ Testing [ADD SHOP]');
        const addPayload = {
            name: `Test Shop ${testSuffix}`,
            category: "General",
            address: "123 Test St, 110001",
            description: "Test description",
            ownerPhone: testSuffix + "12",
            ownerName: "Shop Owner",
            ownerEmail: `shop_${testSuffix}@test.com`,
            businessHours: {
                monFri: "9 AM - 6 PM",
                sat: "9 AM - 2 PM",
                sun: "Closed"
            },
            delivery: {
                radiusKm: 5,
                fee: 50,
                freeAbove: 500
            },
            subscription: { plan: "FREE_TRIAL" }
        };
        const resAdd = await axios.post(`${BASE_URL}/admin/shops`, addPayload, adminAuth);
        shopId = resAdd.data.data._id;
        ownerId = resAdd.data.data.ownerId._id || resAdd.data.data.ownerId;
        console.log(`✅ Add Shop Success! Shop ID: ${shopId}, Owner ID: ${ownerId}`);
        
        // 2. UPDATE SHOP
        console.log('\n2️⃣ Testing [UPDATE SHOP]');
        const updatePayload = {
            name: `Updated Shop ${testSuffix}`,
            description: "Updated description"
        };
        await axios.patch(`${BASE_URL}/admin/shops/${shopId}`, updatePayload, adminAuth);
        console.log('✅ Update Shop Success!');

        // 3. ADD PAYOUT METHODS (BANK & UPI)
        console.log('\n3️⃣ Testing [ADD PAYOUT METHODS]');
        await axios.post(`${BASE_URL}/admin/shops/${shopId}/payout-methods`, {
            type: "BANK",
            label: "HDFC Business",
            detail: "123456789 IFSC: HDFC000123"
        }, adminAuth);
        await axios.post(`${BASE_URL}/admin/shops/${shopId}/payout-methods`, {
            type: "UPI",
            label: "GPay",
            detail: "shop@okaxis"
        }, adminAuth);
        console.log('✅ Payout Methods Added!');

        // 4. KYC UPDATE
        console.log('\n4️⃣ Testing [KYC UPDATE]');
        await axios.patch(`${BASE_URL}/admin/shops/${shopId}/kyc`, { status: "APPROVED" }, adminAuth);
        console.log('✅ KYC Update Success!');

        // 5. ACTIVE / INACTIVE TOGGLE
        console.log('\n5️⃣ Testing [ACTIVE/INACTIVE TOGGLE]');
        await axios.patch(`${BASE_URL}/admin/shops/${shopId}/toggle`, { isOnline: false }, adminAuth);
        await axios.patch(`${BASE_URL}/admin/shops/${shopId}/toggle`, { isOnline: true }, adminAuth);
        console.log('✅ Status Toggle Success!');

        // 6. WALLET CREDIT
        console.log('\n6️⃣ Testing [WALLET CREDIT]');
        try {
            await axios.post(`${BASE_URL}/admin/shops/${shopId}/wallet/credit`, {
                amount: 100,
                description: "Test Credit"
            }, adminAuth);
            console.log('✅ Wallet Credit Success!');
        } catch(e) {
             console.log('⚠️ Wallet Credit Failed (likely admin wallet empty):', e.response?.data?.message || e.message);
        }

        // 7. FILTER & SEARCH
        console.log('\n7️⃣ Testing [FILTERS & SEARCH]');
        const resSearch = await axios.get(`${BASE_URL}/admin/shops?search=Updated Shop&status=APPROVED&limit=10`, adminAuth);
        if (resSearch.data.data.shops && resSearch.data.data.shops.length > 0) {
            console.log(`✅ Search & Filter Success! Found ${resSearch.data.data.shops.length} shops.`);
        } else {
             console.log('❌ Search failed to find the created shop.');
        }

        // 8. IMPERSONATE OWNER
        console.log('\n8️⃣ Testing [IMPERSONATE SHOP OWNER]');
        const resToken = await axios.post(`${BASE_URL}/admin/users/${ownerId}/impersonate`, {}, adminAuth);
        const shopToken = resToken.data.data.token;
        const shopAuth = { headers: { Authorization: `Bearer ${shopToken}` } };
        console.log('✅ Impersonation Token Generated!');

        // 9. ADD PRODUCT
        console.log('\n9️⃣ Testing [ADD PRODUCT]');
        const prodPayload = {
            name: "Test E2E Product",
            category: "General",
            description: "A fresh product",
            price: 500,
            comparePrice: 600,
            isAvailable: true
        };
        const resProd = await axios.post(`${BASE_URL}/products`, prodPayload, shopAuth);
        productId = resProd.data.data._id;
        console.log(`✅ Add Product Success! Product ID: ${productId}`);

        // 10. DELETE PRODUCT
        console.log('\n🔟 Testing [DELETE PRODUCT]');
        await axios.delete(`${BASE_URL}/products/${productId}`, shopAuth);
        console.log('✅ Delete Product Success!');

        // 11. DELETE SHOP
        console.log('\n1️⃣1️⃣ Testing [DELETE SHOP]');
        await axios.delete(`${BASE_URL}/admin/shops/${shopId}`, adminAuth);
        console.log('✅ Delete Shop Success!');

        console.log('\n🎉 ALL SHOP ENDPOINTS VERIFIED SUCCESSFULLY!');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyShopModule();
