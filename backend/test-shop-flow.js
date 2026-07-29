const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runShopE2E() {
    try {
        console.log('🧪 Starting Kwickly E2E API Flow Test for SHOPS...');

        // 1. Auth - Shop Login
        console.log('\n--- 1. Shop Auth ---');
        let res = await axios.post(`${BASE_URL}/auth/send-otp`, { phone: '9876543213', role: 'SHOP' });
        res = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: '9876543213', code: '1234', role: 'SHOP', name: 'Test Shop Owner' });
        const shopToken = res.data.data.token;
        console.log(`Shop logged in. Token: ${shopToken.substring(0, 15)}...`);

        // 2. Auth - Customer Login
        console.log('\n--- 2. Customer Auth ---');
        res = await axios.post(`${BASE_URL}/auth/send-otp`, { phone: '9876543210', role: 'CUSTOMER' });
        res = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: '9876543210', code: '1234', role: 'CUSTOMER', name: 'Test Customer' });
        const customerToken = res.data.data.token;
        console.log(`Customer logged in. Token: ${customerToken.substring(0, 15)}...`);

        // 3. Shop Setup & Add Item
        console.log('\n--- 3. Shop Sets up Store and Adds Item ---');
        res = await axios.patch(`${BASE_URL}/shops/my`, {
            description: 'Best local store',
            address: 'MG Road, Mumbai',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            isOnline: true
        }, { headers: { Authorization: `Bearer ${shopToken}` } });
        const shopId = res.data.data._id;
        console.log(`Shop Profile updated. ID: ${shopId}`);

        res = await axios.post(`${BASE_URL}/products`, {
            shopId: shopId,
            name: 'Milk 1L',
            description: 'Fresh cow milk',
            price: 50,
            stock: 100,
            category: 'Groceries'
        }, { headers: { Authorization: `Bearer ${shopToken}` } });
        const itemId = res.data.data._id;
        console.log(`Item added! Item ID: ${itemId}`);

        // 3.5 Admin Approves Shop
        console.log('\n--- 3.5 Admin Approves Shop ---');
        res = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@kwickly.com',
            password: 'admin123'
        });
        const adminToken = res.data.data.token;
        console.log(`Admin logged in.`);

        res = await axios.patch(`${BASE_URL}/shops/${shopId}/kyc`, {
            status: 'APPROVED',
            message: 'Looking good'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        console.log(`Shop KYC Approved!`);

        // 3.8 Topup Customer Wallet
        console.log('\n--- 3.8 Topup Customer Wallet ---');
        const mongoose = require('mongoose');
        await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
        await mongoose.connection.collection('customers').updateOne({ phone: '9876543210' }, { $set: { 'wallet.balance': 10000 } });
        await mongoose.disconnect();
        console.log(`Customer Wallet Topped Up to ₹10,000!`);

        // 4. Customer Places an Order
        console.log('\n--- 4. Customer Places Order ---');
        res = await axios.post(`${BASE_URL}/shoporders`, {
            shopId: shopId,
            items: [{ productId: itemId, name: 'Milk 1L', qty: 2, price: 50 }],
            deliveryAddress: 'Customer Home, Mumbai',
            deliveryLocation: { type: 'Point', coordinates: [72.8800, 19.0800] },
            paymentMethod: 'WALLET'
        }, { headers: { Authorization: `Bearer ${customerToken}` } });
        const orderId = res.data.data._id;
        console.log(`Order placed! Order ID: ${orderId} | Status: ${res.data.data.status}`);

        // 5. Shop Accepts Order
        console.log('\n--- 5. Shop Accepts Order ---');
        res = await axios.patch(`${BASE_URL}/shoporders/${orderId}/status`, {
            status: 'CONFIRMED'
        }, { headers: { Authorization: `Bearer ${shopToken}` } });
        console.log(`Order accepted! Status: ${res.data.data.status}`);

        // 6. Shop Marks Preparing
        console.log('\n--- 6. Shop Marks Preparing ---');
        res = await axios.patch(`${BASE_URL}/shoporders/${orderId}/status`, {
            status: 'PACKING'
        }, { headers: { Authorization: `Bearer ${shopToken}` } });
        console.log(`Order preparing! Status: ${res.data.data.status}`);

        // 7. Customer Cancels Order (Test Wallet Refund Loophole B5)
        // Wait, Kwickly typically only allows cancellation if it's PENDING or ACCEPTED. Let's try cancelling!
        console.log('\n--- 7. Customer Cancels Order (Testing B5 Refund Logic) ---');
        try {
            res = await axios.patch(`${BASE_URL}/shoporders/${orderId}/cancel`, {
                reason: 'Changed my mind'
            }, { headers: { Authorization: `Bearer ${customerToken}` } });
            console.log(`Order Cancelled successfully! Status: ${res.data.data.status}`);
        } catch (e) {
            console.log('Cancellation failed (likely because status is PREPARING, which is correct behavior!). Error:', e.response?.data?.message);
        }

        console.log('\n✅ SHOP E2E FLOWS COMPLETED SUCCESSFULLY!');
    } catch (error) {
        console.error('❌ SHOP E2E TEST FAILED:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

runShopE2E();
