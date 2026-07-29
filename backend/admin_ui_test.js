const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ADMIN_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.join(__dirname, 'ui_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR);

const results = [];

function log(status, page, detail = '') {
    const sym = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : '❌';
    results.push({ status, page, detail });
    console.log(`  ${sym} [${page}] ${detail}`);
}

const PAGES = [
    { name: 'Dashboard',      path: '/' },
    { name: 'Customers',      path: '/users' },
    { name: 'Workers',        path: '/workers' },
    { name: 'Shops',          path: '/shops' },
    { name: 'Jobs',           path: '/jobs' },
    { name: 'KYC Queue',      path: '/kyc' },
    { name: 'Categories',     path: '/categories' },
    { name: 'Admin Wallet',   path: '/admin-wallet' },
    { name: 'Wallets',        path: '/wallets' },
    { name: 'Payouts',        path: '/payouts' },
    { name: 'Settlements',    path: '/settlements' },
    { name: 'Promotions',     path: '/promotions' },
    { name: 'Disputes',       path: '/disputes' },
    { name: 'Notifications',  path: '/notifications' },
    { name: 'Support Chats',  path: '/support-chats' },
    { name: 'Reports',        path: '/reports' },
    { name: 'Ledger',         path: '/ledger' },
    { name: 'Subscriptions',  path: '/subscriptions' },
    { name: 'Admin Users',    path: '/admin-users' },
    { name: 'Orders',         path: '/orders' },
    { name: 'Settings',       path: '/settings' },
];

async function run() {
    console.log('══════════════════════════════════════════════');
    console.log('  🖥️  Kwickly Admin — UI Screenshot & Visual QA');
    console.log('══════════════════════════════════════════════\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Step 1: Login ──────────────────────────────────────────────────────
    console.log('── Login Flow ──');
    try {
        await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '00_login_page.png') });

        // Fill form
        await page.type('input[type="email"]', 'admin@kwickly.com');
        await page.type('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        const url = page.url();

        if (url === `${ADMIN_URL}/` || url.endsWith('/')) {
            log('PASS', 'Login', `Redirected to dashboard: ${url}`);
        } else {
            log('WARN', 'Login', `Unexpected redirect to: ${url}`);
        }

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_dashboard.png') });
    } catch (e) {
        log('FAIL', 'Login', e.message);
        await browser.close();
        return;
    }

    // ── Step 2: Check Dashboard Stat Cards ────────────────────────────────
    console.log('\n── Dashboard Content Check ──');
    try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        const hasStats = ['Workers', 'Jobs', 'Revenue', 'Customer', 'Shop'].some(k => bodyText.includes(k));
        if (hasStats) log('PASS', 'Dashboard', 'Stat cards text detected');
        else log('WARN', 'Dashboard', 'Stat cards not found in page text');
    } catch (e) {
        log('FAIL', 'Dashboard', e.message);
    }

    // ── Step 3: Navigate all module pages ─────────────────────────────────
    console.log('\n── Module Pages ──');
    for (let i = 0; i < PAGES.length; i++) {
        const { name, path: pagePath } = PAGES[i];
        const screenshotFile = path.join(SCREENSHOTS_DIR, `${String(i + 2).padStart(2, '0')}_${name.replace(/\s+/g, '_').toLowerCase()}.png`);
        const pageErrors = [];

        try {
            // Collect errors for this page
            page.removeAllListeners('pageerror');
            page.on('pageerror', err => pageErrors.push(err.message));

            await page.goto(`${ADMIN_URL}${pagePath}`, { waitUntil: 'networkidle2', timeout: 15000 });
            await new Promise(r => setTimeout(r, 1000)); // extra settle time

            const finalUrl = page.url();
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
            await page.screenshot({ path: screenshotFile, fullPage: false });

            // Check for crash indicators
            const isCrashed = bodyText.toLowerCase().includes('something went wrong')
                           || bodyText.toLowerCase().includes('error boundary')
                           || bodyText.toLowerCase().includes('cannot read')
                           || bodyText.toLowerCase().includes('undefined is not');

            const isBlank = bodyText.trim().length < 30;

            if (isCrashed) {
                log('FAIL', name, `Page crashed: ${bodyText.substring(0, 100)}`);
            } else if (isBlank) {
                log('WARN', name, `Possibly blank page (text length: ${bodyText.trim().length})`);
            } else if (pageErrors.length > 0) {
                log('WARN', name, `Loaded but JS errors: ${pageErrors[0].substring(0, 100)}`);
            } else {
                log('PASS', name, `Loaded OK @ ${finalUrl} | preview: "${bodyText.substring(0, 60).replace(/\n/g, ' ')}..."`);
            }
        } catch (e) {
            log('FAIL', name, `Navigation error: ${e.message}`);
        }
    }

    await browser.close();

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`📊 UI TEST RESULTS: ${passed} PASS | ${warned} WARN | ${failed} FAIL | Total: ${results.length}`);
    console.log(`📸 Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('══════════════════════════════════════════════\n');

    if (warned + failed > 0) {
        console.log('🔍 Issues:');
        results.filter(r => r.status !== 'PASS').forEach(r => {
            console.log(`  ${r.status === 'FAIL' ? '❌' : '⚠️ '} [${r.page}] ${r.detail}`);
        });
    }
}

run().catch(e => console.error('Fatal error:', e));
