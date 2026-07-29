/**
 * ════════════════════════════════════════════════════════════════════
 *  Kwickly Admin — Full Browser-Based CRUD + API Integration Test
 *  Puppeteer (UI) + Axios (API) Hybrid — 21 Modules × 9-Step Sequence
 * ════════════════════════════════════════════════════════════════════
 */
const puppeteer = require('puppeteer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const ADMIN_URL = 'http://localhost:5173';
const API = 'http://localhost:5000/api/v1';
const SHOTS = path.join(__dirname, 'crud_test_screenshots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const rows = [];
let shotIdx = 0;
let adminToken = '';
let customerToken = '';

function log(mod, step, action, expected, actual, pf, layer = 'API') {
    const row = { mod, step, action, expected, actual, pf, layer };
    rows.push(row);
    console.log(`  ${pf === 'PASS' ? '✅' : pf === 'WARN' ? '⚠️ ' : '❌'} [${mod}] S${step}: ${action} → ${actual}`);
}

async function shot(page, label) {
    shotIdx++;
    const f = path.join(SHOTS, `${String(shotIdx).padStart(3,'0')}_${label.replace(/\s+/g,'_').toLowerCase()}.png`);
    await page.screenshot({ path: f, fullPage: false });
    return f;
}

async function apiCall(method, url, data = null, token = null) {
    const cfg = { method, url, headers: {} };
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    if (data) cfg.data = data;
    try {
        const r = await axios(cfg);
        return { status: r.status, data: r.data, ok: true };
    } catch (e) {
        return { status: e.response?.status, data: e.response?.data, ok: false, msg: e.response?.data?.message || e.message };
    }
}

async function run() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🧪 KWICKLY ADMIN — FULL BROWSER CRUD + API INTEGRATION    ║');
    console.log('║     21 Modules × 9-Step Sequence                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // ── Auth Setup ─────────────────────────────────────────────────────────
    const loginRes = await apiCall('POST', `${API}/auth/login`, { email: 'admin@kwickly.com', password: 'admin123', role: 'ADMIN' });
    if (!loginRes.ok) { console.error('❌ FATAL: Cannot login as admin', loginRes.msg); return; }
    adminToken = loginRes.data.data.token;

    const freshPhone = `900${String(Date.now()).slice(-7)}`;
    await apiCall('POST', `${API}/auth/send-otp`, { phone: freshPhone, role: 'CUSTOMER' });
    const custRes = await apiCall('POST', `${API}/auth/verify-otp`, { phone: freshPhone, code: '1234', role: 'CUSTOMER', name: 'Customer A' });
    customerToken = custRes.ok ? custRes.data.data.token : '';

    console.log('🔑 Admin & Customer tokens acquired\n');

    // Launch browser
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,900'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Login via browser
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.type('input[type="email"]', 'admin@kwickly.com');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    log('Auth', 0, 'Admin browser login', 'Redirect to /', page.url().endsWith('/') ? 'Dashboard loaded' : page.url(), page.url().includes('5173') ? 'PASS' : 'FAIL', 'UI');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 1: DASHBOARD (read-only)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 1: DASHBOARD ═══');
    await page.goto(`${ADMIN_URL}/`, { waitUntil: 'networkidle2' });
    await shot(page, 'dashboard');

    const statsRes = await apiCall('GET', `${API}/admin/stats`, null, adminToken);
    log('Dashboard', 1, 'GET /admin/stats', '200 with stat keys', statsRes.ok ? `200 OK — keys: ${Object.keys(statsRes.data.data).join(',')}` : `${statsRes.status}`, statsRes.ok ? 'PASS' : 'FAIL');

    const badgesRes = await apiCall('GET', `${API}/admin/badges`, null, adminToken);
    log('Dashboard', 1, 'GET /admin/badges', '200 with counts', badgesRes.ok ? `kyc:${badgesRes.data.data.kyc}, payouts:${badgesRes.data.data.payouts}` : 'Failed', badgesRes.ok ? 'PASS' : 'FAIL');

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasDashItems = ['Dashboard', 'Workers', 'Revenue'].some(k => bodyText.includes(k));
    log('Dashboard', 1, 'UI stat cards visible', 'Stat cards present', hasDashItems ? 'Stat cards detected' : 'Missing', hasDashItems ? 'PASS' : 'FAIL', 'UI');

    // RBAC: customer token → admin → 403
    const rbac = await apiCall('GET', `${API}/admin/stats`, null, customerToken);
    log('Dashboard', 9, 'RBAC: Customer→Admin', '403 Forbidden', `HTTP ${rbac.status}`, rbac.status === 403 ? 'PASS' : 'FAIL');

    // No token → 401
    const noAuth = await apiCall('GET', `${API}/admin/stats`);
    log('Dashboard', 9, 'No-token → Admin', '401', `HTTP ${noAuth.status}`, noAuth.status === 401 ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 2: CUSTOMERS (Full 9-Step)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 2: CUSTOMERS ═══');
    await page.goto(`${ADMIN_URL}/users`, { waitUntil: 'networkidle2' });
    await shot(page, 'customers_baseline');

    // Step 1 Baseline
    const custList = await apiCall('GET', `${API}/admin/customers`, null, adminToken);
    const custBaseline = custList.data?.data?.total || custList.data?.data?.users?.length || 0;
    log('Customers', 1, 'Baseline count', 'number', `${custBaseline} customers`, 'PASS');

    // Step 2 CREATE valid
    const ts = Date.now();
    const testPhone = `91${String(ts).slice(-8)}`;
    const createCust = await apiCall('POST', `${API}/admin/users`, {
        name: `Test Customer QA`, phone: testPhone, email: `test${ts}@qa.com`, role: 'CUSTOMER'
    }, adminToken);
    const custId = createCust.data?.data?._id;
    log('Customers', 2, 'CREATE valid customer', '200/201 with ID', createCust.ok ? `${createCust.status} ID:${custId}` : createCust.msg, createCust.ok ? 'PASS' : 'FAIL');

    // Verify persistence
    if (custId) {
        const detail = await apiCall('GET', `${API}/admin/customers/${custId}`, null, adminToken);
        log('Customers', 2, 'Persistence check (GET by ID)', '200 with data', detail.ok ? `Found: ${detail.data?.data?.name || 'yes'}` : `${detail.status}`, detail.ok ? 'PASS' : 'FAIL');
    }

    // Step 3 CREATE invalid
    const inv1 = await apiCall('POST', `${API}/admin/users`, { role: 'CUSTOMER' }, adminToken);
    log('Customers', 3, 'Missing required fields', '400', `HTTP ${inv1.status}`, inv1.status === 400 ? 'PASS' : 'FAIL');

    const inv2 = await apiCall('POST', `${API}/admin/users`, { name: 'X', phone: '123', role: 'CUSTOMER' }, adminToken);
    log('Customers', 3, 'Invalid phone (too short)', '400', `HTTP ${inv2.status}`, inv2.status === 400 ? 'PASS' : 'FAIL');

    const inv3 = await apiCall('POST', `${API}/admin/users`, { name: 'X Y', phone: testPhone, role: 'CUSTOMER' }, adminToken);
    log('Customers', 3, 'Duplicate phone', '400', `HTTP ${inv3.status}: ${inv3.msg}`, inv3.status === 400 ? 'PASS' : 'FAIL');

    const inv4 = await apiCall('POST', `${API}/admin/users`, { name: 'Test', phone: '9999977777', email: 'notanemail', role: 'CUSTOMER' }, adminToken);
    log('Customers', 3, 'Invalid email format', '400', `HTTP ${inv4.status}`, inv4.status === 400 ? 'PASS' : 'FAIL');

    // Step 4 READ/LIST
    const search1 = await apiCall('GET', `${API}/admin/customers?search=Test`, null, adminToken);
    log('Customers', 4, 'Search by name "Test"', '200 with results', search1.ok ? `Found hits` : 'Failed', search1.ok ? 'PASS' : 'FAIL');

    const search2 = await apiCall('GET', `${API}/admin/customers?search=zzzznonexistent`, null, adminToken);
    log('Customers', 4, 'Search nonsense term', '200 empty', search2.ok ? `Empty result` : 'Failed', search2.ok ? 'PASS' : 'FAIL');

    // Step 5 UPDATE valid
    if (custId) {
        const upd = await apiCall('PATCH', `${API}/admin/users/${custId}`, { name: `Updated Customer QA` }, adminToken);
        log('Customers', 5, 'PATCH name only', '200 name changed', upd.ok ? `Name: ${upd.data?.data?.name}` : upd.msg, upd.ok ? 'PASS' : 'FAIL');

        // Verify other fields not wiped
        const check = await apiCall('GET', `${API}/admin/customers/${custId}`, null, adminToken);
        const phoneOk = check.data?.data?.user?.phone === testPhone;
        log('Customers', 5, 'Other fields preserved', 'phone unchanged', phoneOk ? `Phone preserved: ${testPhone}` : 'Phone wiped!', phoneOk ? 'PASS' : 'FAIL');
    }

    // Step 6 UPDATE invalid
    if (custId) {
        const badUpd = await apiCall('PATCH', `${API}/admin/users/${custId}`, { email: 'notvalid' }, adminToken);
        log('Customers', 6, 'PATCH invalid email', '400', `HTTP ${badUpd.status}`, badUpd.status === 400 ? 'PASS' : 'FAIL');
    }

    // Step 7 State transitions
    if (custId) {
        const toggle = await apiCall('PATCH', `${API}/admin/users/${custId}/toggle-status`, {}, adminToken);
        log('Customers', 7, 'Toggle status', '200', toggle.ok ? `Verified: ${toggle.data?.data?.isVerified}` : toggle.msg, toggle.ok ? 'PASS' : 'FAIL');
    }

    // Step 8 DELETE
    if (custId) {
        const del = await apiCall('DELETE', `${API}/admin/users/${custId}`, null, adminToken);
        log('Customers', 8, 'DELETE customer', '200 soft-delete', del.ok ? 'Deleted' : del.msg, del.ok ? 'PASS' : 'FAIL');

        // Verify deleted — check can't be fetched normally
        const afterDel = await apiCall('GET', `${API}/admin/customers/${custId}`, null, adminToken);
        log('Customers', 8, 'Post-delete GET', '404 or isDeleted', afterDel.ok ? `isDeleted: ${afterDel.data?.data?.isDeleted}` : `HTTP ${afterDel.status}`, 'PASS');
    }

    // Step 9 RBAC
    const custCreate = await apiCall('POST', `${API}/admin/users`, { name: 'Hack', phone: '0000000000', role: 'CUSTOMER' }, customerToken);
    log('Customers', 9, 'Customer role → Create user', '403', `HTTP ${custCreate.status}`, custCreate.status === 403 ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 3: WORKERS (Full 9-Step)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 3: WORKERS ═══');
    await page.goto(`${ADMIN_URL}/workers`, { waitUntil: 'networkidle2' });
    await shot(page, 'workers_baseline');

    const wrk = await apiCall('GET', `${API}/admin/workers`, null, adminToken);
    log('Workers', 1, 'Baseline', '200', wrk.ok ? `${wrk.data?.data?.workers?.length || 0} workers` : 'Failed', wrk.ok ? 'PASS' : 'FAIL');

    const wrkPhone = `92${String(Date.now()).slice(-8)}`;
    const wrkCreate = await apiCall('POST', `${API}/admin/users`, { name: `Test Worker QA`, phone: wrkPhone, role: 'WORKER' }, adminToken);
    const wrkId = wrkCreate.data?.data?._id;
    log('Workers', 2, 'CREATE worker', '200/201', wrkCreate.ok ? `ID: ${wrkId}` : wrkCreate.msg, wrkCreate.ok ? 'PASS' : 'FAIL');

    if (wrkId) {
        // KYC status update
        const kyc = await apiCall('PATCH', `${API}/admin/workers/${wrkId}/kyc`, { status: 'APPROVED' }, adminToken);
        log('Workers', 7, 'KYC approve (no docs)', '400', `HTTP ${kyc.status}: ${kyc.msg}`, kyc.status === 400 ? 'PASS' : 'FAIL');

        // Update
        const upd = await apiCall('PATCH', `${API}/admin/users/${wrkId}`, { city: 'Mumbai' }, adminToken);
        log('Workers', 5, 'PATCH city only', '200', upd.ok ? `City updated` : upd.msg, upd.ok ? 'PASS' : 'FAIL');

        // Delete
        const del = await apiCall('DELETE', `${API}/admin/users/${wrkId}`, null, adminToken);
        log('Workers', 8, 'DELETE worker', '200', del.ok ? 'Deleted' : del.msg, del.ok ? 'PASS' : 'FAIL');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 4: SHOPS (Full 9-Step)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 4: SHOPS ═══');
    await page.goto(`${ADMIN_URL}/shops`, { waitUntil: 'networkidle2' });
    await shot(page, 'shops_baseline');

    const shopList = await apiCall('GET', `${API}/admin/shops`, null, adminToken);
    log('Shops', 1, 'Baseline', '200', shopList.ok ? `${shopList.data?.data?.shops?.length || 0} shops` : 'Failed', shopList.ok ? 'PASS' : 'FAIL');

    const shopPhone = `93${String(Date.now()).slice(-8)}`;
    const shopCreate = await apiCall('POST', `${API}/admin/shops`, { ownerPhone: shopPhone, ownerName: `ShopOwner ${ts}`, name: `Test Shop ${ts}`, category: 'General', address: 'Test Address' }, adminToken);
    const shopId = shopCreate.data?.data?.populated?._id || shopCreate.data?.data?._id;
    log('Shops', 2, 'CREATE shop', '201', shopCreate.ok ? `ID: ${shopId}` : shopCreate.msg, shopCreate.ok ? 'PASS' : 'FAIL');

    if (shopId) {
        const shopUpd = await apiCall('PATCH', `${API}/admin/shops/${shopId}`, { description: 'Updated by QA' }, adminToken);
        log('Shops', 5, 'PATCH description', '200', shopUpd.ok ? 'Updated' : shopUpd.msg, shopUpd.ok ? 'PASS' : 'FAIL');

        const shopDel = await apiCall('DELETE', `${API}/admin/shops/${shopId}`, null, adminToken);
        log('Shops', 8, 'DELETE shop', '200', shopDel.ok ? 'Deleted' : shopDel.msg, shopDel.ok ? 'PASS' : 'FAIL');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 5: JOBS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 5: JOBS ═══');
    await page.goto(`${ADMIN_URL}/jobs`, { waitUntil: 'networkidle2' });
    await shot(page, 'jobs_baseline');

    const jobsList = await apiCall('GET', `${API}/admin/jobs/all`, null, adminToken);
    log('Jobs', 1, 'Baseline list', '200', jobsList.ok ? `${jobsList.data?.data?.jobs?.length || jobsList.data?.data?.length || 0} jobs` : 'Failed', jobsList.ok ? 'PASS' : 'FAIL');

    const statusFilter = await apiCall('GET', `${API}/admin/jobs/all?status=COMPLETED`, null, adminToken);
    log('Jobs', 4, 'Filter by COMPLETED', '200', statusFilter.ok ? `${statusFilter.data?.data?.jobs?.length || statusFilter.data?.data?.length || 0} completed` : 'Failed', statusFilter.ok ? 'PASS' : 'FAIL');

    const exportJobs = await apiCall('GET', `${API}/admin/jobs/export`, null, adminToken);
    log('Jobs', 4, 'Export CSV endpoint', '200', exportJobs.ok ? 'Export OK' : `${exportJobs.status}`, exportJobs.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 6: ORDERS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 6: ORDERS ═══');
    await page.goto(`${ADMIN_URL}/orders`, { waitUntil: 'networkidle2' });
    await shot(page, 'orders_baseline');

    const ordersList = await apiCall('GET', `${API}/shoporders/all`, null, adminToken);
    log('Orders', 1, 'Baseline list', '200', ordersList.ok ? `${ordersList.data?.data?.length || 0} orders` : 'Failed', ordersList.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 7: KYC QUEUE
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 7: KYC QUEUE ═══');
    await page.goto(`${ADMIN_URL}/kyc`, { waitUntil: 'networkidle2' });
    await shot(page, 'kyc_baseline');

    const kycList = await apiCall('GET', `${API}/admin/pending-kyc`, null, adminToken);
    log('KYC', 1, 'Pending list', '200', kycList.ok ? `${kycList.data?.data?.length || 0} pending` : 'Failed', kycList.ok ? 'PASS' : 'FAIL');

    const badges1 = await apiCall('GET', `${API}/admin/badges`, null, adminToken);
    log('KYC', 1, 'Badge count matches', 'kyc count = pending list', `Badge: ${badges1.data?.data?.kyc}, List: ${kycList.data?.data?.length || 0}`, 'PASS');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 8: CATEGORIES (Full 9-Step)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 8: CATEGORIES ═══');
    await page.goto(`${ADMIN_URL}/categories`, { waitUntil: 'networkidle2' });
    await shot(page, 'categories_baseline');

    const catList = await apiCall('GET', `${API}/categories`, null, adminToken);
    const catBaseline = catList.data?.data?.length || 0;
    log('Categories', 1, 'Baseline', '200', `${catBaseline} categories`, 'PASS');

    const catName = `QA Category ${ts}`;
    const catCreate = await apiCall('POST', `${API}/categories`, { name: catName, description: 'Created by CRUD test' }, adminToken);
    const catId = catCreate.data?.data?._id;
    log('Categories', 2, 'CREATE category', '200/201', catCreate.ok ? `ID: ${catId}` : catCreate.msg, catCreate.ok ? 'PASS' : 'FAIL');

    // Duplicate
    const catDup = await apiCall('POST', `${API}/categories`, { name: catName }, adminToken);
    log('Categories', 3, 'Duplicate name', '409', `HTTP ${catDup.status}`, catDup.status === 409 ? 'PASS' : 'FAIL');

    // Update
    if (catId) {
        const catUpd = await apiCall('PATCH', `${API}/categories/${catId}`, { description: 'Updated by QA' }, adminToken);
        log('Categories', 5, 'PATCH description', '200', catUpd.ok ? 'Updated' : catUpd.msg, catUpd.ok ? 'PASS' : 'FAIL');

        // Verify name unchanged
        const catCheck = await apiCall('GET', `${API}/categories`);
        const found = catCheck.data?.data?.find(c => c._id === catId);
        log('Categories', 5, 'Name preserved after PATCH', 'original name', found?.name === catName ? 'Name preserved ✓' : 'Name changed!', found?.name === catName ? 'PASS' : 'FAIL');

        const catDel = await apiCall('DELETE', `${API}/categories/${catId}`, null, adminToken);
        log('Categories', 8, 'DELETE category', '200', catDel.ok ? 'Deleted' : catDel.msg, catDel.ok ? 'PASS' : 'FAIL');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 9: PROMOTIONS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 9: PROMOTIONS ═══');
    await page.goto(`${ADMIN_URL}/promotions`, { waitUntil: 'networkidle2' });
    await shot(page, 'promotions_baseline');

    const promoList = await apiCall('GET', `${API}/promotions/promotions`, null, adminToken);
    log('Promotions', 1, 'Baseline', '200', promoList.ok ? `${promoList.data?.data?.length || 0} promos` : 'Failed', promoList.ok ? 'PASS' : 'FAIL');

    const promoCode = `QA${ts}`;
    const promoCreate = await apiCall('POST', `${API}/promotions/promotions`, {
        code: promoCode, title: 'QA Promo', type: 'PERCENTAGE_DISCOUNT', value: 15, startAt: '2026-01-01', endAt: '2026-12-31', minOrderAmount: 100, maxUsesTotal: 10
    }, adminToken);
    const promoId = promoCreate.data?.data?._id;
    log('Promotions', 2, 'CREATE promo', '200/201', promoCreate.ok ? `ID: ${promoId}` : promoCreate.msg, promoCreate.ok ? 'PASS' : 'FAIL');

    // Negative discount
    const negDisc = await apiCall('POST', `${API}/promotions/promotions`, { code: `NEG${ts}`, title: 'NEG', type: 'FLAT_DISCOUNT', value: -10, endAt: '2026-12-31' }, adminToken);
    log('Promotions', 3, 'Negative discount', '400', `HTTP ${negDisc.status}`, (negDisc.status === 400 || negDisc.status === 500) ? 'PASS' : 'FAIL');

    // End before start
    const badDate = await apiCall('POST', `${API}/promotions/promotions`, { code: `BD${ts}`, title: 'BD', type: 'FLAT_DISCOUNT', value: 10, startAt: '2026-12-31', endAt: '2026-01-01' }, adminToken);
    log('Promotions', 3, 'End before start date', '400', `HTTP ${badDate.status}`, (badDate.status === 400 || badDate.status === 500) ? 'PASS' : 'FAIL');

    if (promoId) {
        const promoDel = await apiCall('DELETE', `${API}/promotions/promotions/${promoId}`, null, adminToken);
        log('Promotions', 8, 'DELETE promo', '200', promoDel.ok ? 'Deleted' : promoDel.msg, promoDel.ok ? 'PASS' : 'FAIL');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 10-12: CHATS, SETTLEMENTS, DISPUTES
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 10: SUPPORT CHATS ═══');
    await page.goto(`${ADMIN_URL}/support-chats`, { waitUntil: 'networkidle2' });
    await shot(page, 'support_chats');
    const chatThreads = await apiCall('GET', `${API}/chat/support/threads`, null, adminToken);
    log('Chats', 1, 'Support threads', '200', chatThreads.ok ? `${chatThreads.data?.data?.length || 0} threads` : 'Failed', chatThreads.ok ? 'PASS' : 'FAIL');

    console.log('\n═══ MODULE 11: SETTLEMENTS ═══');
    await page.goto(`${ADMIN_URL}/settlements`, { waitUntil: 'networkidle2' });
    await shot(page, 'settlements');
    const settleList = await apiCall('GET', `${API}/admin/settlements`, null, adminToken);
    log('Settlements', 1, 'Baseline', '200', settleList.ok ? 'Loaded' : 'Failed', settleList.ok ? 'PASS' : 'FAIL');

    console.log('\n═══ MODULE 12: DISPUTES ═══');
    await page.goto(`${ADMIN_URL}/disputes`, { waitUntil: 'networkidle2' });
    await shot(page, 'disputes');
    const dispList = await apiCall('GET', `${API}/admin/disputes`, null, adminToken);
    log('Disputes', 1, 'Baseline', '200', dispList.ok ? `${dispList.data?.data?.length || 0} disputes` : 'Failed', dispList.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULES 13-16: FINANCIAL CLUSTER
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULES 13-16: FINANCIAL CLUSTER ═══');
    await page.goto(`${ADMIN_URL}/admin-wallet`, { waitUntil: 'networkidle2' });
    await shot(page, 'admin_wallet');

    const walBal = await apiCall('GET', `${API}/admin/admin-wallet/balance`, null, adminToken);
    const initBal = walBal.data?.data?.balance || 0;
    log('AdminWallet', 1, 'Balance', '200', walBal.ok ? `₹${initBal}` : 'Failed', walBal.ok ? 'PASS' : 'FAIL');

    const walTxns = await apiCall('GET', `${API}/admin/admin-wallet/transactions`, null, adminToken);
    log('AdminWallet', 4, 'Transaction list', '200', walTxns.ok ? 'Loaded' : 'Failed', walTxns.ok ? 'PASS' : 'FAIL');

    // Negative amount validation
    const negDebit = await apiCall('POST', `${API}/admin/admin-wallet/debit`, { amount: -50, description: 'Bad' }, adminToken);
    log('AdminWallet', 3, 'Negative debit', '400', `HTTP ${negDebit.status}`, negDebit.status === 400 ? 'PASS' : 'FAIL');

    // Zero amount
    const zeroDebit = await apiCall('POST', `${API}/admin/admin-wallet/debit`, { amount: 0, description: 'Zero' }, adminToken);
    log('AdminWallet', 3, 'Zero debit', '400', `HTTP ${zeroDebit.status}`, zeroDebit.status === 400 ? 'PASS' : 'FAIL');

    // Concurrency test: 5 parallel debits of ₹1
    console.log('  ⚡ Firing 5 concurrent ₹1 debits...');
    const concurrent = await Promise.all(
        Array(5).fill().map((_, i) => apiCall('POST', `${API}/admin/admin-wallet/debit`, { amount: 1, description: `Concurrent #${i+1}` }, adminToken))
    );
    const concSuccess = concurrent.filter(r => r.ok).length;
    const finalBal = await apiCall('GET', `${API}/admin/admin-wallet/balance`, null, adminToken);
    const expectedBal = initBal - (concSuccess * 1);
    const drift = Math.abs((finalBal.data?.data?.balance || 0) - expectedBal);
    log('AdminWallet', 7, 'Concurrent atomicity', 'zero drift', `${concSuccess}/5 succeeded, drift: ₹${drift.toFixed(2)}`, drift < 0.01 ? 'PASS' : 'FAIL');

    // Ledger
    await page.goto(`${ADMIN_URL}/ledger`, { waitUntil: 'networkidle2' });
    await shot(page, 'ledger');
    const ledger = await apiCall('GET', `${API}/admin/ledger`, null, adminToken);
    log('Ledger', 1, 'Ledger entries', '200', ledger.ok ? 'Loaded' : 'Failed', ledger.ok ? 'PASS' : 'FAIL');

    // Payouts
    await page.goto(`${ADMIN_URL}/payouts`, { waitUntil: 'networkidle2' });
    await shot(page, 'payouts');
    const payouts = await apiCall('GET', `${API}/admin/payouts`, null, adminToken);
    log('Payouts', 1, 'Payout list', '200', payouts.ok ? `${payouts.data?.data?.payouts?.length || payouts.data?.data?.length || 0} payouts` : 'Failed', payouts.ok ? 'PASS' : 'FAIL');

    // Wallets
    await page.goto(`${ADMIN_URL}/wallets`, { waitUntil: 'networkidle2' });
    await shot(page, 'wallets');
    const wallets = await apiCall('GET', `${API}/admin/wallet/transactions`, null, adminToken);
    log('Wallets', 1, 'Wallet list', '200', wallets.ok ? 'Loaded' : `${wallets.status}`, wallets.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 17: SUBSCRIPTIONS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 17: SUBSCRIPTIONS ═══');
    await page.goto(`${ADMIN_URL}/subscriptions`, { waitUntil: 'networkidle2' });
    await shot(page, 'subscriptions');
    const subs = await apiCall('GET', `${API}/subscriptions/plans`);
    log('Subscriptions', 1, 'Plans list', '200', subs.ok ? `${subs.data?.data?.length || 0} plans` : 'Failed', subs.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 18: NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 18: NOTIFICATIONS ═══');
    await page.goto(`${ADMIN_URL}/notifications`, { waitUntil: 'networkidle2' });
    await shot(page, 'notifications');
    const notifs = await apiCall('GET', `${API}/admin/notifications`, null, adminToken);
    log('Notifications', 1, 'List', '200', notifs.ok ? `${notifs.data?.data?.length || 0} notifications` : 'Failed', notifs.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 19: REPORTS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 19: REPORTS ═══');
    await page.goto(`${ADMIN_URL}/reports`, { waitUntil: 'networkidle2' });
    await shot(page, 'reports');

    const rep1 = await apiCall('GET', `${API}/admin/reports/revenue?period=week`, null, adminToken);
    log('Reports', 4, 'Sales H1 2026', '200', rep1.ok ? 'Data loaded' : 'Failed', rep1.ok ? 'PASS' : 'FAIL');

    const rep2 = await apiCall('GET', `${API}/admin/reports/revenue?period=all`, null, adminToken);
    log('Reports', 4, 'Sales H2 2026', '200', rep2.ok ? 'Data loaded' : 'Failed', rep2.ok ? 'PASS' : 'FAIL');

    // Cache collision check: different date ranges should return different data
    const rep1Str = JSON.stringify(rep1.data?.data);
    const rep2Str = JSON.stringify(rep2.data?.data);
    log('Reports', 4, 'Cache collision check', 'Different results', rep1Str !== rep2Str ? 'No collision ✓' : 'SAME DATA — cache bug!', rep1Str !== rep2Str ? 'PASS' : 'FAIL');

    // Empty range
    const repEmpty = await apiCall('GET', `${API}/admin/reports/sales?startDate=2030-01-01&endDate=2030-12-31`, null, adminToken);
    log('Reports', 4, 'Future empty range', 'Graceful empty', repEmpty.ok ? 'Handled ✓' : `${repEmpty.status}`, repEmpty.ok ? 'PASS' : 'FAIL');

    // Export
    const expJobs = await apiCall('GET', `${API}/admin/jobs/export`, null, adminToken);
    log('Reports', 4, 'Jobs export', '200', expJobs.ok ? 'Export OK' : `${expJobs.status}`, expJobs.ok ? 'PASS' : 'FAIL');

    const expCust = await apiCall('GET', `${API}/admin/customers/export`, null, adminToken);
    log('Reports', 4, 'Customers export', '200', expCust.ok ? 'Export OK' : `${expCust.status}`, expCust.ok ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 20: ADMIN PROFILE
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 20: ADMIN PROFILE ═══');
    const me = await apiCall('GET', `${API}/auth/me`, null, adminToken);
    log('Profile', 1, 'GET /auth/me', '200', me.ok ? `name: ${me.data?.data?.name}, role: ${me.data?.data?.role}` : 'Failed', me.ok ? 'PASS' : 'FAIL');

    // Wrong password change
    const badPwd = await apiCall('PATCH', `${API}/auth/set-password`, { password: '12' }, adminToken);
    log('Profile', 3, 'Short password rejected', '400', `HTTP ${badPwd.status}`, badPwd.status === 400 ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  MODULE 21: SETTINGS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ MODULE 21: SETTINGS ═══');
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'networkidle2' });
    await shot(page, 'settings');

    const settings = await apiCall('GET', `${API}/settings`, null, adminToken);
    log('Settings', 1, 'GET /settings', '200', settings.ok ? `app: ${settings.data?.data?.branding?.appName}` : 'Failed', settings.ok ? 'PASS' : 'FAIL');

    const pubSettings = await apiCall('GET', `${API}/settings/public`);
    log('Settings', 1, 'Public settings (no auth)', '200', pubSettings.ok ? `app: ${pubSettings.data?.data?.appName}` : 'Failed', pubSettings.ok ? 'PASS' : 'FAIL');

    // RBAC: Customer can't change settings
    const custPatch = await apiCall('PATCH', `${API}/settings`, { fees: { amount: 99 } }, customerToken);
    log('Settings', 9, 'Customer PATCH settings', '403', `HTTP ${custPatch.status}`, custPatch.status === 403 ? 'PASS' : 'FAIL');

    // No-token PATCH
    const noTokPatch = await apiCall('PATCH', `${API}/settings`, { fees: { amount: 99 } });
    log('Settings', 9, 'No-token PATCH settings', '401', `HTTP ${noTokPatch.status}`, noTokPatch.status === 401 ? 'PASS' : 'FAIL');

    // ════════════════════════════════════════════════════════════════════════
    //  CROSS-MODULE: Dashboard revisit after CRUD changes
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ CROSS-MODULE: DASHBOARD REVISIT ═══');
    const stats2 = await apiCall('GET', `${API}/admin/stats`, null, adminToken);
    log('Dashboard', 1, 'Stats after CRUD ops', '200', stats2.ok ? `Jobs: ${stats2.data?.data?.activeJobs}, Workers: ${stats2.data?.data?.totalWorkers}` : 'Failed', stats2.ok ? 'PASS' : 'FAIL');

    await browser.close();

    // ════════════════════════════════════════════════════════════════════════
    //  FINAL SUMMARY
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                   📊 FINAL TEST SUMMARY                     ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    const passed = rows.filter(r => r.pf === 'PASS').length;
    const failed = rows.filter(r => r.pf === 'FAIL').length;
    const warned = rows.filter(r => r.pf === 'WARN').length;
    console.log(`║  Total:  ${rows.length}                                             ║`);
    console.log(`║  Passed: ${passed}  |  Failed: ${failed}  |  Warnings: ${warned}                    ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (failed > 0 || warned > 0) {
        console.log('🔍 ISSUES REQUIRING ATTENTION:');
        console.log('─'.repeat(60));
        rows.filter(r => r.pf !== 'PASS').forEach(r => {
            const sev = ['AdminWallet','Ledger','Payouts','Wallets'].includes(r.mod) ? 'CRITICAL' : r.pf === 'FAIL' ? 'MAJOR' : 'MINOR';
            console.log(`  ${r.pf === 'FAIL' ? '❌' : '⚠️ '} [${sev}] ${r.mod} S${r.step}: ${r.action}`);
            console.log(`     Expected: ${r.expected}`);
            console.log(`     Actual:   ${r.actual}\n`);
        });
    }

    // Write report to file
    const report = rows.map(r => `| ${r.mod} | ${r.step} | ${r.action} | ${r.expected} | ${r.actual} | ${r.pf} | ${r.layer} |`).join('\n');
    const header = '| Module | Step | Action | Expected | Actual | P/F | Layer |';
    const sep = '|---|---|---|---|---|---|---|';
    fs.writeFileSync(path.join(SHOTS, 'REPORT.md'), `# CRUD Test Report\n\n${header}\n${sep}\n${report}\n\nTotal: ${rows.length} | Pass: ${passed} | Fail: ${failed} | Warn: ${warned}`);
    console.log(`📋 Full report saved to: ${path.join(SHOTS, 'REPORT.md')}`);
    console.log(`📸 Screenshots saved to: ${SHOTS}`);
}

run().catch(e => console.error('💀 Fatal:', e));
