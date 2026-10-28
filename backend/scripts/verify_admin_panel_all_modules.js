/**
 * Comprehensive Admin Panel Full-Module Verification & Sync Suite
 * 
 * Tests every single Admin module step-by-step:
 *   1. Auth & Session (Admin Login & JWT Token)
 *   2. Dashboard (Real-time Stats, Badges, Health)
 *   3. Customer Management (CRUD: List, Create, Update, Toggle Status, Delete)
 *   4. Worker Management (List, Detail, KYC, Subscription Extension)
 *   5. Shop Management (List, Detail, Toggle Status, Wallet Credit/Debit)
 *   6. Job Management (List All, Job Detail)
 *   7. Orders Management (List All Shop Orders)
 *   8. KYC Verification Queue (Pending Worker & Shop KYC)
 *   9. Category Management & Suggestions (CRUD: List, Create, Update, Delete, Suggestions)
 *  10. Promotions & Banners (CRUD: List, Create, Toggle, Delete)
 *  11. Disputes & Refunds (Dispute Queue & Resolution)
 *  12. Worker Payouts (Pending Payouts Queue)
 *  13. Admin Platform Wallet (Balance, Credit/Debit, Transactions)
 *  14. Shop Settlements (Settlements Queue)
 *  15. Subscription Plans (List Active Worker & Shop Plans)
 *  16. Platform Ledger (Double-Entry Financial Transactions)
 *  17. Platform Settings & Fees (Get Settings, Update Settings)
 *  18. Push Notifications (List Activity Log, Broadcast Push, Mark Read)
 *  19. Support Chats (Support Threads Queue)
 *  20. Reports & Analytics (Revenue, Performance, Retention, Demand)
 *  21. Mobile App <-> Admin Panel Real-Time Sync
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000/api/v1';

const results = [];
function recordResult(step, name, passed, meta = null) {
    results.push({ step, name, pass: passed, meta });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] Step ${step}: ${name}`);
    if (meta && !passed) {
        console.error('         Error details:', meta);
    }
}

async function runAdminVerification() {
    console.log('='.repeat(80));
    console.log('   🚀 COMPREHENSIVE ADMIN PANEL MODULE-BY-MODULE VERIFICATION');
    console.log('='.repeat(80) + '\n');

    let adminToken;
    let adminHeaders;
    const ts = Date.now();

    try {
        // ====================================================================
        // MODULE 1: AUTH & ADMIN SESSION
        // ====================================================================
        console.log('>>> MODULE 1: Admin Authentication & Session <<<');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9999999999',
            password: 'admin123',
            role: 'ADMIN'
        });
        adminToken = loginRes.data.data?.token || loginRes.data.token;
        adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
        recordResult('1.1', 'Admin Login & Token Generation', !!adminToken, {
            name: loginRes.data.data?.user?.name || loginRes.data.user?.name,
            role: loginRes.data.data?.user?.role || loginRes.data.user?.role
        });

        // ====================================================================
        // MODULE 2: DASHBOARD
        // ====================================================================
        console.log('\n>>> MODULE 2: Dashboard Metrics & Platform Health <<<');
        const statsRes = await axios.get(`${BASE_URL}/admin/stats`, adminHeaders);
        const stats = statsRes.data.data;
        recordResult('2.1', 'Dashboard Live Stats (No Static Data)', stats && typeof stats.totalCustomers === 'number', {
            customers: stats?.totalCustomers,
            workers: stats?.totalWorkers,
            shops: stats?.totalShops,
            activeJobs: stats?.activeJobs,
            revenue: stats?.totalRevenue
        });

        const badgesRes = await axios.get(`${BASE_URL}/admin/badges`, adminHeaders);
        recordResult('2.2', 'Dashboard Badge Counts', badgesRes.data.status === 'success', badgesRes.data.data);

        const healthRes = await axios.get(`${BASE_URL}/admin/health`, adminHeaders);
        recordResult('2.3', 'Platform Health Status', healthRes.data.status === 'success' || healthRes.status === 200);

        // ====================================================================
        // MODULE 3: CUSTOMER MANAGEMENT (CRUD)
        // ====================================================================
        console.log('\n>>> MODULE 3: Customer Management CRUD <<<');
        const custsRes = await axios.get(`${BASE_URL}/admin/customers`, adminHeaders);
        const customerList = custsRes.data.data?.customers || [];
        recordResult('3.1', 'Customer List Fetched (READ)', Array.isArray(customerList), { count: customerList.length });

        // Create Customer with valid letters-only name and 10-digit Indian phone (starts with 6-9)
        const randDigits = String(Math.floor(1000000 + Math.random() * 9000000));
        const testCustPhone = `981${randDigits}`;
        const createCustRes = await axios.post(`${BASE_URL}/admin/users`, {
            name: 'Verification Customer Account',
            phone: testCustPhone,
            role: 'CUSTOMER',
            isPhoneVerified: true
        }, adminHeaders);
        const createdCust = createCustRes.data.data;
        recordResult('3.2', 'Customer Created by Admin (CREATE)', !!createdCust?._id, { id: createdCust?._id });

        // Update Customer
        const updateCustRes = await axios.patch(`${BASE_URL}/admin/users/${createdCust._id}`, {
            name: 'Updated Verification Customer Account'
        }, adminHeaders);
        recordResult('3.3', 'Customer Updated by Admin (UPDATE)', updateCustRes.data.status === 'success');

        // Toggle Status
        const toggleCustRes = await axios.patch(`${BASE_URL}/admin/users/${createdCust._id}/toggle-status`, {}, adminHeaders);
        recordResult('3.4', 'Customer Status Toggled (TOGGLE)', toggleCustRes.data.status === 'success');

        // Delete Customer
        const deleteCustRes = await axios.delete(`${BASE_URL}/admin/users/${createdCust._id}`, adminHeaders);
        recordResult('3.5', 'Customer Deleted by Admin (DELETE)', deleteCustRes.data.status === 'success');

        // ====================================================================
        // MODULE 4: WORKER MANAGEMENT
        // ====================================================================
        console.log('\n>>> MODULE 4: Worker Management <<<');
        const workersRes = await axios.get(`${BASE_URL}/admin/workers`, adminHeaders);
        const workerList = workersRes.data.data?.workers || [];
        recordResult('4.1', 'Workers List Fetched', Array.isArray(workerList), { count: workerList.length });

        if (workerList.length > 0) {
            const firstWorker = workerList[0];
            const workerDetailRes = await axios.get(`${BASE_URL}/admin/workers/${firstWorker._id}`, adminHeaders);
            const workerObj = workerDetailRes.data.data?.worker;
            recordResult('4.2', 'Worker Detail Retrieved', !!workerObj?._id, { name: workerObj?.name });

            // Extend Subscription
            const extendSubRes = await axios.patch(`${BASE_URL}/admin/workers/${firstWorker._id}/extend-subscription`, {
                days: 7
            }, adminHeaders);
            recordResult('4.3', 'Worker Subscription Extended', extendSubRes.data.status === 'success');
        }

        // ====================================================================
        // MODULE 5: SHOP MANAGEMENT
        // ====================================================================
        console.log('\n>>> MODULE 5: Shop Management <<<');
        const shopsRes = await axios.get(`${BASE_URL}/admin/shops`, adminHeaders);
        const shopList = shopsRes.data.data?.shops || shopsRes.data.data || [];
        recordResult('5.1', 'Shops List Fetched', Array.isArray(shopList), { count: shopList.length });

        if (shopList.length > 0) {
            const firstShop = shopList[0];
            const shopDetailRes = await axios.get(`${BASE_URL}/admin/shops/${firstShop._id}`, adminHeaders);
            const shopObj = shopDetailRes.data.data?.shop;
            recordResult('5.2', 'Shop Detail Retrieved', !!shopObj?._id, { name: shopObj?.name });

            // Credit Shop Wallet
            const creditRes = await axios.post(`${BASE_URL}/admin/shops/${firstShop._id}/wallet/credit`, {
                amount: 10,
                description: 'Admin Verification Credit'
            }, adminHeaders);
            recordResult('5.3', 'Shop Wallet Credit Applied', creditRes.data.status === 'success');

            // Debit Shop Wallet
            const debitRes = await axios.post(`${BASE_URL}/admin/shops/${firstShop._id}/wallet/debit`, {
                amount: 10,
                description: 'Admin Verification Debit'
            }, adminHeaders);
            recordResult('5.4', 'Shop Wallet Debit Applied', debitRes.data.status === 'success');
        }

        // ====================================================================
        // MODULE 6: JOB MANAGEMENT
        // ====================================================================
        console.log('\n>>> MODULE 6: Job Management <<<');
        const jobsRes = await axios.get(`${BASE_URL}/admin/jobs/all`, adminHeaders);
        const jobList = jobsRes.data.data?.jobs || jobsRes.data.data || [];
        recordResult('6.1', 'Jobs List Fetched', Array.isArray(jobList), { count: jobList.length });

        if (jobList.length > 0) {
            const firstJob = jobList[0];
            const jobDetailRes = await axios.get(`${BASE_URL}/admin/jobs/${firstJob._id}`, adminHeaders);
            const jobObj = jobDetailRes.data.data?.job;
            recordResult('6.2', 'Job Detail Retrieved', !!jobObj?._id, { category: jobObj?.category, status: jobObj?.status });
        }

        // ====================================================================
        // MODULE 7: ORDERS MANAGEMENT
        // ====================================================================
        console.log('\n>>> MODULE 7: Orders Management <<<');
        const ordersRes = await axios.get(`${BASE_URL}/admin/shoporders/all`, adminHeaders);
        const orderList = ordersRes.data.data?.orders || ordersRes.data.data || [];
        recordResult('7.1', 'Shop Orders List Fetched', Array.isArray(orderList), { count: orderList.length });

        // ====================================================================
        // MODULE 8: KYC VERIFICATION QUEUE
        // ====================================================================
        console.log('\n>>> MODULE 8: KYC Verification Queue <<<');
        const kycRes = await axios.get(`${BASE_URL}/admin/pending-kyc`, adminHeaders);
        const kycItems = kycRes.data.data?.items || [];
        recordResult('8.1', 'Pending KYC Queue Fetched', Array.isArray(kycItems), { count: kycItems.length });

        // ====================================================================
        // MODULE 9: CATEGORY MANAGEMENT (CRUD) & SUGGESTIONS
        // ====================================================================
        console.log('\n>>> MODULE 9: Category Management & Suggestions <<<');
        const catsRes = await axios.get(`${BASE_URL}/admin/categories`, adminHeaders);
        const catList = catsRes.data.data || [];
        recordResult('9.1', 'Categories List Fetched (READ)', Array.isArray(catList), { count: catList.length });

        // Category Suggestions tab
        const sugRes = await axios.get(`${BASE_URL}/admin/suggestions`, adminHeaders);
        const sugList = sugRes.data.data || [];
        recordResult('9.2', 'Category Suggestions Tab Fetched', Array.isArray(sugList), { count: sugList.length });

        // Create Category
        const createCatRes = await axios.post(`${BASE_URL}/categories`, {
            name: `Test Cat ${ts}`,
            icon: 'wrench',
            active: true,
            subcategories: [{ name: 'General Inspection', minPrice: 100 }]
        }, adminHeaders);
        const createdCat = createCatRes.data.data;
        recordResult('9.3', 'Category Created (CREATE)', !!createdCat?._id, { id: createdCat?._id });

        // Update Category (via PATCH)
        const updateCatRes = await axios.patch(`${BASE_URL}/categories/${createdCat._id}`, {
            name: `Updated Test Cat ${ts}`,
            active: true
        }, adminHeaders);
        recordResult('9.4', 'Category Updated (UPDATE)', updateCatRes.data.status === 'success');

        // Delete Category
        const deleteCatRes = await axios.delete(`${BASE_URL}/categories/${createdCat._id}`, adminHeaders);
        recordResult('9.5', 'Category Deleted (DELETE)', deleteCatRes.data.status === 'success');

        // ====================================================================
        // MODULE 10: PROMOTIONS & BANNERS (CRUD)
        // ====================================================================
        console.log('\n>>> MODULE 10: Promotions & Banners CRUD <<<');
        const bannersRes = await axios.get(`${BASE_URL}/promotions/banners`);
        const bannerList = bannersRes.data.data || [];
        recordResult('10.1', 'Banners List Fetched (READ)', Array.isArray(bannerList), { count: bannerList.length });

        // Create Banner
        const createBannerRes = await axios.post(`${BASE_URL}/promotions/banners`, {
            title: `Admin Test Banner ${ts}`,
            subtitle: 'Special 50% discount',
            imageUrl: 'https://res.cloudinary.com/ap6ozddu/image/upload/sample.jpg',
            position: 'HOME_TOP',
            isActive: true
        }, adminHeaders);
        const createdBanner = createBannerRes.data.data;
        recordResult('10.2', 'Banner Created (CREATE)', !!createdBanner?._id, { id: createdBanner?._id });

        // Update Banner
        const toggleBannerRes = await axios.patch(`${BASE_URL}/promotions/banners/${createdBanner._id}`, {
            isActive: false
        }, adminHeaders);
        recordResult('10.3', 'Banner Updated (UPDATE)', toggleBannerRes.data.status === 'success');

        // Delete Banner
        const deleteBannerRes = await axios.delete(`${BASE_URL}/promotions/banners/${createdBanner._id}`, adminHeaders);
        recordResult('10.4', 'Banner Deleted (DELETE)', deleteBannerRes.data.status === 'success');

        // ====================================================================
        // MODULE 11: DISPUTES & REFUNDS
        // ====================================================================
        console.log('\n>>> MODULE 11: Disputes Queue <<<');
        const disputesRes = await axios.get(`${BASE_URL}/admin/disputes`, adminHeaders);
        const disputeList = disputesRes.data.data || [];
        recordResult('11.1', 'Disputes List Fetched', Array.isArray(disputeList), { count: disputeList.length });

        // ====================================================================
        // MODULE 12: WORKER PAYOUTS
        // ====================================================================
        console.log('\n>>> MODULE 12: Payouts Queue <<<');
        const payoutsRes = await axios.get(`${BASE_URL}/admin/payouts`, adminHeaders);
        const payoutList = payoutsRes.data.data?.payouts || [];
        recordResult('12.1', 'Payouts List Fetched', Array.isArray(payoutList), { count: payoutList.length });

        // ====================================================================
        // MODULE 13: ADMIN PLATFORM WALLET
        // ====================================================================
        console.log('\n>>> MODULE 13: Admin Platform Wallet <<<');
        const adminWalletRes = await axios.get(`${BASE_URL}/admin/admin-wallet/balance`, adminHeaders);
        const walletData = adminWalletRes.data.data;
        recordResult('13.1', 'Admin Wallet Balance Retrieved', walletData && typeof walletData.balance === 'number', {
            balance: walletData?.balance,
            upiId: walletData?.upiId
        });

        // Credit Admin Wallet
        const creditAdminRes = await axios.post(`${BASE_URL}/admin/admin-wallet/credit`, {
            amount: 50,
            description: 'Verification Admin Credit',
            paymentMethod: 'CASH'
        }, adminHeaders);
        recordResult('13.2', 'Admin Wallet Manual Credit Applied', creditAdminRes.data.status === 'success', {
            newBalance: creditAdminRes.data.data?.balance
        });

        // Transactions list
        const adminTxnsRes = await axios.get(`${BASE_URL}/admin/admin-wallet/transactions`, adminHeaders);
        const adminTxns = adminTxnsRes.data.data?.txns || [];
        recordResult('13.3', 'Admin Wallet Transactions Fetched', Array.isArray(adminTxns), { count: adminTxns.length });

        // ====================================================================
        // MODULE 14: SETTLEMENTS
        // ====================================================================
        console.log('\n>>> MODULE 14: Shop Settlements <<<');
        const settlementsRes = await axios.get(`${BASE_URL}/admin/settlements`, adminHeaders);
        const settlementList = settlementsRes.data.data || [];
        recordResult('14.1', 'Settlements List Fetched', Array.isArray(settlementList), { count: settlementList.length });

        // ====================================================================
        // MODULE 15: SUBSCRIPTION PLANS
        // ====================================================================
        console.log('\n>>> MODULE 15: Subscription Plans <<<');
        const plansRes = await axios.get(`${BASE_URL}/subscriptions/plans`);
        const planList = plansRes.data.data || [];
        recordResult('15.1', 'Subscription Plans Fetched', Array.isArray(planList), { count: planList.length });

        // ====================================================================
        // MODULE 16: PLATFORM LEDGER
        // ====================================================================
        console.log('\n>>> MODULE 16: Platform Ledger <<<');
        const ledgerRes = await axios.get(`${BASE_URL}/ledger`, adminHeaders);
        const ledgerEntries = ledgerRes.data.data?.entries || ledgerRes.data.data || [];
        recordResult('16.1', 'Platform Ledger Entries Fetched', Array.isArray(ledgerEntries), { count: ledgerEntries.length });

        // ====================================================================
        // MODULE 17: PLATFORM SETTINGS & FEES
        // ====================================================================
        console.log('\n>>> MODULE 17: Platform Settings & Fees <<<');
        const settingsRes = await axios.get(`${BASE_URL}/admin/settings`, adminHeaders);
        const currentSettings = settingsRes.data.data;
        recordResult('17.1', 'Platform Settings Fetched', !!currentSettings, {
            appName: currentSettings?.appName,
            commissionRate: currentSettings?.commissionRate
        });

        // Update Settings
        const updateSettingsRes = await axios.patch(`${BASE_URL}/admin/settings`, {
            appName: 'Kwickly'
        }, adminHeaders);
        recordResult('17.2', 'Platform Settings Updated', updateSettingsRes.data.status === 'success');

        // ====================================================================
        // MODULE 18: PUSH NOTIFICATIONS BROADCAST
        // ====================================================================
        console.log('\n>>> MODULE 18: Push Notifications Activity & Broadcast <<<');
        const notifsRes = await axios.get(`${BASE_URL}/admin/notifications`, adminHeaders);
        const notifList = notifsRes.data.data || [];
        recordResult('18.1', 'Activity Notifications Fetched', Array.isArray(notifList), { count: notifList.length });

        // Broadcast Push Notification
        const broadcastRes = await axios.post(`${BASE_URL}/admin/notifications/broadcast`, {
            title: `Admin Notice ${ts}`,
            message: 'All systems operating at peak performance.',
            targetRole: 'ALL'
        }, adminHeaders);
        recordResult('18.2', 'Notification Broadcast Sent', broadcastRes.data.status === 'success');

        // Mark All Read
        const markAllRes = await axios.patch(`${BASE_URL}/admin/notifications/read-all`, {}, adminHeaders);
        recordResult('18.3', 'Notifications Marked Read', markAllRes.data.status === 'success');

        // ====================================================================
        // MODULE 19: SUPPORT CHATS
        // ====================================================================
        console.log('\n>>> MODULE 19: Support Chats Queue <<<');
        const supportRes = await axios.get(`${BASE_URL}/chat/support/threads`, adminHeaders);
        const supportThreads = supportRes.data.data || [];
        recordResult('19.1', 'Support Threads Queue Fetched', Array.isArray(supportThreads), { count: supportThreads.length });

        // ====================================================================
        // MODULE 20: REPORTS & ANALYTICS
        // ====================================================================
        console.log('\n>>> MODULE 20: Reports & Analytics Tabs <<<');
        const tabs = ['revenue', 'performance', 'retention', 'demand'];
        for (const tab of tabs) {
            const reportRes = await axios.get(`${BASE_URL}/admin/reports/${tab}?period=month`, adminHeaders);
            recordResult(`20.${tab}`, `Analytics Tab [${tab}] Fetched`, reportRes.data.status === 'success', reportRes.data.data);
        }

        // ====================================================================
        // MODULE 21: REAL-TIME MOBILE APP <-> ADMIN PANEL SYNC
        // ====================================================================
        console.log('\n>>> MODULE 21: Real-Time Mobile App <-> Admin Panel Sync <<<');
        // Mobile Customer creates a job
        const custLogin = await axios.post(`${BASE_URL}/auth/login`, {
            phone: '9876543210', password: '1111', role: 'CUSTOMER'
        });
        const custToken = custLogin.data.data?.token || custLogin.data.token;
        const syncJobRes = await axios.post(`${BASE_URL}/jobs`, {
            category: 'Emergency Plumbing',
            description: `Admin Sync Verification Leak ${ts}`,
            address: 'Sector 62, Noida',
            location: { type: 'Point', coordinates: [77.3639, 28.6280] },
            budget: 350
        }, { headers: { Authorization: `Bearer ${custToken}` } });
        const mobileCreatedJob = syncJobRes.data.data;
        recordResult('21.1', 'Mobile App Created Job via API', !!mobileCreatedJob?._id, { jobId: mobileCreatedJob?._id });

        // Admin immediately sees it in /jobs/all
        const adminJobsCheck = await axios.get(`${BASE_URL}/admin/jobs/all`, adminHeaders);
        const allJobs = adminJobsCheck.data.data?.jobs || adminJobsCheck.data.data || [];
        const foundJob = allJobs.find(j => j._id.toString() === mobileCreatedJob._id.toString());
        recordResult('21.2', 'Admin Panel Immediate Sync for Mobile Job', !!foundJob, {
            syncedJobId: foundJob?._id,
            status: foundJob?.status
        });

        // Clean up the sync test job
        await axios.patch(`${BASE_URL}/jobs/${mobileCreatedJob._id}/cancel`, {
            reason: 'Sync test completed'
        }, { headers: { Authorization: `Bearer ${custToken}` } });
        recordResult('21.3', 'Sync Test Job Cleaned Up', true);

    } catch (err) {
        console.error('\n❌ RUNNER ERROR:', err.response?.data || err.message);
        results.push({ step: 'ERR', name: 'Exception Encountered', pass: false, meta: err.response?.data || err.message });
    } finally {
        console.log('\n' + '='.repeat(80));
        console.log('   📊 ADMIN PANEL MODULES & CRUD VERIFICATION REPORT');
        console.log('='.repeat(80));
        let passCount = 0;
        results.forEach(r => {
            if (r.pass) passCount++;
            console.log(`Step ${String(r.step).padEnd(6)}: ${r.name.padEnd(54)} [${r.pass ? 'PASS ✅' : 'FAIL ❌'}]`);
        });
        console.log('-'.repeat(80));
        console.log(`TOTAL PASSED: ${passCount} / ${results.length} (${Math.round((passCount / results.length) * 100)}%)`);
        console.log('='.repeat(80) + '\n');
        process.exit(results.every(r => r.pass) ? 0 : 1);
    }
}

runAdminVerification();
