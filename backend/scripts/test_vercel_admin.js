/**
 * End-to-End Real Browser Test for Vercel Deployed Admin Panel
 * URL: https://kwickly-app.vercel.app/
 */

const puppeteer = require('../node_modules/puppeteer');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_BASE = 'https://kwickly-app.vercel.app';
const MEDIA_DIR = 'C:\\Users\\chauh\\.gemini\\antigravity-ide\\brain\\b35f3468-3c76-48e5-a3d5-0f5a59107435\\.tempmediaStorage';

const results = [];
function recordStep(step, name, passed, meta = null) {
    results.push({ step, name, pass: passed, meta });
    console.log(`[${passed ? '✅ PASS' : '❌ FAIL'}] Step ${step}: ${name}`);
    if (!passed && meta) console.error('         Error:', meta);
}

async function runVercelAdminTest() {
    console.log('='.repeat(80));
    console.log('   🚀 REAL BROWSER TEST FOR VERCEL ADMIN PANEL (https://kwickly-app.vercel.app)');
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
        console.log('Step 1: Navigating to Vercel Admin Login page...');
        await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({ path: path.join(MEDIA_DIR, 'vercel_01_login.png') });
        recordStep('1', 'Vercel Admin Login Page Loaded & Rendered', true);

        // 2. Perform Login with email and password
        console.log('Step 2: Submitting Admin Credentials (admin@kwickly.com / admin123)...');
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.type('input[type="email"]', 'admin@kwickly.com');
        await page.type('input[type="password"]', 'admin123');

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);

        await new Promise(r => setTimeout(r, 2500));
        await page.screenshot({ path: path.join(MEDIA_DIR, 'vercel_02_dashboard.png') });

        const url = page.url();
        const isLoggedIn = !url.includes('/login');
        recordStep('2', 'Admin Authentication & Dashboard Redirect', isLoggedIn, { url });

        // 3. Verify Dashboard Live Metrics
        const pageText = await page.evaluate(() => document.body.innerText);
        const hasLiveStats = pageText.includes('Customers') || pageText.includes('Workers') || pageText.includes('Total') || pageText.includes('Revenue');
        recordStep('3', 'Dashboard Live Metrics Rendered', hasLiveStats);

        // Helper to test each navigation route
        async function testVercelPage(stepNum, route, name, fileName, contentCheck) {
            console.log(`Step ${stepNum}: Navigating to ${name} (${route})...`);
            await page.goto(`${ADMIN_BASE}${route}`, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
            await page.screenshot({ path: path.join(MEDIA_DIR, fileName) });

            const text = await page.evaluate(() => document.body.innerText);
            const passed = text.toLowerCase().includes(contentCheck.toLowerCase());
            recordStep(stepNum, `${name} Screen Rendered & Verified`, passed);
        }

        // 4. Test Operations Modules
        await testVercelPage('4', '/users', 'Customer Management', 'vercel_03_customers.png', 'customer');
        await testVercelPage('5', '/workers', 'Worker Management', 'vercel_04_workers.png', 'worker');
        await testVercelPage('6', '/shops', 'Shop Management', 'vercel_05_shops.png', 'shop');
        await testVercelPage('7', '/jobs', 'Job Management', 'vercel_06_jobs.png', 'job');
        await testVercelPage('8', '/orders', 'Orders Management', 'vercel_07_orders.png', 'order');
        await testVercelPage('9', '/kyc', 'KYC Verification Queue', 'vercel_08_kyc.png', 'kyc');
        await testVercelPage('10', '/categories', 'Service Categories', 'vercel_09_categories.png', 'categor');

        // 5. Test Engagement & Support
        await testVercelPage('11', '/promotions', 'Promotions & Banners', 'vercel_10_promotions.png', 'promotion');
        await testVercelPage('12', '/disputes', 'Disputes & Refunds', 'vercel_11_disputes.png', 'dispute');
        await testVercelPage('13', '/support-chats', 'Support Chats', 'vercel_12_support.png', 'support');

        // 6. Test Finance & Treasury
        await testVercelPage('14', '/admin-wallet', 'Admin Platform Wallet', 'vercel_13_admin_wallet.png', 'wallet');
        await testVercelPage('15', '/wallets', 'User Wallets', 'vercel_14_user_wallets.png', 'wallet');
        await testVercelPage('16', '/payouts', 'Worker Payouts', 'vercel_15_payouts.png', 'payout');
        await testVercelPage('17', '/settlements', 'Shop Settlements', 'vercel_16_settlements.png', 'settlement');
        await testVercelPage('18', '/subscriptions', 'Subscription Plans', 'vercel_17_subscriptions.png', 'subscription');
        await testVercelPage('19', '/ledger', 'Platform Ledger', 'vercel_18_ledger.png', 'ledger');

        // 7. Test System & Reports
        await testVercelPage('20', '/settings', 'Platform Settings', 'vercel_19_settings.png', 'setting');
        await testVercelPage('21', '/reports', 'Reports & Analytics', 'vercel_20_reports.png', 'report');
        await testVercelPage('22', '/notifications', 'Push Notifications Broadcast', 'vercel_21_notifications.png', 'notification');
        await testVercelPage('23', '/admin-users', 'Admin Profile & Security', 'vercel_22_admin_users.png', 'admin');

    } catch (err) {
        console.error('\n❌ VERCEL TEST ERROR:', err.message);
        recordStep('ERR', 'Exception Encountered', false, err.message);
    } finally {
        await browser.close();

        console.log('\n' + '='.repeat(80));
        console.log('   📊 VERCEL ADMIN PANEL BROWSER UI TEST REPORT');
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
            console.log(`⚠️ Browser Console Messages (${consoleErrors.length}):`);
            consoleErrors.slice(0, 5).forEach(e => console.log('  • ' + e));
        }

        process.exit(results.every(r => r.pass) ? 0 : 1);
    }
}

runVercelAdminTest();
