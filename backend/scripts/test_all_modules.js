const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function runExhaustiveTest() {
    console.log('🚀 Starting Comprehensive Module-Wise Admin Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        
        // Authenticate
        const Customer = require('../src/modules/customer/customer.model');
        const Notification = require('../src/modules/notification/notification.model');
        const Shop = require('../src/modules/shop/shop.model');
        
        let admin = await Customer.findOne({ role: 'ADMIN' });
        const token = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Record timestamp to filter new logs
        const testStartTime = new Date();

        console.log('--- 1. USER MODULE ---');
        // Add User
        const userPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const newCustomerRes = await axios.post(`${BASE_URL}/admin/users`, {
            name: 'Module Test User', phone: userPhone, role: 'CUSTOMER'
        }, { headers: { Authorization: `Bearer ${token}` } });
        const userId = newCustomerRes.data.data._id;
        console.log(`✅ Add User OK`);

        // Update User
        await axios.patch(`${BASE_URL}/admin/users/${userId}`, { name: 'Module Test User Updated' }, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Update User OK`);

        // Delete User
        await axios.delete(`${BASE_URL}/admin/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Delete User OK`);

        console.log('\n--- 2. SHOP MODULE ---');
        // Add Shop
        const shopPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const shopRes = await axios.post(`${BASE_URL}/admin/shops`, {
            name: 'Test Shop', ownerName: 'Owner', ownerPhone: shopPhone, category: 'Grocery',
            location: { latitude: 28, longitude: 77 },
            address: '123 St, Delhi, 110001'
        }, { headers: { Authorization: `Bearer ${token}` } });
        const shopId = shopRes.data.data._id;
        const shopOwnerId = shopRes.data.data.ownerId._id;
        console.log(`✅ Add Shop OK`);

        // Update Shop Toggle
        await axios.patch(`${BASE_URL}/admin/shops/${shopId}/toggle`, { field: 'isOnline' }, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Toggle Shop OK`);

        console.log('\n--- 3. WALLET & LEDGER MODULE ---');
        // We will credit the shop owner wallet
        await axios.post(`${BASE_URL}/admin/shops/${shopId}/wallet/credit`, {
            amount: 100, description: 'Test Credit'
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Credit Wallet OK`);

        // Delete Shop (Moved from before Wallet test)
        await axios.delete(`${BASE_URL}/admin/shops/${shopId}`, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Delete Shop OK`);

        console.log('\n--- 4. SETTINGS MODULE ---');
        // Update Settings
        await axios.patch(`${BASE_URL}/admin/settings`, {
            wallet: { workerMinimumBalance: 200 }
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Update Settings OK`);


        console.log('\n--- 5. ACTIVITY LOG VERIFICATION ---');
        // Query recent Notification where type='ADMIN_ACTIVITY'
        const logs = await Notification.find({ type: 'ADMIN_ACTIVITY', createdAt: { $gte: testStartTime } });
        
        const loggedActions = logs.map(l => l.action);
        console.log(`Found ${loggedActions.length} Activity Logs:`);
        loggedActions.forEach(a => console.log(` - ${a}`));

        const expectedActions = [
            'CREATE', // User create
            'UPDATE', // User update
            'DELETE', // User delete
            'CREATE', // Shop create
            'UPDATE', // Shop toggle
            'DELETE', // Shop delete
            'CREDIT', // Wallet credit
            'UPDATE'  // Settings update
        ];

        let missing = false;
        if (loggedActions.length < expectedActions.length) {
            console.log('\n❌ MISSING ACTIVITY LOGS! Some controllers are not calling logAdminActivity()');
            missing = true;
        }

        // Cleanup test data
        await Customer.findByIdAndDelete(userId);
        await Customer.findByIdAndDelete(shopOwnerId);
        await Shop.findByIdAndDelete(shopId);

        if (missing) process.exit(1);
        console.log('\n🎉 ALL MODULES TESTED & FULLY LOGGED 🎉');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runExhaustiveTest();
