const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';
const ADMIN_UI = 'http://localhost:5173';

const results = [];

function pass(mod, test, details = '') {
    results.push({ mod, test, status: '✅ PASS', details });
    console.log(`  ✅ [${mod}] ${test} ${details ? `→ ${details}` : ''}`);
}
function fail(mod, test, details = '') {
    results.push({ mod, test, status: '❌ FAIL', details });
    console.log(`  ❌ [${mod}] ${test} ${details ? `→ ${details}` : ''}`);
}
function warn(mod, test, details = '') {
    results.push({ mod, test, status: '⚠️  WARN', details });
    console.log(`  ⚠️  [${mod}] ${test} ${details ? `→ ${details}` : ''}`);
}

async function run() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  🧪 Kwickly Admin — Comprehensive API QA Pass 2');
    console.log('     Validation, Errors, Edge Cases & Data Integrity');
    console.log('══════════════════════════════════════════════════════\n');

    // ── 0. Auth & Tokens ─────────────────────────────────────────────────────
    console.log('── Module 0: Auth ──');
    let adminToken, customerToken;

    try {
        const r = await axios.post(`${BASE_URL}/auth/login`, { email: 'admin@kwickly.com', password: 'admin123', role: 'ADMIN' });
        adminToken = r.data.data.token;
        pass('Auth', 'Admin login', `token: ${adminToken.substring(0,20)}...`);
    } catch (e) { fail('Auth', 'Admin login', e.response?.data?.message || e.message); return; }

    try {
        await axios.post(`${BASE_URL}/auth/send-otp`, { phone: '9000000001', role: 'CUSTOMER' });
        const r = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: '9000000001', code: '1234', role: 'CUSTOMER', name: 'Customer A' });
        customerToken = r.data.data.token;
        pass('Auth', 'Customer login (OTP)', `token: ${customerToken.substring(0,20)}...`);
    } catch (e) { warn('Auth', 'Customer OTP login', e.response?.data?.message || e.message); }

    // Wrong password test
    try {
        await axios.post(`${BASE_URL}/auth/login`, { email: 'admin@kwickly.com', password: 'wrongpassword', role: 'ADMIN' });
        fail('Auth', 'Wrong password rejected', 'Should have returned 401');
    } catch (e) {
        if (e.response?.status === 401) pass('Auth', 'Wrong password rejected', 'HTTP 401 ✓');
        else fail('Auth', 'Wrong password rejected', `Got HTTP ${e.response?.status}`);
    }

    // No token → 401
    try {
        await axios.get(`${BASE_URL}/admin/stats`);
        fail('Auth', 'No-token request blocked', 'Should return 401');
    } catch (e) {
        if (e.response?.status === 401) pass('Auth', 'No-token request blocked', 'HTTP 401 ✓');
        else fail('Auth', 'No-token request blocked', `Got HTTP ${e.response?.status}`);
    }

    const ah = { headers: { Authorization: `Bearer ${adminToken}` } };
    const ch = customerToken ? { headers: { Authorization: `Bearer ${customerToken}` } } : null;

    // ── 1. Dashboard ─────────────────────────────────────────────────────────
    console.log('\n── Module 1: Dashboard ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/stats`, ah);
        const d = r.data.data;
        const hasKeys = ['activeJobs','totalWorkers'].some(k => d.hasOwnProperty(k));
        if (hasKeys) pass('Dashboard', 'Stats shape valid', `keys: ${Object.keys(d).join(', ')}`);
        else warn('Dashboard', 'Stats shape', 'Unexpected structure');
    } catch (e) { fail('Dashboard', 'GET /admin/stats', e.response?.data?.message || e.message); }

    try {
        const r = await axios.get(`${BASE_URL}/admin/badges`, ah);
        pass('Dashboard', 'Badges endpoint', JSON.stringify(r.data.data));
    } catch (e) { fail('Dashboard', 'GET /admin/badges', e.response?.data?.message || e.message); }

    // ── 2. Customers ─────────────────────────────────────────────────────────
    console.log('\n── Module 2: Customers ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/customers?page=1&limit=5`, ah);
        pass('Customers', 'Paginated list', `count: ${r.data.data?.users?.length ?? 'N/A'}`);
    } catch (e) { fail('Customers', 'GET list with pagination', e.response?.data?.message || e.message); }

    // Search
    try {
        const r = await axios.get(`${BASE_URL}/admin/customers?search=Test&limit=5`, ah);
        pass('Customers', 'Search by name works', `hits: ${r.data.data?.users?.length ?? 0}`);
    } catch (e) { fail('Customers', 'Search param', e.response?.data?.message || e.message); }

    // Bad email on create
    try {
        await axios.post(`${BASE_URL}/admin/users`, { name: 'X', phone: '1234567890', email: 'not-an-email', role: 'CUSTOMER' }, ah);
        fail('Customers', 'Invalid email rejected', 'Should have returned 400');
    } catch (e) {
        if (e.response?.status === 400) pass('Customers', 'Invalid email rejected', 'HTTP 400 ✓');
        else fail('Customers', 'Invalid email rejected', `Got HTTP ${e.response?.status}`);
    }

    // ── 3. Workers ───────────────────────────────────────────────────────────
    console.log('\n── Module 3: Workers ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/workers?limit=5`, ah);
        pass('Workers', 'List with pagination', `count: ${r.data.data?.workers?.length ?? 0}`);
    } catch (e) { fail('Workers', 'GET list', e.response?.data?.message || e.message); }

    // Get worker detail
    try {
        const list = await axios.get(`${BASE_URL}/admin/workers`, ah);
        const w = list.data.data?.workers?.[0];
        if (w) {
            const d = await axios.get(`${BASE_URL}/admin/workers/${w._id}`, ah);
            pass('Workers', 'Worker detail by ID', `name: ${d.data.data?.name}`);
        } else warn('Workers', 'Worker detail', 'No workers in DB');
    } catch (e) { fail('Workers', 'Worker detail by ID', e.response?.data?.message || e.message); }

    // ── 4. Shops ─────────────────────────────────────────────────────────────
    console.log('\n── Module 4: Shops ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/shops`, ah);
        pass('Shops', 'Shop list', `found: ${r.data.data?.shops?.length ?? 0}`);
    } catch (e) { fail('Shops', 'Shop list', e.response?.data?.message || e.message); }

    // ── 5. Jobs ──────────────────────────────────────────────────────────────
    console.log('\n── Module 5: Jobs ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/jobs/all?limit=5`, ah);
        pass('Jobs', 'Job list with pagination', `count: ${r.data.data?.jobs?.length ?? r.data.data?.length ?? 0}`);
    } catch (e) { fail('Jobs', 'Job list', e.response?.data?.message || e.message); }

    // Status filter
    try {
        const r = await axios.get(`${BASE_URL}/admin/jobs/all?status=COMPLETED`, ah);
        pass('Jobs', 'Filter by COMPLETED status', `count: ${r.data.data?.jobs?.length ?? r.data.data?.length ?? 0}`);
    } catch (e) { fail('Jobs', 'Filter by status', e.response?.data?.message || e.message); }

    // ── 6. Orders ────────────────────────────────────────────────────────────
    console.log('\n── Module 6: Orders ──');
    try {
        const r = await axios.get(`${BASE_URL}/shoporders/all`, ah);
        pass('Orders', 'All shop orders (admin)', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Orders', 'GET /shoporders/all', e.response?.data?.message || e.message); }

    // ── 7. KYC ───────────────────────────────────────────────────────────────
    console.log('\n── Module 7: KYC Queue ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/pending-kyc`, ah);
        pass('KYC', 'Pending KYC list', `pending: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('KYC', 'Pending KYC list', e.response?.data?.message || e.message); }

    // Reject without reason → should fail
    try {
        await axios.patch(`${BASE_URL}/admin/workers/000000000000000000000001/kyc`, { status: 'REJECTED' }, ah);
        warn('KYC', 'Reject without reason', 'Accepted — check if reason is enforced');
    } catch (e) {
        if (e.response?.status === 400 || e.response?.status === 404) pass('KYC', 'Reject without reason blocked', `HTTP ${e.response?.status} ✓`);
        else warn('KYC', 'Reject without reason', `HTTP ${e.response?.status}`);
    }

    // ── 8. Categories ────────────────────────────────────────────────────────
    console.log('\n── Module 8: Categories ──');
    try {
        const r = await axios.get(`${BASE_URL}/categories`, ah);
        pass('Categories', 'List all', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Categories', 'List categories', e.response?.data?.message || e.message); }

    // Update existing category
    try {
        const list = await axios.get(`${BASE_URL}/categories`);
        const cat = list.data.data?.[0];
        if (cat) {
            const upd = await axios.patch(`${BASE_URL}/categories/${cat._id}`, { description: 'Updated by QA test runner' }, ah);
            pass('Categories', 'PATCH category description', `name: ${cat.name}`);
        } else warn('Categories', 'PATCH category', 'No categories to update');
    } catch (e) { fail('Categories', 'PATCH category', e.response?.data?.message || e.message); }

    // ── 9. Promotions ────────────────────────────────────────────────────────
    console.log('\n── Module 9: Promotions ──');
    try {
        const r = await axios.get(`${BASE_URL}/promotions/promotions`, ah);
        pass('Promotions', 'List all promos', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Promotions', 'List promos', e.response?.data?.message || e.message); }

    // End date before start date
    try {
        await axios.post(`${BASE_URL}/promotions/promotions`, {
            code: `EXPIREDTEST${Date.now()}`,
            discount: 10,
            discountType: 'PERCENTAGE',
            validFrom: '2026-12-31',
            validUntil: '2026-01-01'
        }, ah);
        warn('Promotions', 'End before start date', 'Accepted — may need validation');
    } catch (e) {
        if (e.response?.status === 400) pass('Promotions', 'End before start date rejected', 'HTTP 400 ✓');
        else fail('Promotions', 'End before start date', `HTTP ${e.response?.status}`);
    }

    // ── 10. Support Chats ────────────────────────────────────────────────────
    console.log('\n── Module 10: Support Chats ──');
    try {
        const r = await axios.get(`${BASE_URL}/chat/support/threads`, ah);
        pass('Chats', 'Support threads list', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Chats', 'Support threads', e.response?.data?.message || e.message); }

    // ── 11. Settlements ──────────────────────────────────────────────────────
    console.log('\n── Module 11: Settlements ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/settlements`, ah);
        pass('Settlements', 'List all settlements', JSON.stringify(r.data.data)?.substring(0,80));
    } catch (e) { fail('Settlements', 'List settlements', e.response?.data?.message || e.message); }

    // ── 12. Disputes ─────────────────────────────────────────────────────────
    console.log('\n── Module 12: Disputes ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/disputes`, ah);
        pass('Disputes', 'List disputes', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Disputes', 'List disputes', e.response?.data?.message || e.message); }

    // Resolve without note → should fail
    try {
        await axios.patch(`${BASE_URL}/admin/disputes/000000000000000000000001/status`, { status: 'resolved' }, ah);
        warn('Disputes', 'Resolve without note', 'Accepted — check if note is enforced');
    } catch (e) {
        if ([400, 404].includes(e.response?.status)) pass('Disputes', 'Resolve without note or bad ID', `HTTP ${e.response?.status} ✓`);
        else warn('Disputes', 'Resolve without note', `HTTP ${e.response?.status}`);
    }

    // ── 13-16. Financial ─────────────────────────────────────────────────────
    console.log('\n── Modules 13-16: Financial Core ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/admin-wallet/balance`, ah);
        pass('AdminWallet', 'Balance endpoint', `balance: ₹${r.data.data?.balance}`);
    } catch (e) { fail('AdminWallet', 'Balance', e.response?.data?.message || e.message); }

    try {
        const r = await axios.get(`${BASE_URL}/admin/admin-wallet/transactions`, ah);
        pass('AdminWallet', 'Transactions list', `count: ${r.data.data?.transactions?.length ?? r.data.data?.length ?? 0}`);
    } catch (e) { fail('AdminWallet', 'Transactions list', e.response?.data?.message || e.message); }

    // Negative debit (should fail)
    try {
        await axios.post(`${BASE_URL}/admin/admin-wallet/debit`, { amount: -100, description: 'Bad debit' }, ah);
        fail('AdminWallet', 'Negative debit rejected', 'Should return 400');
    } catch (e) {
        if (e.response?.status === 400) pass('AdminWallet', 'Negative debit rejected', 'HTTP 400 ✓');
        else warn('AdminWallet', 'Negative debit', `HTTP ${e.response?.status}: ${e.response?.data?.message}`);
    }

    try {
        const r = await axios.get(`${BASE_URL}/admin/ledger`, ah);
        pass('Ledger', 'Ledger entries list', `data present: ${!!r.data.data}`);
    } catch (e) { fail('Ledger', 'GET /admin/ledger', e.response?.data?.message || e.message); }

    try {
        const r = await axios.get(`${BASE_URL}/admin/payouts`, ah);
        pass('Payouts', 'Payouts list', `count: ${r.data.data?.payouts?.length ?? r.data.data?.length ?? 0}`);
    } catch (e) { fail('Payouts', 'GET /admin/payouts', e.response?.data?.message || e.message); }

    // ── 17. Subscriptions ────────────────────────────────────────────────────
    console.log('\n── Module 17: Subscriptions ──');
    try {
        const r = await axios.get(`${BASE_URL}/subscriptions/plans`);
        pass('Subscriptions', 'Plans list (public)', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Subscriptions', 'Plans list', e.response?.data?.message || e.message); }

    // ── 18. Notifications ────────────────────────────────────────────────────
    console.log('\n── Module 18: Notifications ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/notifications`, ah);
        pass('Notifications', 'Admin notifications list', `count: ${r.data.data?.length ?? 0}`);
    } catch (e) { fail('Notifications', 'GET /admin/notifications', e.response?.data?.message || e.message); }

    // ── 19. Reports ──────────────────────────────────────────────────────────
    console.log('\n── Module 19: Reports ──');
    try {
        const r = await axios.get(`${BASE_URL}/admin/reports/sales?startDate=2026-01-01&endDate=2026-12-31`, ah);
        pass('Reports', 'Sales report (full year)', `data present: ${!!r.data.data}`);
    } catch (e) { fail('Reports', 'Sales report', e.response?.data?.message || e.message); }

    // Zero-data date range (future)
    try {
        const r = await axios.get(`${BASE_URL}/admin/reports/sales?startDate=2030-01-01&endDate=2030-12-31`, ah);
        pass('Reports', 'Empty range handled gracefully', `data: ${JSON.stringify(r.data.data)?.substring(0,60)}`);
    } catch (e) {
        if (e.response?.status === 400) pass('Reports', 'Future date range rejected', 'HTTP 400 ✓');
        else fail('Reports', 'Empty date range', e.response?.data?.message || e.message);
    }

    // ── 20. Admin Profile ────────────────────────────────────────────────────
    console.log('\n── Module 20: Admin Profile ──');
    try {
        const r = await axios.get(`${BASE_URL}/auth/me`, ah);
        pass('Profile', 'GET /auth/me', `name: ${r.data.data?.name}, role: ${r.data.data?.role}`);
    } catch (e) { fail('Profile', 'GET /auth/me', e.response?.data?.message || e.message); }

    // ── 21. Settings ─────────────────────────────────────────────────────────
    console.log('\n── Module 21: Settings ──');
    try {
        const r = await axios.get(`${BASE_URL}/settings`, ah);
        pass('Settings', 'GET /settings (admin)', `branding: ${r.data.data?.branding?.appName}`);
    } catch (e) { fail('Settings', 'GET /settings', e.response?.data?.message || e.message); }

    // Public settings (no auth)
    try {
        const r = await axios.get(`${BASE_URL}/settings/public`);
        pass('Settings', 'GET /settings/public (no auth)', `appName: ${r.data.data?.appName}`);
    } catch (e) { fail('Settings', 'GET /settings/public', e.response?.data?.message || e.message); }

    // Customer can't update settings
    if (ch) {
        try {
            await axios.patch(`${BASE_URL}/settings`, { fees: { amount: 99 } }, ch);
            fail('Settings', 'Customer PATCH settings blocked', 'Should return 403');
        } catch (e) {
            if (e.response?.status === 403) pass('Settings', 'Customer PATCH settings blocked', 'HTTP 403 ✓');
            else warn('Settings', 'Customer PATCH settings', `HTTP ${e.response?.status}`);
        }
    }

    // ─── Final Summary ───────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    const passed = results.filter(r => r.status.includes('PASS')).length;
    const failed = results.filter(r => r.status.includes('FAIL')).length;
    const warned = results.filter(r => r.status.includes('WARN')).length;
    console.log(`📊 RESULTS: ${passed} PASS  |  ${warned} WARN  |  ${failed} FAIL  |  Total: ${results.length}`);
    console.log('══════════════════════════════════════════════════════\n');

    if (failed > 0 || warned > 0) {
        console.log('🔍 Issues Requiring Attention:');
        results.filter(r => !r.status.includes('PASS')).forEach(r => {
            console.log(`  ${r.status} [${r.mod}] ${r.test} → ${r.details}`);
        });
    }
}

run().catch(e => console.error('Runner error:', e));
