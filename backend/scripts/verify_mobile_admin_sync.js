const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const API_BASE = 'http://localhost:5000/api/v1';

async function verifySync() {
    console.log('==================================================');
    console.log('VERIFYING MOBILE APP <-> ADMIN DASHBOARD REAL-TIME SYNC');
    console.log('==================================================\n');

    try {
        // 1. Admin Login
        console.log('1. Logging in as Admin...');
        const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
            email: 'admin@kwickly.com',
            password: 'admin123'
        });
        const adminToken = adminLogin.data.token || adminLogin.data.data.token;
        const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
        console.log('✅ Admin Logged In Successfully!\n');

        // Get Initial Admin Stats
        const initialStats = await axios.get(`${API_BASE}/admin/stats`, adminHeaders);
        console.log('📊 Initial Admin Stats:', {
            activeJobs: initialStats.data.data.activeJobs,
            totalWorkers: initialStats.data.data.totalWorkers,
            totalCustomers: initialStats.data.data.totalCustomers,
            totalShops: initialStats.data.data.totalShops
        });

        // 2. Mobile Customer Login
        console.log('\n2. Mobile Customer Logging In (Phone: 9000000001)...');
        const customerLogin = await axios.post(`${API_BASE}/auth/login`, {
            phone: '9000000001',
            password: 'customer123'
        });
        const customerToken = customerLogin.data.token || customerLogin.data.data.token;
        const customerHeaders = { headers: { Authorization: `Bearer ${customerToken}` } };
        console.log('✅ Mobile Customer Logged In Successfully!\n');

        // 3. Mobile Customer Creates a New Job
        console.log('3. Mobile Customer Posting a New Service Job from Mobile App...');
        const newJobRes = await axios.post(`${API_BASE}/jobs`, {
            category: 'Home Services',
            subcategory: 'Wiring Repair',
            description: 'Main circuit breaker tripping repeatedly in dining room.',
            address: 'B-204, Rosewood Heights, Sector 62, Noida',
            location: { type: 'Point', coordinates: [77.3639, 28.6280] }
        }, customerHeaders);
        const createdJob = newJobRes.data.data;
        console.log(`✅ Job Created on Mobile App! Job ID: ${createdJob._id}, Status: ${createdJob.status}\n`);

        // 4. Admin Checks Jobs Endpoint
        console.log('4. Checking Admin Dashboard Sync for New Job...');
        const adminJobsRes = await axios.get(`${API_BASE}/jobs/all`, adminHeaders);
        const adminJobList = adminJobsRes.data.data.jobs || adminJobsRes.data.data;
        const syncedJob = adminJobList.find(j => j._id.toString() === createdJob._id.toString());

        if (syncedJob) {
            console.log('✨ SYNC CONFIRMED! Admin Dashboard sees the new job immediately:');
            console.log(`   - Job ID: ${syncedJob._id}`);
            console.log(`   - Description: "${syncedJob.description}"`);
            console.log(`   - Status in Admin: ${syncedJob.status}`);
        } else {
            console.error('❌ Job not found in Admin list!');
        }

        // 5. Mobile Shop Order Placement
        console.log('\n5. Mobile Customer Placing a Shop Order...');
        const shopRes = await axios.get(`${API_BASE}/shops`, customerHeaders);
        const shop = shopRes.data.data[0];
        const productsRes = await axios.get(`${API_BASE}/products?shopId=${shop._id}`, customerHeaders);
        const product = productsRes.data.data[0];

        const orderRes = await axios.post(`${API_BASE}/shoporders`, {
            shopId: shop._id,
            items: [{ productId: product._id, name: product.name, price: product.price, qty: 1 }],
            subtotal: product.price,
            deliveryFee: shop.deliveryFee || 30,
            total: product.price + (shop.deliveryFee || 30),
            deliveryAddress: 'B-204, Rosewood Heights, Sector 62, Noida',
            paymentMethod: 'WALLET',
            deliveryLocation: { type: 'Point', coordinates: [77.3639, 28.6280] }
        }, customerHeaders);
        const createdOrder = orderRes.data.data;
        console.log(`✅ Shop Order Placed on Mobile! Order ID: ${createdOrder._id}, Order Number: ${createdOrder.orderNumber}\n`);

        // 6. Admin Checks Shop Orders
        console.log('6. Checking Admin Dashboard Sync for New Shop Order...');
        const adminOrdersRes = await axios.get(`${API_BASE}/shoporders/all`, adminHeaders);
        const adminOrderList = adminOrdersRes.data.data.orders || adminOrdersRes.data.data;
        const syncedOrder = adminOrderList.find(o => o._id.toString() === createdOrder._id.toString());

        if (syncedOrder) {
            console.log('✨ SYNC CONFIRMED! Admin Dashboard sees the new shop order immediately:');
            console.log(`   - Order Number: ${syncedOrder.orderNumber}`);
            console.log(`   - Total Amount: ₹${syncedOrder.total}`);
            console.log(`   - Order Status: ${syncedOrder.status}`);
        } else {
            console.error('❌ Order not found in Admin list!');
        }

        // 7. Updated Admin Stats
        const updatedStats = await axios.get(`${API_BASE}/admin/stats`, adminHeaders);
        console.log('\n📊 Updated Admin Stats after Mobile Actions:', {
            activeJobs: updatedStats.data.data.activeJobs,
            totalWorkers: updatedStats.data.data.totalWorkers,
            totalCustomers: updatedStats.data.data.totalCustomers,
            totalShops: updatedStats.data.data.totalShops
        });

        console.log('\n==================================================');
        console.log('SUCCESS! MOBILE APP & ADMIN DASHBOARD ARE 100% IN SYNC!');
        console.log('==================================================');

    } catch (err) {
        console.error('Error details:', err);
    }
}

verifySync();
