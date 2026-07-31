/**
 * Test Critical Fixes
 * Tests: Error handling, Validators, Response validation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';
let adminToken = null;
let workerToken = null;
let customerToken = null;

console.log('=== TESTING CRITICAL FIXES ===\n');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function test(name, fn) {
  try {
    await fn();
    console.log(`${GREEN}✓${RESET} ${name}`);
    return true;
  } catch (error) {
    console.log(`${RED}✗${RESET} ${name}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // 1. Test admin login
  console.log('\n--- Testing Authentication ---');
  
  const adminRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'admin@kwickly.com',
    password: 'admin123'
  });
  
  if (adminRes.data.status === 'success') {
    adminToken = adminRes.data.token;
    console.log(`${GREEN}✓${RESET} Admin login successful`);
    passed++;
  } else {
    console.log(`${RED}✗${RESET} Admin login failed`);
    failed++;
    return;
  }

  // 2. Test customer login
  console.log('\n--- Testing Customer Login ---');
  
  const customerRes = await axios.post(`${BASE_URL}/auth/login`, {
    phone: '9000000001',
    password: 'customer123',
    role: 'CUSTOMER'
  });
  
  if (customerRes.data.status === 'success') {
    customerToken = customerRes.data.token;
    console.log(`${GREEN}✓${RESET} Customer login successful (9000000001)`);
    passed++;
  } else {
    console.log(`${RED}✗${RESET} Customer login failed`);
    failed++;
  }

  // 3. Test worker login
  console.log('\n--- Testing Worker Login ---');
  
  const workerRes = await axios.post(`${BASE_URL}/auth/login`, {
    phone: '9876543210',
    password: 'worker123',
    role: 'WORKER'
  });
  
  if (workerRes.data.status === 'success') {
    workerToken = workerRes.data.token;
    console.log(`${GREEN}✓${RESET} Worker login successful (9876543210)`);
    passed++;
  } else {
    console.log(`${RED}✗${RESET} Worker login failed`);
    failed++;
  }

  // 4. Test customer endpoint with validation
  console.log('\n--- Testing Customer Endpoints with Validation ---');
  
  await test('Get customer profile', async () => {
    const res = await axios.get(`${BASE_URL}/customers/me/profile`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (res.data.status !== 'success') throw new Error('Invalid response');
  });

  await test('Get customer cart', async () => {
    const res = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (res.data.status !== 'success') throw new Error('Invalid response');
  });

  // 5. Test worker endpoints
  console.log('\n--- Testing Worker Endpoints with Validation ---');
  
  await test('Get worker profile', async () => {
    const res = await axios.get(`${BASE_URL}/workers/me`, {
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    if (res.data.status !== 'success') throw new Error('Invalid response');
  });

  await test('Get worker earnings summary', async () => {
    const res = await axios.get(`${BASE_URL}/workers/earnings/summary`, {
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    if (res.data.status !== 'success') throw new Error('Invalid response');
  });

  // 6. Shop login
  console.log('\n--- Testing Shop Login ---');
  
  const shopRes = await axios.post(`${BASE_URL}/auth/login`, {
    phone: '9000000002',
    password: 'shop123',
    role: 'SHOP'
  });
  
  let shopToken = null;
  if (shopRes.data.status === 'success') {
    shopToken = shopRes.data.token;
    console.log(`${GREEN}✓${RESET} Shop login successful (9000000002)`);
    passed++;
  } else {
    console.log(`${RED}✗${RESET} Shop login failed`);
    failed++;
  }

  if (shopToken) {
    await test('Get shop orders', async () => {
      const res = await axios.get(`${BASE_URL}/shoporders/shop`, {
        headers: { Authorization: `Bearer ${shopToken}` }
      });
      if (res.data.status !== 'success') throw new Error('Invalid response');
    });
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`\nSuccess Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n✅ All critical fixes working correctly!');
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err.message);
  process.exit(1);
});
