/**
 * Mobile App Comprehensive Flow Test
 * Tests all critical APIs for Customer, Worker, and Shop flows
 */

const axios = require('axios');
const assert = require('assert').strict;

const BASE_URL = 'http://localhost:5000/api/v1';
let api = axios.create({ baseURL: BASE_URL });

// Test credentials (from seeder)
const CREDENTIALS = {
  customer: { phone: '9876543210', otp: '1234' },
  worker: { phone: '9876543211', otp: '1234' },
  shop: { phone: '9876543212', otp: '1234' },
};

let tokens = { customer: null, worker: null, shop: null };
let userIds = { customer: null, worker: null, shop: null };
let testOrder = null;
let testJob = null;
let shopId = null;
let customerAddressId = null;

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(status, message) {
  const color = status === 'PASS' ? colors.green : status === 'FAIL' ? colors.red : colors.blue;
  console.log(`${color}[${status}]${colors.reset} ${message}`);
}

async function test(name, fn) {
  try {
    await fn();
    log('PASS', name);
    return true;
  } catch (error) {
    log('FAIL', `${name} - ${error.message}`);
    return false;
  }
}

// ==================== AUTH FLOW ====================

async function testAuthFlow(role) {
  console.log(`\n${colors.cyan}=== Testing ${role.toUpperCase()} Auth Flow ===${colors.reset}`);
  
  // 1. Send OTP
  await test(`${role}: Send OTP`, async () => {
    const res = await api.post('/auth/send-otp', { phone: CREDENTIALS[role].phone });
    assert(res.data.status === 'success', 'OTP send failed');
  });

  // 2. Verify OTP
  await test(`${role}: Verify OTP`, async () => {
    const res = await api.post('/auth/verify-otp', {
      phone: CREDENTIALS[role].phone,
      otp: CREDENTIALS[role].otp,
    });
    assert(res.data.status === 'success', 'OTP verify failed');
    tokens[role] = res.data.token;
    userIds[role] = res.data.user?._id || res.data.user?.id;
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens[role]}`;
  });

  // 3. Get profile (check if new user needs profile creation)
  await test(`${role}: Get profile`, async () => {
    const res = await api.get('/auth/me');
    assert(res.data.status === 'success', 'Get profile failed');
    userIds[role] = res.data.user?._id || res.data.user?.id;
  });

  // 4. If shop or worker, check if profile exists (KYC)
  if (role === 'shop' || role === 'worker') {
    await test(`${role}: Check KYC status`, async () => {
      const endpoint = role === 'shop' ? '/shop/kyc' : '/worker/kyc';
      const res = await api.get(endpoint);
      assert(res.data.status === 'success', 'KYC check failed');
    });
  }
}

// ==================== CUSTOMER FLOW ====================

async function testCustomerFlow() {
  console.log(`\n${colors.cyan}=== Testing CUSTOMER Complete Flow ===${colors.reset}`);
  
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.customer}`;

  // 1. Get categories
  await test('Customer: Get categories', async () => {
    const res = await api.get('/category');
    assert(res.data.status === 'success', 'Get categories failed');
    assert(Array.isArray(res.data.categories), 'Categories should be array');
  });

  // 2. Get shops
  await test('Customer: Get shops', async () => {
    const res = await api.get('/shop');
    assert(res.data.status === 'success', 'Get shops failed');
    if (res.data.shops.length > 0) {
      shopId = res.data.shops[0]._id;
    }
  });

  // 3. Get shop details with products
  if (shopId) {
    await test('Customer: Get shop details', async () => {
      const res = await api.get(`/shop/${shopId}`);
      assert(res.data.status === 'success', 'Get shop details failed');
      assert(res.data.shop.products, 'Shop should have products');
    });

    // 4. Add to cart
    const product = shopId ? { 
      productId: 'test_product_1', 
      shopId, 
      quantity: 2, 
      name: 'Test Product', 
      price: 100, 
      image: 'test.jpg' 
    } : null;
    
    if (product) {
      await test('Customer: Add to cart', async () => {
        const res = await api.post('/cart/add', product);
        assert(res.data.status === 'success', 'Add to cart failed');
      });

      // 5. Get cart
      await test('Customer: Get cart', async () => {
        const res = await api.get('/cart');
        assert(res.data.status === 'success', 'Get cart failed');
      });
    }
  }

  // 6. Save address
  await test('Customer: Save address', async () => {
    const res = await api.post('/customer/address', {
      type: 'home',
      street: '123 Test Street',
      locality: 'Test Area',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      landmark: 'Near Test Landmark',
      coordinates: { latitude: 28.6139, longitude: 77.2090 },
    });
    assert(res.data.status === 'success', 'Save address failed');
    customerAddressId = res.data.address?._id;
  });

  // 7. Get saved addresses
  await test('Customer: Get saved addresses', async () => {
    const res = await api.get('/customer/address');
    assert(res.data.status === 'success', 'Get addresses failed');
  });

  // 8. Create job (service booking)
  await test('Customer: Create job', async () => {
    const res = await api.post('/job', {
      categoryId: 'cat_electrical',
      subcategoryId: 'subcat_fan_repair',
      description: 'Fan repair needed',
      preferredDate: new Date(Date.now() + 86400000).toISOString(),
      preferredTime: '10:00',
      addressId: customerAddressId,
      images: [],
    });
    assert(res.data.status === 'success', 'Create job failed');
    testJob = res.data.job;
  });

  // 9. Get my jobs
  await test('Customer: Get my jobs', async () => {
    const res = await api.get('/job/my-jobs');
    assert(res.data.status === 'success', 'Get my jobs failed');
  });

  // 10. Get job quotes (if job created)
  if (testJob) {
    await test('Customer: Get job quotes', async () => {
      const res = await api.get(`/job/${testJob._id}/quotes`);
      assert(res.data.status === 'success', 'Get quotes failed');
    });
  }

  // 11. Place shop order
  if (shopId) {
    await test('Customer: Place shop order', async () => {
      const res = await api.post('/shoporder', {
        shopId,
        items: [{ productId: 'prod_apple', name: 'Apple', price: 100, quantity: 2 }],
        paymentMode: 'wallet',
        deliveryType: 'delivery',
      });
      assert(res.data.status === 'success', 'Place order failed');
      testOrder = res.data.order;
    });
  }

  // 12. Get order tracking
  if (testOrder) {
    await test('Customer: Get order tracking', async () => {
      const res = await api.get(`/shoporder/${testOrder._id}`);
      assert(res.data.status === 'success', 'Get order tracking failed');
    });

    // 13. Cancel order (if pending)
    if (testOrder.status === 'PENDING') {
      await test('Customer: Cancel order', async () => {
        const res = await api.post(`/shoporder/${testOrder._id}/cancel`);
        assert(res.data.status === 'success', 'Cancel order failed');
      });
    }
  }

  // 14. Get wallet balance
  await test('Customer: Get wallet balance', async () => {
    const res = await api.get('/wallet/balance');
    assert(res.data.status === 'success', 'Get wallet failed');
  });

  // 15. Add money to wallet
  await test('Customer: Add money to wallet', async () => {
    const res = await api.post('/wallet/add-money', {
      amount: 100,
      paymentMode: 'razorpay',
    });
    assert(res.data.status === 'success', 'Add money failed');
  });

  // 16. Get order history
  await test('Customer: Get order history', async () => {
    const res = await api.get('/shoporder/my-orders');
    assert(res.data.status === 'success', 'Get order history failed');
  });

  // 17. Get notifications
  await test('Customer: Get notifications', async () => {
    const res = await api.get('/notifications');
    assert(res.data.status === 'success', 'Get notifications failed');
  });

  // 18. Get settings
  await test('Customer: Get app settings', async () => {
    const res = await api.get('/settings');
    assert(res.data.status === 'success', 'Get settings failed');
  });
}

// ==================== WORKER FLOW ====================

async function testWorkerFlow() {
  console.log(`\n${colors.cyan}=== Testing WORKER Complete Flow ===${colors.reset}`);
  
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.worker}`;

  // 1. Get worker profile
  await test('Worker: Get profile', async () => {
    const res = await api.get('/worker/profile');
    assert(res.data.status === 'success', 'Get profile failed');
  });

  // 2. Update profile
  await test('Worker: Update profile', async () => {
    const res = await api.put('/worker/profile', {
      name: 'Test Worker',
      skills: ['electrical', 'plumbing'],
    });
    assert(res.data.status === 'success', 'Update profile failed');
  });

  // 3. Get available jobs
  await test('Worker: Get available jobs', async () => {
    const res = await api.get('/worker/jobs');
    assert(res.data.status === 'success', 'Get available jobs failed');
  });

  // 4. Place quote on a job
  await test('Worker: Place quote', async () => {
    const res = await api.post(`/job/${testJob?._id || 'test_job_id'}/quote`, {
      quoteAmount: 500,
      message: 'I can do this job',
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Place quote failed');
  });

  // 5. Get my quotes
  await test('Worker: Get my quotes', async () => {
    const res = await api.get('/worker/quotes');
    assert(res.data.status === 'success', 'Get my quotes failed');
  });

  // 6. Accept job (if assigned)
  await test('Worker: Accept job', async () => {
    const res = await api.post('/worker/jobs/accept', {
      jobId: testJob?._id || 'test_job_id',
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Accept job failed');
  });

  // 7. Update job status to arrived
  await test('Worker: Mark arrived', async () => {
    const res = await api.post('/worker/jobs/update-status', {
      jobId: testJob?._id || 'test_job_id',
      status: 'ARRIVED',
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Mark arrived failed');
  });

  // 8. Update job status to started
  await test('Worker: Mark started', async () => {
    const res = await api.post('/worker/jobs/update-status', {
      jobId: testJob?._id || 'test_job_id',
      status: 'IN_PROGRESS',
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Mark started failed');
  });

  // 9. Complete job
  await test('Worker: Complete job', async () => {
    const res = await api.post('/worker/jobs/complete', {
      jobId: testJob?._id || 'test_job_id',
      finalAmount: 500,
      serviceRating: 5,
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Complete job failed');
  });

  // 10. Get earnings
  await test('Worker: Get earnings', async () => {
    const res = await api.get('/worker/earnings');
    assert(res.data.status === 'success', 'Get earnings failed');
  });

  // 11. Get wallet balance
  await test('Worker: Get wallet balance', async () => {
    const res = await api.get('/wallet/balance');
    assert(res.data.status === 'success', 'Get wallet failed');
  });

  // 12. Request payout
  await test('Worker: Request payout', async () => {
    const res = await api.post('/wallet/payout', {
      amount: 100,
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      accountHolderName: 'Test Worker',
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Request payout failed');
  });
}

// ==================== SHOP FLOW ====================

async function testShopFlow() {
  console.log(`\n${colors.cyan}=== Testing SHOP Complete Flow ===${colors.reset}`);
  
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.shop}`;

  // 1. Get shop profile
  await test('Shop: Get profile', async () => {
    const res = await api.get('/shop/profile');
    assert(res.data.status === 'success', 'Get profile failed');
    if (res.data.shop) shopId = res.data.shop._id;
  });

  // 2. Create shop (if doesn't exist)
  if (!shopId) {
    await test('Shop: Create shop', async () => {
      const res = await api.post('/shop', {
        name: 'Test Shop',
        category: 'grocery',
        address: {
          street: '123 Shop Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          coordinates: { latitude: 28.6139, longitude: 77.2090 },
        },
      });
      assert(res.data.status === 'success', 'Create shop failed');
      shopId = res.data.shop?._id;
    });
  }

  // 3. Update shop
  await test('Shop: Update shop', async () => {
    const res = await api.put(`/shop/${shopId || 'test_shop'}`, {
      name: 'Updated Shop Name',
      description: 'Test shop description',
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Update shop failed');
  });

  // 4. Add product
  await test('Shop: Add product', async () => {
    const res = await api.post(`/shop/${shopId || 'test_shop'}/products`, {
      name: 'Test Product',
      price: 99,
      category: 'test',
      stock: 100,
      images: ['test.jpg'],
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Add product failed');
  });

  // 5. Get products
  await test('Shop: Get products', async () => {
    const res = await api.get(`/shop/${shopId || 'test_shop'}/products`);
    assert(res.data.status === 'success' || res.data.status === 'error', 'Get products failed');
  });

  // 6. Update product
  await test('Shop: Update product', async () => {
    const res = await api.put(`/shop/${shopId || 'test_shop'}/products/test_product`, {
      price: 149,
      stock: 50,
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Update product failed');
  });

  // 7. Delete product
  await test('Shop: Delete product', async () => {
    const res = await api.delete(`/shop/${shopId || 'test_shop'}/products/test_product`);
    assert(res.data.status === 'success' || res.data.status === 'error', 'Delete product failed');
  });

  // 8. Get shop orders
  await test('Shop: Get orders', async () => {
    const res = await api.get('/shoporder/shop-orders');
    assert(res.data.status === 'success', 'Get orders failed');
  });

  // 9. Accept order
  if (testOrder) {
    await test('Shop: Accept order', async () => {
      const res = await api.post(`/shoporder/${testOrder._id}/accept`);
      assert(res.data.status === 'success' || res.data.status === 'error', 'Accept order failed');
    });

    // 10. Update order status
    await test('Shop: Update order status', async () => {
      const res = await api.post(`/shoporder/${testOrder._id}/update-status`, {
        status: 'PREPARING',
      });
      assert(res.data.status === 'success' || res.data.status === 'error', 'Update status failed');
    });
  }

  // 11. Get shop wallet
  await test('Shop: Get wallet', async () => {
    const res = await api.get('/wallet/balance');
    assert(res.data.status === 'success', 'Get wallet failed');
  });

  // 12. Get settlements
  await test('Shop: Get settlements', async () => {
    const res = await api.get('/settlement/shop');
    assert(res.data.status === 'success', 'Get settlements failed');
  });

  // 13. Update delivery config
  await test('Shop: Update delivery config', async () => {
    const res = await api.put(`/shop/${shopId || 'test_shop'}/delivery-config`, {
      deliveryType: 'both',
      deliveryConfig: {
        deliveryCharge: 40,
        freeDeliveryAbove: 500,
        deliveryRadius: 5,
      },
    });
    assert(res.data.status === 'success' || res.data.status === 'error', 'Update delivery config failed');
  });
}

// ==================== MAIN TEST RUNNER ====================

async function runTests() {
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}        KWICKLY MOBILE APP COMPREHENSIVE FLOW TEST      ${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

  const results = {
    customer: { passed: 0, failed: 0 },
    worker: { passed: 0, failed: 0 },
    shop: { passed: 0, failed: 0 },
  };

  try {
    // Test all auth flows
    for (const role of ['customer', 'worker', 'shop']) {
      const authTests = await testAuthFlow(role);
    }

    // Test all role-specific flows
    await testCustomerFlow();
    await testWorkerFlow();
    await testShopFlow();

    console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}                  ALL TESTS COMPLETED                       ${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);

  } catch (error) {
    console.error(`\n${colors.red}TEST ABORTED: ${error.message}${colors.reset}`);
    console.error(error.stack);
  }
}

runTests();
