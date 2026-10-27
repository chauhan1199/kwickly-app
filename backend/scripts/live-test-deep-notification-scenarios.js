/**
 * KWICKLY - Deep Secondary Notification Scenarios Test Suite
 * 
 * Tests the remaining advanced lifecycle notifications:
 * 1. Full Job Execution Chain:
 *    - Worker arrive (🚗 Worker On The Way)
 *    - Worker start with Arrival OTP (Work Started)
 *    - Worker complete (Job Completed)
 *    - Customer wallet payment with Completion OTP (Worker: Payment Received, Customer: Payment Successful)
 *    - Customer 5-star rating (⭐ New Rating Received)
 *    - Worker customer rating (⭐ You Received a Review)
 * 2. Job Cancellation with Quoting Workers (Worker & Customer Job Cancelled alerts)
 * 3. Shop Order Full Handshake:
 *    - Delivery OTP verification (Order Delivered: 🎉)
 * 4. Admin KYC Lifecycle:
 *    - Worker KYC Approval & Rejection with reason
 *    - Shop KYC Approval & Rejection with reason
 * 5. Admin Activity Audit Logs & Global Admin Notifications:
 *    - Activity log retrieval
 *    - Admin mark all read
 * 6. Subscription Notification Structure (SUBSCRIPTION enum verification)
 * 7. Automated Cleanup of all test artifacts
 */

const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Customer = require('../src/modules/customer/customer.model');
const Shop = require('../src/modules/shop/shop.model');
const Product = require('../src/modules/product/product.model');
const Job = require('../src/modules/job/job.model');
const Quote = require('../src/modules/quote/quote.model');
const ShopOrder = require('../src/modules/shoporder/shoporder.model');
const Notification = require('../src/modules/notification/notification.model');
const { notifyUser } = require('../src/helpers/notifyUser.helper');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5001/api/v1';

const log = (msg) => console.log(`[DEEP-TEST] ${msg}`);
const pass = (label) => console.log(`  ✅ PASS: ${label}`);
const fail = (label, err) => {
    console.error(`  ❌ FAIL: ${label}`, err || '');
    throw new Error(`Assertion failed: ${label}`);
};

