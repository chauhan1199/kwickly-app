/**
 * Master Real-Browser End-to-End Test Suite for Kwickly Admin Panel
 * Using Puppeteer with Google Chrome installed on the host system.
 */

const puppeteer = require('../node_modules/puppeteer');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_BASE = 'http://localhost:5173';
const MEDIA_DIR = 'C:\\Users\\chauh\\.gemini\\antigravity-ide\\brain\\b35f3468-3c76-48e5-a3d5-0f5a59107435\\.tempmediaStorage';

const results = [];
function recordStep(step, name, passed, meta = null) {
    results.push({ step, name, pass: passed, meta });
    console.log(`[${passed ? '✅ PASS' : '❌ FAIL'}] Step ${step}: ${name}`);
    if (!passed && meta) console.error('         Error:', meta);
}

async function runBrowserE2E() {
    console.log('='.repeat(80));
    console.log('   🌐 REAL BROWSER UI TEST SUITE FOR KWICKLY ADMIN PANEL');
    console.log('='.repeat(80) + '\n');

    if (!fs.existsSync(MEDIA_DIR)) {
        fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    try {
        // 1. Navigate to Login Page
        console.log('Step 1: Navigating to Admin Login page...');
        await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({ path: path.join(MEDIA_DIR, 'admin_01_login.png') });
        const hasLoginForm = await page.$('input') !== null;
        recordStep('1', 'Admin Login Page Loaded & Rendered', hasLoginForm);

        // 2. Perform Login
        console.log('Step 2: Submitting Admin Credentials (9999999999 / admin123)...');
        const inputs = await page.$$('input');
        if (inputs.length >= 2) {
            await inputs[0].click({ clickCount: 3 });
            await inputs[0].type('9999999999');
            await inputs[1].click({ clickCount: 3 });
            await inputs[1].type('admin123');
        }

        const loginBtn = await page.$('button[type="submit"]') || await page.$('button');
        await loginBtn.click();

        // 3. Wait for Dashboard to Load
        console.log('Step 3: Waiting for Dashboard to load...');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(MEDIA_DIR, 'admin_02_dashboard.png') });

        const url = page.url();
        const isLoggedIn = !url.includes('/login');
        recordStep('2', 'Admin Authentication & Dashboard Redirect', isLoggedIn, { url });

        // 4. Verify Dashboard Live Metrics
        const pageText = await page.evaluate(() => document.body.innerText);
        const hasLiveStats = pageText.includes('Customers') || pageText.includes('Workers') || pageText.includes('Total');
        recordStep('3', 'Dashboard Live Metrics Rendered', hasLiveStats);

        // Helper to navigate and capture screenshot
        async function testPage(stepNum, route, name, fileName, contentCheck) {
            console.log(`Step ${stepNum}: Navigating to ${name} (${route})...`);
            await page.goto(`${ADMIN_BASE}${route}`, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
            await page.screenshot({ path: path.join(MEDIA_DIR, fileName) });

            const text = await page.evaluate(() => document.body.innerText);
            const passed = text.toLowerCase().includes(contentCheck.toLowerCase());
            recordStep(stepNum, `${name} Screen Rendered & Verified`, passed);
        }

        // 5. Operations
        await testPage('4', '/users', 'Customer Management', 'admin_03_customers.png', 'customer');
        await testPage('5', '/workers', 'Worker Management', 'admin_04_workers.png', 'worker');
        await testPage('6', '/shops', 'Shop Management', 'admin_05_shops.png', 'shop');
        await testPage('7', '/jobs', 'Job Management', 'admin_06_jobs.png', 'job');
        await testPage('8', '/orders', 'Orders Management', 'admin_07_orders.png', 'order');
        await testPage('9', '/kyc', 'KYC Verification Queue', 'admin_08_kyc.png', 'kyc');
        await testPage('10', '/categories', 'Service Categories', 'admin_09_categories.png', 'categor');

        // 6. Engagement & Support
        await testPage('11', '/promotions', 'Promotions & Banners', 'admin_10_promotions.png', 'promotion');
        await testPage('12', '/disputes', 'Disputes & Refunds', 'admin_11_disputes.png', 'dispute');
        await testPage('13', '/support-chats', 'Support Chats', 'admin_12_support.png', 'support');

        // 7. Finance & Treasury
        await testPage('14', '/admin-wallet', 'Admin Platform Wallet', 'admin_13_admin_wallet.png', 'wallet');
        await testPage('15', '/wallets', 'User Wallets', 'admin_14_user_wallets.png', 'wallet');
        await testPage('16', '/payouts', 'Worker Payouts', 'admin_15_payouts.png', 'payout');
        await testPage('17', '/settlements', 'Shop Settlements', 'admin_16_settlements.png', 'settlement');
        await testPage('18', '/subscriptions', 'Subscription Plans', 'admin_17_subscriptions.png', 'subscription');
        await testPage('19', '/ledger', 'Platform Ledger', 'admin_18_ledger.png', 'ledger');

        // 8. System & Reports
        await testPage('20', '/settings', 'Platform Settings', 'admin_19_settings.png', 'setting');
        await testPage('21', '/reports', 'Reports & Analytics', 'admin_20_reports.png', 'report');
        await testPage('22', '/notifications', 'Push Notifications Broadcast', 'admin_21_notifications.png', 'notification');
        await testPage('23', '/admin-users', 'Admin Profile & Security', 'admin_22_admin_users.png', 'admin');

    } catch (err) {
        console.error('\n❌ BROWSER E2E ERROR:', err.message);
        recordStep('ERR', 'Browser Automation Encountered Exception', false, err.message);
    } finally {
        await browser.close();

        console.log('\n' + '='.repeat(80));
        console.log('   📊 REAL BROWSER UI TEST VALIDATION REPORT');
        console.log('='.repeat(80));
        let passCount = 0;
        results.forEach(r => {
            if (r.pass) passCount++;
            console.log(`Step ${String(r.step).padEnd(4)}: ${r.name.padEnd(52)} [${r.pass ? 'PASS ✅' : 'FAIL ❌'}]`);
        });
        console.log('-'.repeat(80));
        console.log(`TOTAL PASSED: ${passCount} / ${results.length} (${Math.round((passCount / results.length) * 100)}%)`);
        console.log('='.repeat(80) + '\n');

        if (consoleErrors.length > 0) {
            console.log(`⚠️ Browser Console Errors Detected (${consoleErrors.length}):`);
            consoleErrors.slice(0, 5).forEach(e => console.log('  • ' + e));
        }

        process.exit(results.every(r => r.pass) ? 0 : 1);
    }
}

runBrowserE2E();
