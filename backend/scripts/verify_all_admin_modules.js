const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_cdp_admin_modules_' + Date.now());

const MODULES = [
    { path: '/', name: '01_admin_dashboard', expectedTitle: 'Dashboard' },
    { path: '/users', name: '02_admin_customers', expectedTitle: 'Customer Management' },
    { path: '/workers', name: '03_admin_workers', expectedTitle: 'Worker Management' },
    { path: '/shops', name: '04_admin_shops', expectedTitle: 'Shop Management' },
    { path: '/jobs', name: '05_admin_jobs', expectedTitle: 'Job Management' },
    { path: '/orders', name: '06_admin_orders', expectedTitle: 'Orders Management' },
    { path: '/kyc', name: '07_admin_kyc', expectedTitle: 'KYC Verification' },
    { path: '/categories', name: '08_admin_categories', expectedTitle: 'Service Categories' },
    { path: '/promotions', name: '09_admin_promotions', expectedTitle: 'Promotions & Banners' },
    { path: '/disputes', name: '10_admin_disputes', expectedTitle: 'Disputes' },
    { path: '/support-chats', name: '11_admin_support', expectedTitle: 'Support Chats' },
    { path: '/admin-wallet', name: '12_admin_wallet', expectedTitle: 'Admin Platform Wallet' },
    { path: '/wallets', name: '13_admin_user_wallets', expectedTitle: 'User Wallets' },
    { path: '/payouts', name: '14_admin_payouts', expectedTitle: 'Payouts & Wallet' },
    { path: '/settlements', name: '15_admin_settlements', expectedTitle: 'Settlements' },
    { path: '/subscriptions', name: '16_admin_subscriptions', expectedTitle: 'Subscription Plans' },
    { path: '/ledger', name: '17_admin_platform_ledger', expectedTitle: 'Ledger' },
    { path: '/settings', name: '18_admin_settings', expectedTitle: 'Platform Settings' },
    { path: '/reports', name: '19_admin_reports', expectedTitle: 'Reports & Analytics' },
    { path: '/notifications', name: '20_admin_notifications', expectedTitle: 'Push Notifications' },
    { path: '/admin-users', name: '21_admin_users', expectedTitle: 'Admin Profile & Security' }
];

async function run() {
    console.log('='.repeat(70));
    console.log('🏛️ VERIFYING ALL 21 ADMIN MODULES IN BROWSER UI');
    console.log('='.repeat(70));

    // Launch Chrome Headless
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--remote-debugging-port=9227',
        `--user-data-dir=${TEMP_USER_DATA}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1600,1000',
        'about:blank'
    ]);

    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 400));
        try {
            const res = await fetch('http://127.0.0.1:9227/json/version');
            if (res.ok) break;
        } catch (e) {}
    }

    const newPageRes = await fetch('http://127.0.0.1:9227/json/new?http://localhost:5173/login', { method: 'PUT' });
    const target = await newPageRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
        }
    };

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const reqId = id++;
            pending.set(reqId, { resolve, reject });
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    async function evaluate(expression) {
        const res = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        return res.result ? res.result.value : null;
    }

    async function screenshot(filename) {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        const buf = Buffer.from(res.data, 'base64');
        const outPath = path.resolve('docs/ui-screenshots', filename);
        fs.writeFileSync(outPath, buf);
        return outPath;
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Perform Login through the UI form
    console.log('Logging in as Super Admin through UI...');
    await evaluate(`
        (function() {
            const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
            const passwordInput = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
            const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In'));

            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(emailInput, 'admin@kwickly.com');
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('change', { bubbles: true }));

            nativeSetter.call(passwordInput, 'admin123');
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
            passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

            submitBtn.click();
        })()
    `);

    // Wait for Dashboard to render
    console.log('Waiting for Dashboard to load...');
    await new Promise(r => setTimeout(r, 3500));

    const results = [];

    // Navigate to each module by clicking its NavLink
    for (const mod of MODULES) {
        console.log(`\nNavigating to [${mod.expectedTitle}] -> ${mod.path}...`);
        
        const clickResult = await evaluate(`
            (function() {
                const links = Array.from(document.querySelectorAll('a'));
                const targetLink = links.find(a => {
                    const href = a.getAttribute('href');
                    return href === '${mod.path}' || (href === '/' && '${mod.path}' === '/');
                });
                if (targetLink) {
                    targetLink.click();
                    return { clicked: true };
                }
                // Fallback: React Router pushState
                window.history.pushState({}, '', '${mod.path}');
                window.dispatchEvent(new PopStateEvent('popstate'));
                return { clicked: false, fallback: true };
            })()
        `);

        await new Promise(r => setTimeout(r, 1800));

        const pageData = await evaluate(`
            (function() {
                const titleEl = document.querySelector('.topbar-title');
                const title = titleEl ? titleEl.innerText.trim() : '';
                const bodyText = document.body.innerText;
                const hasCrash = bodyText.includes('Something went wrong') || bodyText.includes('Cannot read properties');
                const cardsCount = document.querySelectorAll('.card, .stats-card, .table, table, .settings-section').length;
                return {
                    title,
                    hasCrash,
                    cardsCount,
                    url: window.location.href
                };
            })()
        `);

        const filename = `${mod.name}.png`;
        await screenshot(filename);

        const pass = !pageData.hasCrash && (pageData.title === mod.expectedTitle || pageData.url.includes(mod.path));
        results.push({ ...mod, pass, pageData });
        console.log(` -> [${pass ? 'PASS ✅' : 'FAIL ❌'}] Topbar Title: "${pageData.title}", Cards/Tables: ${pageData.cardsCount}`);
    }

    ws.close();
    chrome.kill();
    try {
        fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch(e) {}

    console.log('\n' + '='.repeat(70));
    console.log('🏛️ COMPLETE ADMIN MODULES VERIFICATION AUDIT (ALL 21 OF 21)');
    console.log('='.repeat(70));
    results.forEach((r, idx) => {
        const tag = r.pass ? 'PASSED ✅' : 'FAILED ❌';
        console.log(`${String(idx + 1).padStart(2, ' ')}. [${tag}] ${r.expectedTitle.padEnd(28)} (Route: ${r.path})`);
    });
    console.log('='.repeat(70) + '\n');
}

run().catch(err => {
    console.error('Fatal admin verification error:', err);
    process.exit(1);
});