async function main() {
    console.log('='.repeat(75));
    console.log('   🔔 KWICKLY DEEP NOTIFICATION SCENARIOS TEST SUITE');
    console.log('='.repeat(75));

    await mongoose.connect(process.env.MONGO_URI);
    log('Connected to MongoDB Atlas');

    const createdJobIds = [];
    const createdOrderIds = [];
    const createdNotificationIds = [];

    try {
        // ── AUTHENTICATIONS ───────────────────────────────────────────────────
        log('\n--- Step 1: Authenticating All 4 Roles ---');
        
        const custRes = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9876543210', password: '1111', role: 'CUSTOMER'
        });
        const customerToken = custRes.data.data.token;
        const customer = custRes.data.data.user;

        const workerRes = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9811111111', password: '1111', role: 'WORKER'
        });
        const workerToken = workerRes.data.data.token;
        const worker = workerRes.data.data.user;

        const shopRes = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9820112233', password: '1111', role: 'SHOP'
        });
        const shopToken = shopRes.data.data.token;
        const shopOwner = shopRes.data.data.user;

        const adminRes = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9999999999', password: 'admin123', role: 'ADMIN'
        });
        const adminToken = adminRes.data.data.token;
        const admin = adminRes.data.data.user;

        pass(`Authenticated Customer (${customer.name}), Worker (${worker.name}), Shop (${shopOwner.name}), Admin (${admin.name})`);

        const custHeader = { headers: { Authorization: `Bearer ${customerToken}` } };
        const workerHeader = { headers: { Authorization: `Bearer ${workerToken}` } };
        const shopHeader = { headers: { Authorization: `Bearer ${shopToken}` } };
        const adminHeader = { headers: { Authorization: `Bearer ${adminToken}` } };

        // Pre-test active jobs cleanup
        await Job.updateMany(
            { customerId: customer._id, status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS'] } },
            { $set: { status: 'CANCELLED', cancelReason: 'Deep test setup' } }
        );

        // ── SCENARIO 1: FULL JOB EXECUTION CHAIN ──────────────────────────────
        log('\n--- SCENARIO 1: Full Job Execution Chain to Completion & Dual Ratings ---');

        // 1a. Customer creates job
        const jobRes = await axios.post(`${BASE_URL}/jobs`, {
            category: 'Plumbing Service',
            subcategory: 'Pipe Leakage',
            description: 'Deep notification test: emergency pipe repair',
            location: { type: 'Point', coordinates: [77.3615, 28.6255] },
            addressDetails: { flat: 'Flat 101', area: 'Sector 62', city: 'Noida', pincode: '201301' }
        }, custHeader);
        const job = jobRes.data.data;
        createdJobIds.push(job._id);
        pass(`Job created: ${job._id}`);

        // 1b. Worker quotes
        const quoteRes = await axios.post(`${BASE_URL}/quotes`, {
            jobId: job._id,
            amount: 250,
            description: 'Arriving with tools',
            timeToReach: '10 mins',
            workerLocation: { type: 'Point', coordinates: [77.3615, 28.6255] }
        }, workerHeader);
        const quote = quoteRes.data.data;
        pass(`Worker placed quote: ₹${quote.amount}`);

        // 1c. Customer accepts quote
        await axios.patch(`${BASE_URL}/quotes/${quote._id}/accept`, {}, custHeader);
        pass('Customer accepted quote');

        // Fetch fresh job to get arrivalOtp and completionOtp
        const freshJobDoc = await Job.findById(job._id).select('+security');
        const arrivalOtp = freshJobDoc.security.arrivalOtp;
        const completionOtp = freshJobDoc.security.completionOtp;

        // 1d. Worker arrives (ARRIVING)
        await axios.post(`${BASE_URL}/jobs/${job._id}/arrive`, {}, workerHeader);
        await new Promise(r => setTimeout(r, 600));

        // Check Customer notification: "🚗 Worker On The Way"
        const custNotifsAfterArrive = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const arriveNotif = custNotifsAfterArrive.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.title.includes('Worker On The Way')
        );
        if (!arriveNotif) fail('Customer did not receive "Worker On The Way" notification');
        pass(`Customer received Arrival notification: "${arriveNotif.title}"`);

        // 1e. Worker starts job with Arrival OTP
        await axios.post(`${BASE_URL}/jobs/${job._id}/start`, {
            arrivalOtp,
            currentCoordinates: [77.3615, 28.6255]
        }, workerHeader);
        await new Promise(r => setTimeout(r, 600));

        // Check Customer notification: "Work Started"
        const custNotifsAfterStart = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const startNotif = custNotifsAfterStart.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.title.includes('Work Started')
        );
        if (!startNotif) fail('Customer did not receive "Work Started" notification');
        pass(`Customer received Work Started notification: "${startNotif.title}"`);

        // 1f. Worker completes job
        await axios.post(`${BASE_URL}/jobs/${job._id}/complete`, {
            report: 'Leakage fixed, washer replaced',
            media: []
        }, workerHeader);
        await new Promise(r => setTimeout(r, 600));

        // Check Customer notification: "Job Completed"
        const custNotifsAfterComplete = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const completeNotif = custNotifsAfterComplete.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.title.includes('Job Completed')
        );
        if (!completeNotif) fail('Customer did not receive "Job Completed" notification');
        pass(`Customer received Job Completed notification: "${completeNotif.title}"`);

        // 1g. Customer pays via Wallet with Completion OTP
        await axios.post(`${BASE_URL}/jobs/${job._id}/pay`, {
            method: 'WALLET',
            completionOtp
        }, custHeader);
        await new Promise(r => setTimeout(r, 600));

        // Verify Worker received "Payment Received"
        const workerNotifsAfterPay = await axios.get(`${BASE_URL}/notifications/my`, workerHeader);
        const workerPayNotif = workerNotifsAfterPay.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.title.includes('Payment Received')
        );
        if (!workerPayNotif) fail('Worker did not receive "Payment Received" notification');
        pass(`Worker received Payment Received notification: "${workerPayNotif.title}"`);

        // Verify Customer received "Payment Successful"
        const custNotifsAfterPay = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const custPayNotif = custNotifsAfterPay.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.title.includes('Payment Successful')
        );
        if (!custPayNotif) fail('Customer did not receive "Payment Successful" notification');
        pass(`Customer received Payment Successful notification: "${custPayNotif.title}"`);

        // 1h. Customer rates Worker (5 stars)
        await axios.post(`${BASE_URL}/jobs/${job._id}/rate`, {
            score: 5,
            review: 'Excellent service and quick fix!'
        }, custHeader);
        await new Promise(r => setTimeout(r, 600));

        // Verify Worker received "⭐ New Rating Received"
        const workerNotifsAfterRate = await axios.get(`${BASE_URL}/notifications/my`, workerHeader);
        const workerRateNotif = workerNotifsAfterRate.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.action === 'RATING_RECEIVED'
        );
        if (!workerRateNotif) fail('Worker did not receive "New Rating Received" notification');
        pass(`Worker received Rating notification: "${workerRateNotif.title}" (Score: 5★)`);

        // 1i. Worker rates Customer (5 stars)
        await axios.post(`${BASE_URL}/jobs/${job._id}/rate-customer`, {
            score: 5,
            review: 'Polite customer, clear instructions'
        }, workerHeader);
        await new Promise(r => setTimeout(r, 600));

        // Verify Customer received review notification
        const custNotifsAfterWorkerRate = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const custReviewNotif = custNotifsAfterWorkerRate.data.data.notifications.find(n => 
            String(n.entityId) === String(job._id) && n.title.includes('Received a Review')
        );
        if (!custReviewNotif) fail('Customer did not receive review notification');
        pass(`Customer received Review notification: "${custReviewNotif.title}"`);

        // ── SCENARIO 2: JOB CANCELLATION NOTIFICATIONS ─────────────────────────
        log('\n--- SCENARIO 2: Job Cancellation with Quoting & Assigned Workers ---');

        const job2Res = await axios.post(`${BASE_URL}/jobs`, {
            category: 'Plumbing Service',
            subcategory: 'Pipe Leakage',
            description: 'Cancel test job',
            location: { type: 'Point', coordinates: [77.3615, 28.6255] },
            addressDetails: { flat: 'Flat 202', area: 'Sector 62', city: 'Noida', pincode: '201301' }
        }, custHeader);
        const job2 = job2Res.data.data;
        createdJobIds.push(job2._id);

        // Worker quotes on job 2
        await axios.post(`${BASE_URL}/quotes`, {
            jobId: job2._id,
            amount: 300,
            description: 'Ready to arrive',
            timeToReach: '10 mins',
            workerLocation: { type: 'Point', coordinates: [77.3615, 28.6255] }
        }, workerHeader);

        // Customer cancels job 2
        await axios.patch(`${BASE_URL}/jobs/${job2._id}/cancel`, {
            reason: 'Issue resolved by building maintenance'
        }, custHeader);
        await new Promise(r => setTimeout(r, 600));

        // Verify Customer receives "Job Cancelled"
        const custNotifsCancel = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const custCancelNotif = custNotifsCancel.data.data.notifications.find(n => 
            String(n.entityId) === String(job2._id) && n.title.includes('Job Cancelled')
        );
        if (!custCancelNotif) fail('Customer did not receive Job Cancelled notification');
        pass(`Customer received Job Cancelled notification: "${custCancelNotif.title}"`);

        // Verify Worker receives "Job Cancelled"
        const workerNotifsCancel = await axios.get(`${BASE_URL}/notifications/my`, workerHeader);
        const workerCancelNotif = workerNotifsCancel.data.data.notifications.find(n => 
            String(n.entityId) === String(job2._id) && n.title.includes('Job Cancelled')
        );
        if (!workerCancelNotif) fail('Quoting Worker did not receive Job Cancelled notification');
        pass(`Quoting Worker received Job Cancelled notification: "${workerCancelNotif.title}"`);

        // ── SCENARIO 3: SHOP ORDER DELIVERY HANDSHAKE WITH OTP ────────────────
        log('\n--- SCENARIO 3: Shop Order Delivery Handshake with Delivery OTP ---');

        const shopDoc = await Shop.findOne({ ownerId: shopOwner._id });
        const productDoc = await Product.findOne({ shopId: shopDoc._id, stock: { $gte: 2 } });

        const orderRes = await axios.post(`${BASE_URL}/shoporders`, {
            shopId: shopDoc._id.toString(),
            items: [{
                productId: productDoc._id.toString(),
                name: productDoc.name,
                price: productDoc.price,
                qty: 2
            }],
            deliveryAddress: 'Chandkheda, Ahmedabad, Gujarat 382424',
            deliveryLocation: {
                type: 'Point',
                coordinates: shopDoc.location?.coordinates || [72.5741106, 23.122274]
            },
            paymentMethod: 'WALLET'
        }, custHeader);
        const order = orderRes.data.data;
        createdOrderIds.push(order._id);
        pass(`Shop order created: #${order.orderNumber || order._id}`);

        // Progress order to OUT_FOR_DELIVERY
        await axios.patch(`${BASE_URL}/shoporders/${order._id}/status`, { status: 'CONFIRMED' }, shopHeader);
        await axios.patch(`${BASE_URL}/shoporders/${order._id}/status`, { status: 'PACKING' }, shopHeader);
        await axios.patch(`${BASE_URL}/shoporders/${order._id}/status`, { status: 'OUT_FOR_DELIVERY' }, shopHeader);

        // Fetch fresh order to get delivery OTP
        const freshOrderDoc = await ShopOrder.findById(order._id);
        const deliveryOtp = freshOrderDoc.deliveryOtp;
        pass(`Order is OUT_FOR_DELIVERY (Delivery OTP: ${deliveryOtp})`);

        // Deliver order with valid delivery OTP
        await axios.patch(`${BASE_URL}/shoporders/${order._id}/status`, {
            status: 'DELIVERED',
            otp: deliveryOtp
        }, shopHeader);
        await new Promise(r => setTimeout(r, 600));

        // Verify Customer received "Order Delivered" (ORDER_DELIVERED)
        const custNotifsDelivered = await axios.get(`${BASE_URL}/notifications/my`, custHeader);
        const deliveredNotif = custNotifsDelivered.data.data.notifications.find(n => 
            String(n.entityId) === String(order._id) && n.action === 'ORDER_DELIVERED'
        );
        if (!deliveredNotif) fail('Customer did not receive ORDER_DELIVERED notification');
        pass(`Customer received ORDER_DELIVERED notification: "${deliveredNotif.title}" -> "${deliveredNotif.message}"`);

        // ── SCENARIO 4: ADMIN KYC APPROVAL & REJECTION LIFECYCLE ───────────────
        log('\n--- SCENARIO 4: Admin KYC Approval & Rejection Notifications ---');

        // 4a. Reject Worker KYC with reason
        await axios.patch(`${BASE_URL}/admin/workers/${worker._id}/kyc`, {
            status: 'REJECTED',
            reason: 'Aadhaar front image is blurry'
        }, adminHeader);
        await new Promise(r => setTimeout(r, 600));

        const workerKycRejectNotifs = await axios.get(`${BASE_URL}/notifications/my`, workerHeader);
        const workerKycRejectNotif = workerKycRejectNotifs.data.data.notifications.find(n => 
            n.action === 'KYC' && n.title.includes('rejected') && n.message.includes('blurry')
        );
        if (!workerKycRejectNotif) fail('Worker did not receive KYC rejection notification with reason');
        pass(`Worker received KYC Rejection notification: "${workerKycRejectNotif.title}" (${workerKycRejectNotif.message})`);

        // 4b. Re-approve Worker KYC
        await axios.patch(`${BASE_URL}/admin/workers/${worker._id}/kyc`, {
            status: 'APPROVED'
        }, adminHeader);
        await new Promise(r => setTimeout(r, 600));

        const workerKycApproveNotifs = await axios.get(`${BASE_URL}/notifications/my`, workerHeader);
        const workerKycApproveNotif = workerKycApproveNotifs.data.data.notifications.find(n => 
            n.action === 'KYC' && n.title.includes('approved')
        );
        if (!workerKycApproveNotif) fail('Worker did not receive KYC approval notification');
        pass(`Worker received KYC Approval notification: "${workerKycApproveNotif.title}"`);

        // 4c. Reject Shop KYC with reason
        await axios.patch(`${BASE_URL}/admin/shops/${shopDoc._id}/kyc`, {
            status: 'REJECTED',
            reason: 'Shop trade license expired'
        }, adminHeader);
        await new Promise(r => setTimeout(r, 600));

        const shopKycRejectNotifs = await axios.get(`${BASE_URL}/notifications/my`, shopHeader);
        const shopKycRejectNotif = shopKycRejectNotifs.data.data.notifications.find(n => 
            n.action === 'KYC' && n.title.includes('rejected') && n.message.includes('expired')
        );
        if (!shopKycRejectNotif) fail('Shop Owner did not receive KYC rejection notification with reason');
        pass(`Shop Owner received KYC Rejection notification: "${shopKycRejectNotif.title}" (${shopKycRejectNotif.message})`);

        // 4d. Re-approve Shop KYC
        await axios.patch(`${BASE_URL}/admin/shops/${shopDoc._id}/kyc`, {
            status: 'APPROVED'
        }, adminHeader);
        await new Promise(r => setTimeout(r, 600));

        const shopKycApproveNotifs = await axios.get(`${BASE_URL}/notifications/my`, shopHeader);
        const shopKycApproveNotif = shopKycApproveNotifs.data.data.notifications.find(n => 
            n.action === 'KYC' && n.title.includes('approved')
        );
        if (!shopKycApproveNotif) fail('Shop Owner did not receive KYC approval notification');
        pass(`Shop Owner received KYC Approval notification: "${shopKycApproveNotif.title}"`);

        // ── SCENARIO 5: ADMIN ACTIVITY AUDIT LOGS ─────────────────────────────
        log('\n--- SCENARIO 5: Admin Activity Audit Trail & Admin Notifications ---');

        const activityLogsRes = await axios.get(`${BASE_URL}/admin/notifications/activity-logs`, adminHeader);
        if (activityLogsRes.data.status !== 'success' || !Array.isArray(activityLogsRes.data.data.logs)) {
            fail('Failed to fetch admin activity logs');
        }
        const recentLogs = activityLogsRes.data.data.logs;
        pass(`Admin activity logs fetched successfully (${recentLogs.length} entries recorded)`);
        const kycLog = recentLogs.find(l => l.action === 'KYC');
        if (kycLog) pass(`Verified KYC audit entry in admin activity log: "${kycLog.title}" - "${kycLog.message}"`);

        // Admin marks all notifications as read
        await axios.patch(`${BASE_URL}/admin/notifications/read-all`, {}, adminHeader);
        pass('Admin marked all notifications as read via PATCH /admin/notifications/read-all');

        // ── SCENARIO 6: SUBSCRIPTION ENUM & DIRECT PERSISTENCE ────────────────
        log('\n--- SCENARIO 6: Subscription Notification Validation ---');

        // Test triggering a subscription notification directly using notifyUser
        await notifyUser({
            userId: worker._id,
            title: '⏳ Subscription Expiring Soon',
            message: 'Your worker subscription expires in 3 days! Top up to continue receiving job leads.',
            action: 'SUBSCRIPTION_EXPIRING',
            entityType: 'SUBSCRIPTION',
            targetRole: 'WORKER'
        });

        const workerSubNotifs = await axios.get(`${BASE_URL}/notifications/my`, workerHeader);
        const subNotif = workerSubNotifs.data.data.notifications.find(n => 
            n.entityType === 'SUBSCRIPTION' && n.action === 'SUBSCRIPTION_EXPIRING'
        );
        if (!subNotif) fail('SUBSCRIPTION notification failed to persist with valid entityType!');
        pass(`SUBSCRIPTION notification persisted with full enum integrity: "${subNotif.title}" (entityType: ${subNotif.entityType})`);
        createdNotificationIds.push(subNotif._id);

        // ── CLEANUP TEST RECORDS ──────────────────────────────────────────────
        log('\n--- CLEANUP: Removing Created Test Artifacts ---');
        if (createdJobIds.length > 0) {
            await Job.deleteMany({ _id: { $in: createdJobIds } });
            await Quote.deleteMany({ jobId: { $in: createdJobIds } });
            log(`Cleaned up ${createdJobIds.length} test jobs`);
        }
        if (createdOrderIds.length > 0) {
            await ShopOrder.deleteMany({ _id: { $in: createdOrderIds } });
            log(`Cleaned up ${createdOrderIds.length} test shop orders`);
        }
        if (createdNotificationIds.length > 0) {
            await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
            log('Cleaned up test notifications');
        }
        pass('All test records cleanly removed from database');

        console.log('\n' + '='.repeat(75));
        console.log('   🎉 ALL DEEP NOTIFICATION SCENARIOS PASSED 100% CLEANLY!');
        console.log('='.repeat(75));

    } catch (err) {
        if (err.response) {
            console.error('API Error Response:', err.response.status, err.response.data);
        }
        throw err;
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(err => {
    console.error('Deep Test Suite Failed:', err);
    process.exit(1);
});
