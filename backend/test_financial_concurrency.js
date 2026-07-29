const axios = require('axios');
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

async function testConcurrency() {
    console.log('====================================================');
    console.log('⚡ Starting Financial Atomic Concurrency Stress Test');
    console.log('====================================================\n');

    try {
        // 1. Login as Admin
        const adminRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@kwickly.com',
            password: 'admin123',
            role: 'ADMIN'
        });
        const adminToken = adminRes.data.data.token;
        const adminHeader = { headers: { Authorization: `Bearer ${adminToken}` } };

        // 2. Fetch initial Admin Wallet Balance
        const initialBalRes = await axios.get(`${BASE_URL}/admin/admin-wallet/balance`, adminHeader);
        const initialBalance = initialBalRes.data.data?.balance || 0;
        console.log(`💰 Initial Admin Wallet Balance: ₹${initialBalance}`);

        // 3. Fire 10 simultaneous credit/debit API calls in parallel
        console.log('\n🚀 Firing 10 concurrent wallet debit requests of ₹10 each...');
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(
                axios.post(`${BASE_URL}/admin/admin-wallet/debit`, {
                    amount: 10,
                    description: `Concurrent test debit #${i+1}`
                }, adminHeader).catch(err => ({ error: err.response?.data?.message || err.message }))
            );
        }

        const results = await Promise.all(promises);
        const successes = results.filter(r => r.data && r.data.status === 'success').length;
        const failures = results.filter(r => r.error).length;

        console.log(`✅ Successful debits: ${successes}`);
        console.log(`❌ Rejected/failed debits: ${failures}`);

        // 4. Verify Final Balance
        const finalBalRes = await axios.get(`${BASE_URL}/admin/admin-wallet/balance`, adminHeader);
        const finalBalance = finalBalRes.data.data?.balance || 0;
        console.log(`💰 Final Admin Wallet Balance: ₹${finalBalance}`);

        const expectedBalance = initialBalance - (successes * 10);
        const isAtomicCorrect = Math.abs(finalBalance - expectedBalance) < 0.01;

        if (isAtomicCorrect) {
            console.log(`\n🎉 Financial Atomicity Test PASSED! Expected ₹${expectedBalance}, actual ₹${finalBalance}`);
        } else {
            console.error(`\n🚨 Financial Atomicity Failure! Expected ₹${expectedBalance}, got ₹${finalBalance}`);
        }

    } catch (err) {
        console.error('❌ Concurrency test error:', err.response?.data || err.message);
    }
}

testConcurrency();
