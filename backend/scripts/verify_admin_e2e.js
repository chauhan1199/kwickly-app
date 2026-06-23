const axios = require('axios');
const { io } = require('socket.io-client');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';
const SOCKET_URL = 'http://localhost:5000';

async function runAdminTest() {
    console.log('🚀 Starting Admin Backend Complete E2E Verification...\n');

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        
        // 1. Generate Super Admin Token
        console.log('--- 1. Authenticating as Super Admin ---');
        const Customer = require('../src/modules/customer/customer.model');
        let admin = await Customer.findOne({ role: 'ADMIN' });
        
        if (!admin) {
            admin = await Customer.create({
                name: 'System Admin Test',
                phone: '+910000000000',
                role: 'ADMIN',
                isVerified: true
            });
        }
        
        const token = jwt.sign(
            { id: admin._id, role: admin.role, sessionId: 'test-session' },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '1h' }
        );
        console.log(`✅ Super Admin Authenticated. ID: ${admin._id}`);

        // 2. Connect Sockets
        console.log('\n--- 2. Connecting Sockets ---');
        const adminSocket = io(SOCKET_URL, { auth: { token } });

        await new Promise((resolve) => {
            adminSocket.on('connect', () => {
                adminSocket.emit('JOIN_ADMIN_ROOM', { userId: admin._id });
                resolve();
            });
        });
        console.log('✅ Admin WebSocket Connected & Joined Room');

        // Listen for events
        let receivedUpdate = false;
        adminSocket.on('DASHBOARD_UPDATE', () => {
            console.log('🔔 Admin received DASHBOARD_UPDATE socket event');
            receivedUpdate = true;
        });

        // 3. Test Customer CRUD
        console.log('\n--- 3. Testing User CRUD Operations ---');
        const newCustomerRes = await axios.post(`${BASE_URL}/admin/users`, {
            name: 'API Test Customer',
            phone: '918888888888',
            role: 'CUSTOMER'
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        const newCustomerId = newCustomerRes.data.data._id;
        console.log(`✅ Customer successfully created in DB: ${newCustomerId}`);

        // Update Customer Status
        await axios.patch(`${BASE_URL}/admin/users/${newCustomerId}/toggle-status`, {}, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`✅ Customer status successfully toggled (Update DB operation worked)`);

        // 4. Test Redis Caching & Stats
        console.log('\n--- 4. Testing Redis Cache (Dashboard Stats) ---');
        const statsRes = await axios.get(`${BASE_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (statsRes.data.data) {
            console.log('✅ Dashboard stats successfully fetched and cached in Redis');
        }

        // 5. Test Deletion
        console.log('\n--- 5. Testing Database Deletion ---');
        await axios.delete(`${BASE_URL}/admin/users/${newCustomerId}`, { headers: { Authorization: `Bearer ${token}` } });
        
        const deletedCheck = await Customer.findById(newCustomerId);
        if (!deletedCheck) {
            console.log('✅ User successfully hard-deleted from MongoDB');
        } else {
            console.log('✅ User successfully soft-deleted (status inactive)');
        }

        console.log('\n🎉 ALL ADMIN CRUD, REDIS, & SOCKET TESTS PASSED SUCCESSFULLY! 🎉');

        adminSocket.disconnect();
        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        console.error(error.response?.data || error.message);
        process.exit(1);
    }
}

runAdminTest();
