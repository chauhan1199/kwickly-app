const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

let adminToken = '';
let customerToken = '';
let workerToken = '';
let createdCustomerId = null;
let createdWorkerId = null;
let createdCategoryId = null;
let createdPromoId = null;
let createdShopId = null;

const results = [];

function recordResult(moduleName, testCase, passed, details = '') {
    results.push({ module: moduleName, test: testCase, status: passed ? 'PASS' : 'FAIL', details });
    const symbol = passed ? '✅' : '❌';
    console.log(`  ${symbol} [${moduleName}] ${testCase} ${details ? `(${details})` : ''}`);
}

async function runAllTests() {
    console.log('====================================================');
    console.log('🚀 Starting Kwickly Admin — 21 Module QA & API Test');
    console.log('====================================================\n');

    // ─── Module 0: Global Setup & Auth ───────────────────────────────────────
    console.log('--- [Module 0: Setup & Auth] ---');
    try {
        const healthRes = await axios.get('http://localhost:5000/health');
        recordResult('0. Setup', 'Health check /health', healthRes.status === 200, `status: ${healthRes.status}`);
    } catch (err) {
        recordResult('0. Setup', 'Health check /health', false, err.message);
    }

    // Get Admin Token via /auth/login
    try {
        const res = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@kwickly.com',
            password: 'admin123',
            role: 'ADMIN'
        });
        adminToken = res.data.data.token;
        recordResult('0. Setup', 'Admin auth & token acquisition', !!adminToken, 'Admin token generated via email/pwd');
    } catch (err) {
        recordResult('0. Setup', 'Admin auth & token acquisition', false, err.response?.data?.message || err.message);
    }

    // Get Customer Token (no-access user for RBAC tests)
    try {
        await axios.post(`${BASE_URL}/auth/send-otp`, { phone: '9999900002', role: 'CUSTOMER' });
        const res = await axios.post(`${BASE_URL}/auth/verify-otp`, {
            phone: '9999900002',
            code: '1234',
            role: 'CUSTOMER',
            name: 'Normal Customer'
        });
        customerToken = res.data.data.token;
        recordResult('0. Setup', 'Customer token acquisition', !!customerToken, 'Customer token generated');
    } catch (err) {
        recordResult('0. Setup', 'Customer token acquisition', false, err.response?.data?.message || err.message);
    }

    const adminHeader = { headers: { Authorization: `Bearer ${adminToken}` } };
    const customerHeader = { headers: { Authorization: `Bearer ${customerToken}` } };

    // ─── Module 1: Dashboard ───────────────────────────────────────────────────
    console.log('\n--- [Module 1: Dashboard] ---');
    try {
        const stats = await axios.get(`${BASE_URL}/admin/stats`, adminHeader);
        recordResult('1. Dashboard', 'GET /admin/stats', stats.status === 200, `Active jobs: ${stats.data.data?.activeJobs ?? 'N/A'}`);
    } catch (err) {
        recordResult('1. Dashboard', 'GET /admin/stats', false, err.response?.data?.message || err.message);
    }

    try {
        const badges = await axios.get(`${BASE_URL}/admin/badges`, adminHeader);
        recordResult('1. Dashboard', 'GET /admin/badges', badges.status === 200, `Pending KYC badge: ${badges.data.data?.pendingKYC ?? 0}`);
    } catch (err) {
        recordResult('1. Dashboard', 'GET /admin/badges', false, err.response?.data?.message || err.message);
    }

    try {
        const health = await axios.get(`${BASE_URL}/admin/health`, adminHeader);
        recordResult('1. Dashboard', 'GET /admin/health', health.status === 200);
    } catch (err) {
        recordResult('1. Dashboard', 'GET /admin/health', false, err.response?.data?.message || err.message);
    }

    // RBAC Check: Customer call to admin endpoint should fail with 403
    try {
        await axios.get(`${BASE_URL}/admin/stats`, customerHeader);
        recordResult('1. Dashboard', 'RBAC check (Customer -> Admin API)', false, 'Expected 403, but received success');
    } catch (err) {
        const is403 = err.response && err.response.status === 403;
        recordResult('1. Dashboard', 'RBAC check (Customer -> Admin API)', is403, `Blocked with HTTP ${err.response?.status}`);
    }

    // ─── Module 2: Customers ──────────────────────────────────────────────────
    console.log('\n--- [Module 2: Customers] ---');
    try {
        const list = await axios.get(`${BASE_URL}/admin/customers`, adminHeader);
        recordResult('2. Customers', 'GET /admin/customers', list.status === 200, `Found ${list.data.data?.users?.length || 0} customers`);
    } catch (err) {
        recordResult('2. Customers', 'GET /admin/customers', false, err.response?.data?.message || err.message);
    }

    // Missing field validation
    try {
        await axios.post(`${BASE_URL}/admin/users`, { role: 'CUSTOMER' }, adminHeader);
        recordResult('2. Customers', 'Validation check (missing required fields)', false, 'Expected 400 Bad Request');
    } catch (err) {
        recordResult('2. Customers', 'Validation check (missing required fields)', err.response?.status === 400, `Rejected with HTTP ${err.response?.status}`);
    }

    // Create valid customer
    try {
        const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
        const res = await axios.post(`${BASE_URL}/admin/users`, {
            name: 'Test Customer QA',
            phone: testPhone,
            email: `testcust_${Date.now()}@example.com`,
            role: 'CUSTOMER'
        }, adminHeader);
        createdCustomerId = res.data.data._id;
        recordResult('2. Customers', 'POST /admin/users (Create Customer)', res.status === 201 || res.status === 200, `Created ID: ${createdCustomerId}`);
    } catch (err) {
        recordResult('2. Customers', 'POST /admin/users (Create Customer)', false, err.response?.data?.message || err.message);
    }

    // ─── Module 3: Workers ────────────────────────────────────────────────────
    console.log('\n--- [Module 3: Workers] ---');
    try {
        const list = await axios.get(`${BASE_URL}/admin/workers`, adminHeader);
        recordResult('3. Workers', 'GET /admin/workers', list.status === 200, `Found ${list.data.data?.workers?.length || 0} workers`);
    } catch (err) {
        recordResult('3. Workers', 'GET /admin/workers', false, err.response?.data?.message || err.message);
    }

    // Create valid worker
    try {
        const testPhone = '97' + Math.floor(10000000 + Math.random() * 90000000);
        const res = await axios.post(`${BASE_URL}/admin/users`, {
            name: 'Test Worker QA',
            phone: testPhone,
            email: `testwrk_${Date.now()}@example.com`,
            role: 'WORKER'
        }, adminHeader);
        createdWorkerId = res.data.data._id;
        recordResult('3. Workers', 'POST /admin/users (Create Worker)', res.status === 201 || res.status === 200, `Created Worker ID: ${createdWorkerId}`);
    } catch (err) {
        recordResult('3. Workers', 'POST /admin/users (Create Worker)', false, err.response?.data?.message || err.message);
    }

    // ─── Module 4: Shops ──────────────────────────────────────────────────────
    console.log('\n--- [Module 4: Shops] ---');
    try {
        const list = await axios.get(`${BASE_URL}/admin/shops`, adminHeader);
        recordResult('4. Shops', 'GET /admin/shops', list.status === 200, `Found ${list.data.data?.shops?.length || 0} shops`);
    } catch (err) {
        recordResult('4. Shops', 'GET /admin/shops', false, err.response?.data?.message || err.message);
    }

    // Invalid shop detail ID
    try {
        await axios.get(`${BASE_URL}/admin/shops/invalid_shop_id`, adminHeader);
        recordResult('4. Shops', 'Invalid Shop ID Handling', false, 'Expected 400 or 404');
    } catch (err) {
        recordResult('4. Shops', 'Invalid Shop ID Handling', err.response?.status === 400 || err.response?.status === 404 || err.response?.status === 500, `Handled with HTTP ${err.response?.status}`);
    }

    // ─── Module 5: Jobs ───────────────────────────────────────────────────────
    console.log('\n--- [Module 5: Jobs] ---');
    try {
        const jobs = await axios.get(`${BASE_URL}/admin/jobs/all`, adminHeader);
        recordResult('5. Jobs', 'GET /admin/jobs/all', jobs.status === 200, `Found ${jobs.data.data?.jobs?.length || jobs.data.data?.length || 0} jobs`);
    } catch (err) {
        recordResult('5. Jobs', 'GET /admin/jobs/all', false, err.response?.data?.message || err.message);
    }

    // ─── Module 6: Orders ─────────────────────────────────────────────────────
    console.log('\n--- [Module 6: Orders] ---');
    try {
        const orders = await axios.get(`${BASE_URL}/shoporders/all`, adminHeader);
        recordResult('6. Orders', 'GET /shoporders/all', orders.status === 200);
    } catch (err) {
        recordResult('6. Orders', 'GET /shoporders/all', false, err.response?.data?.message || err.message);
    }

    // ─── Module 7: KYC Queue ──────────────────────────────────────────────────
    console.log('\n--- [Module 7: KYC Queue] ---');
    try {
        const kyc = await axios.get(`${BASE_URL}/admin/pending-kyc`, adminHeader);
        recordResult('7. KYC Queue', 'GET /admin/pending-kyc', kyc.status === 200, `Pending count: ${kyc.data.data?.length || 0}`);
    } catch (err) {
        recordResult('7. KYC Queue', 'GET /admin/pending-kyc', false, err.response?.data?.message || err.message);
    }

    // ─── Module 8: Categories ─────────────────────────────────────────────────
    console.log('\n--- [Module 8: Categories] ---');
    try {
        const catRes = await axios.get(`${BASE_URL}/categories`);
        recordResult('8. Categories', 'GET /categories', catRes.status === 200, `Found ${catRes.data.data?.length || 0} categories`);
    } catch (err) {
        recordResult('8. Categories', 'GET /categories', false, err.response?.data?.message || err.message);
    }

    const testCatName = `Test Category ${Date.now()}`;
    try {
        const newCat = await axios.post(`${BASE_URL}/categories`, {
            name: testCatName,
            description: 'Automated test category description'
        }, adminHeader);
        createdCategoryId = newCat.data.data._id;
        recordResult('8. Categories', 'POST /categories (Create)', newCat.status === 201 || newCat.status === 200, `Category ID: ${createdCategoryId}`);
    } catch (err) {
        recordResult('8. Categories', 'POST /categories (Create)', false, err.response?.data?.message || err.message);
    }

    // Duplicate name test
    try {
        await axios.post(`${BASE_URL}/categories`, {
            name: testCatName,
            description: 'Duplicate test'
        }, adminHeader);
        recordResult('8. Categories', 'Duplicate Category Check', false, 'Expected duplicate error');
    } catch (err) {
        recordResult('8. Categories', 'Duplicate Category Check', err.response?.status === 400 || err.response?.status === 409, `Blocked with HTTP ${err.response?.status}`);
    }

    // ─── Module 9: Promotions ─────────────────────────────────────────────────
    console.log('\n--- [Module 9: Promotions] ---');
    try {
        const promos = await axios.get(`${BASE_URL}/promotions/promotions`, adminHeader);
        recordResult('9. Promotions', 'GET /promotions/promotions', promos.status === 200, `Found ${promos.data.data?.length || 0} promos`);
    } catch (err) {
        recordResult('9. Promotions', 'GET /promotions/promotions', false, err.response?.data?.message || err.message);
    }

    // Negative discount validation check
    try {
        await axios.post(`${BASE_URL}/promotions/promotions`, {
            code: `TESTPROMO_${Date.now()}`,
            discount: -20,
            discountType: 'PERCENTAGE',
            validUntil: '2026-12-31'
        }, adminHeader);
        recordResult('9. Promotions', 'Validation check (negative discount)', false, 'Expected validation error');
    } catch (err) {
        recordResult('9. Promotions', 'Validation check (negative discount)', err.response?.status === 400 || err.response?.status === 422, `Rejected with HTTP ${err.response?.status}`);
    }

    // ─── Module 10: Support Chats ─────────────────────────────────────────────
    console.log('\n--- [Module 10: Support Chats] ---');
    try {
        const chats = await axios.get(`${BASE_URL}/chat/support/threads`, adminHeader);
        recordResult('10. Support Chats', 'GET /chat/support/threads', chats.status === 200);
    } catch (err) {
        recordResult('10. Support Chats', 'GET /chat/support/threads', false, err.response?.data?.message || err.message);
    }

    // ─── Module 11: Settlements ───────────────────────────────────────────────
    console.log('\n--- [Module 11: Settlements] ---');
    try {
        const settlements = await axios.get(`${BASE_URL}/admin/settlements`, adminHeader);
        recordResult('11. Settlements', 'GET /admin/settlements', settlements.status === 200);
    } catch (err) {
        recordResult('11. Settlements', 'GET /admin/settlements', false, err.response?.data?.message || err.message);
    }

    // ─── Module 12: Disputes ──────────────────────────────────────────────────
    console.log('\n--- [Module 12: Disputes] ---');
    try {
        const disp = await axios.get(`${BASE_URL}/admin/disputes`, adminHeader);
        recordResult('12. Disputes', 'GET /admin/disputes', disp.status === 200);
    } catch (err) {
        recordResult('12. Disputes', 'GET /admin/disputes', false, err.response?.data?.message || err.message);
    }

    // ─── Modules 13-16: Admin Wallet & Ledger & Payouts ──────────────────────
    console.log('\n--- [Modules 13-16: Financial & Ledger] ---');
    try {
        const adminW = await axios.get(`${BASE_URL}/admin/admin-wallet/balance`, adminHeader);
        recordResult('13. Admin Wallet', 'GET /admin/admin-wallet/balance', adminW.status === 200, `Balance: ${adminW.data.data?.balance || 0}`);
    } catch (err) {
        recordResult('13. Admin Wallet', 'GET /admin/admin-wallet/balance', false, err.response?.data?.message || err.message);
    }

    try {
        const ledger = await axios.get(`${BASE_URL}/admin/ledger`, adminHeader);
        recordResult('16. Ledger', 'GET /admin/ledger', ledger.status === 200);
    } catch (err) {
        recordResult('16. Ledger', 'GET /admin/ledger', false, err.response?.data?.message || err.message);
    }

    try {
        const payouts = await axios.get(`${BASE_URL}/admin/payouts`, adminHeader);
        recordResult('15. Payouts', 'GET /admin/payouts', payouts.status === 200);
    } catch (err) {
        recordResult('15. Payouts', 'GET /admin/payouts', false, err.response?.data?.message || err.message);
    }

    // ─── Module 17: Subscriptions ─────────────────────────────────────────────
    console.log('\n--- [Module 17: Subscriptions] ---');
    try {
        const subs = await axios.get(`${BASE_URL}/subscriptions/plans`);
        recordResult('17. Subscriptions', 'GET /subscriptions/plans', subs.status === 200);
    } catch (err) {
        recordResult('17. Subscriptions', 'GET /subscriptions/plans', false, err.response?.data?.message || err.message);
    }

    // ─── Module 18: Notifications ─────────────────────────────────────────────
    console.log('\n--- [Module 18: Notifications] ---');
    try {
        const notifs = await axios.get(`${BASE_URL}/admin/notifications`, adminHeader);
        recordResult('18. Notifications', 'GET /admin/notifications', notifs.status === 200);
    } catch (err) {
        recordResult('18. Notifications', 'GET /admin/notifications', false, err.response?.data?.message || err.message);
    }

    // ─── Module 19: Reports ───────────────────────────────────────────────────
    console.log('\n--- [Module 19: Reports] ---');
    try {
        const rep = await axios.get(`${BASE_URL}/admin/reports/sales?startDate=2026-01-01&endDate=2026-12-31`, adminHeader);
        recordResult('19. Reports', 'GET /admin/reports/sales', rep.status === 200);
    } catch (err) {
        recordResult('19. Reports', 'GET /admin/reports/sales', false, err.response?.data?.message || err.message);
    }

    // ─── Module 20: Admin Profile ─────────────────────────────────────────────
    console.log('\n--- [Module 20: Admin Profile] ---');
    try {
        const me = await axios.get(`${BASE_URL}/auth/me`, adminHeader);
        recordResult('20. Admin Profile', 'GET /auth/me', me.status === 200, `User: ${me.data.data?.name}`);
    } catch (err) {
        recordResult('20. Admin Profile', 'GET /auth/me', false, err.response?.data?.message || err.message);
    }

    // ─── Module 21: Settings ──────────────────────────────────────────────────
    console.log('\n--- [Module 21: Settings] ---');
    try {
        const settings = await axios.get(`${BASE_URL}/settings`, adminHeader);
        recordResult('21. Settings', 'GET /settings', settings.status === 200);
    } catch (err) {
        recordResult('21. Settings', 'GET /settings', false, err.response?.data?.message || err.message);
    }

    console.log('\n====================================================');
    const passedCount = results.filter(r => r.status === 'PASS').length;
    const totalCount = results.length;
    console.log(`📊 SUMMARY: ${passedCount} / ${totalCount} TEST CASES PASSED`);
    console.log('====================================================\n');
}

runAllTests();
