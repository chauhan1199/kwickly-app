#!/usr/bin/env node
/**
 * Kwickly Platform - End-to-End Flow Testing
 * Tests complete user journeys across all roles
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1/';
let tokens = {};
let testIds = {};
let testResults = [];

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function log(type, message, details = null) {
    const icon = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'info' ? 'ℹ️' : '📝';
    const color = type === 'pass' ? colors.green : type === 'fail' ? colors.red : type === 'info' ? colors.blue : colors.gray;
    console.log(`${color}${icon} ${message}${colors.reset}`);
    if (details) console.log(`   ${colors.gray}${JSON.stringify(details, null, 2)}${colors.reset}`);
    testResults.push({ type, message, details, timestamp: new Date().toISOString() });
}

function section(title) {
    console.log(`\n${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
    console.log(`${colors.yellow}${title}${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
}

function request(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const url = new URL(cleanPath, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
        
        const req = http.request(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, headers: res.headers });
                }
            });
        });
        
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testCustomerJourney() {
    section('👤 CUSTOMER COMPLETE JOURNEY');
    
    // Step 1: Registration
    log('info', 'Step 1: Customer Registration');
    const phone = `9${Math.floor(Math.random() * 900000000) + 100000000}`;
    const email = `customer.test.${Date.now()}@gmail.com`;
    
    const otpSend = await request('POST', 'auth/send-otp', { phone, role: 'CUSTOMER' });
    if (otpSend.status === 200) {
        log('pass', 'OTP sent successfully');
    } else {
        log('fail', 'OTP send failed', otpSend.data);
        return false;
    }
    
    const verifyOTP = await request('POST', 'auth/verify-otp', {
        phone, otp: '1234', role: 'CUSTOMER',
        name: 'Test Customer', email
    });
    
    if (verifyOTP.status === 200 && verifyOTP.data.data?.token) {
        tokens.customer = verifyOTP.data.data.token;
        testIds.customerId = verifyOTP.data.data.user._id;
        log('pass', 'Customer registered and logged in');
        log('info', `Customer ID: ${testIds.customerId}`);
    } else {
        log('fail', 'OTP verification failed', verifyOTP.data);
        return false;
    }
    
    // Step 2: Profile Setup
    log('info', 'Step 2: Update Profile');
    const updateProfile = await request('PATCH', 'customers/me/profile', {
        name: 'John Doe',
        email: email
    }, tokens.customer);
    
    if (updateProfile.status === 200) {
        log('pass', 'Profile updated');
    } else {
        log('fail', 'Profile update failed', updateProfile.data);
    }
    
    // Step 3: Add Address
    log('info', 'Step 3: Add Delivery Address');
    const addAddress = await request('POST', 'customers/me/addresses', {
        label: 'Home',
        street: '123 MG Road',
        city: 'Mumbai',
        area: 'Andheri West',
        pincode: '400053',
        landmark: 'Near Metro Station',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] }
    }, tokens.customer);
    
    if (addAddress.status === 200) {
        testIds.addressId = addAddress.data.data?.[0]?._id;
        log('pass', 'Address added');
        log('info', `Address ID: ${testIds.addressId}`);
    } else {
        log('fail', 'Add address failed', addAddress.data);
    }
    
    // Step 4: Browse Categories
    log('info', 'Step 4: Browse Categories');
    const categories = await request('GET', 'categories');
    if (categories.status === 200 && categories.data.data?.length > 0) {
        testIds.categoryId = categories.data.data[5]._id;
        testIds.categoryName = categories.data.data[5].name;
        log('pass', `Categories loaded (${categories.data.data.length} categories)`);
        log('info', `Selected: ${testIds.categoryName}`);
    } else {
        log('fail', 'Categories fetch failed', categories.data);
    }
    
    // Step 5: Create Job
    log('info', 'Step 5: Create Service Job');
    const createJob = await request('POST', 'jobs', {
        category: testIds.categoryId,
        categoryName: testIds.categoryName,
        description: 'Need urgent plumbing repair for kitchen sink',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        addressDetails: {
            city: 'Mumbai',
            fullAddress: '123 MG Road, Andheri West, Mumbai - 400053'
        },
        estimatedDuration: 60
    }, tokens.customer);
    
    if (createJob.status === 201) {
        testIds.jobId = createJob.data.data._id;
        testIds.jobStatus = createJob.data.data.status;
        log('pass', 'Job created successfully');
        log('info', `Job ID: ${testIds.jobId}, Status: ${testIds.jobStatus}`);
    } else {
        log('fail', 'Job creation failed', createJob.data);
        return false;
    }
    
    // Step 6: View My Jobs
    log('info', 'Step 6: View My Jobs');
    const myJobs = await request('GET', 'customers/me/jobs', null, tokens.customer);
    if (myJobs.status === 200) {
        log('pass', `Jobs fetched (${myJobs.data.data?.length || 0} jobs)`);
    } else {
        log('fail', 'Fetch jobs failed', myJobs.data);
    }
    
    // Step 7: View Job Details
    log('info', 'Step 7: View Job Details');
    const jobDetails = await request('GET', `jobs/${testIds.jobId}`, null, tokens.customer);
    if (jobDetails.status === 200) {
        log('pass', 'Job details fetched');
    } else {
        log('fail', 'Job details failed', jobDetails.data);
    }
    
    // Step 8: Check Wallet
    log('info', 'Step 8: Check Wallet Balance');
    const wallet = await request('GET', 'wallet/balance', null, tokens.customer);
    if (wallet.status === 200) {
        log('pass', `Wallet balance: ₹${wallet.data.data?.balance || 0}`);
    } else {
        log('fail', 'Wallet check failed', wallet.data);
    }
    
    log('pass', '✅ CUSTOMER JOURNEY COMPLETED', {
        customerId: testIds.customerId,
        jobId: testIds.jobId,
        addressId: testIds.addressId
    });
    
    return true;
}

async function testWorkerJourney() {
    section('🔧 WORKER COMPLETE JOURNEY');
    
    // Step 1: Registration
    log('info', 'Step 1: Worker Registration');
    const phone = `9${Math.floor(Math.random() * 900000000) + 100000000}`;
    const email = `worker.test.${Date.now()}@gmail.com`;
    
    const otpSend = await request('POST', 'auth/send-otp', { phone, role: 'WORKER' });
    if (otpSend.status === 200) {
        log('pass', 'OTP sent successfully');
    }
    
    const verifyOTP = await request('POST', 'auth/verify-otp', {
        phone, otp: '1234', role: 'WORKER',
        name: 'Rajesh Kumar', email
    });
    
    if (verifyOTP.status === 200 && verifyOTP.data.data?.token) {
        tokens.worker = verifyOTP.data.data.token;
        testIds.workerId = verifyOTP.data.data.user._id;
        log('pass', 'Worker registered and logged in');
    } else {
        log('fail', 'Worker registration failed', verifyOTP.data);
        return false;
    }
    
    // Step 2: Update Profile
    log('info', 'Step 2: Complete Profile');
    const updateProfile = await request('PATCH', 'workers/me/profile', {
        name: 'Rajesh Kumar',
        experience: 5,
        skills: ['Plumbing', 'Pipe Repair', 'Leak Fixing']
    }, tokens.worker);
    
    if (updateProfile.status === 200) {
        log('pass', 'Profile updated');
    } else {
        log('fail', 'Profile update failed', updateProfile.data);
    }
    
    // Step 3: Add Services
    log('info', 'Step 3: Add Services');
    const categories = await request('GET', 'categories');
    let plumbingCat = categories.data.data?.find(c => c.name.toLowerCase().includes('plumb'));
    
    if (plumbingCat) {
        const addServices = await request('PATCH', 'workers/me/services', {
            services: [{
                category: plumbingCat._id.toString(),
                categoryName: plumbingCat.name
            }]
        }, tokens.worker);
        
        if (addServices.status === 200) {
            testIds.workerServiceId = addServices.data.data?.services?.[0]?._id;
            log('pass', 'Services added');
            log('info', `Category: ${plumbingCat.name}`);
        } else {
            log('fail', 'Add services failed', addServices.data);
        }
    }
    
    // Step 4: View Available Jobs
    log('info', 'Step 4: Browse Available Jobs');
    const availableJobs = await request('GET', 
        'workers/jobs/available?lat=19.0760&lng=72.8777&radius=10', 
        null, tokens.worker);
    
    if (availableJobs.status === 200) {
        log('pass', `Available jobs: ${availableJobs.data.data?.length || 0}`);
        if (availableJobs.data.data?.length > 0) {
            testIds.availableJobId = availableJobs.data.data[0]._id;
        }
    } else {
        log('fail', 'Fetch available jobs failed', availableJobs.data);
    }
    
    // Step 5: Accept Job
    if (testIds.jobId) {
        log('info', 'Step 5: Accept Job');
        const acceptJob = await request('POST', `workers/jobs/${testIds.jobId}/accept`, null, tokens.worker);
        
        if (acceptJob.status === 200) {
            log('pass', 'Job accepted successfully');
            testIds.jobStatus = 'ACCEPTED';
        } else {
            log('fail', 'Job acceptance failed', acceptJob.data);
        }
    }
    
    // Step 6: View Earnings
    log('info', 'Step 6: View Earnings Summary');
    const earnings = await request('GET', 'workers/earnings/summary', null, tokens.worker);
    if (earnings.status === 200) {
        log('pass', 'Earnings fetched');
        log('info', `Today: ₹${earnings.data.data?.today || 0}, Week: ₹${earnings.data.data?.thisWeek || 0}`);
    } else {
        log('fail', 'Earnings fetch failed', earnings.data);
    }
    
    // Step 7: View Wallet
    log('info', 'Step 7: Check Wallet');
    const workerWallet = await request('GET', 'wallet/balance', null, tokens.worker);
    if (workerWallet.status === 200) {
        log('pass', `Wallet balance: ₹${workerWallet.data.data?.balance || 0}`);
    }
    
    // Step 8: Add Address
    log('info', 'Step 8: Add Service Address');
    const addAddress = await request('POST', 'workers/me/addresses', {
        label: 'Work Area',
        city: 'Mumbai',
        area: 'Andheri',
        pincode: '400053',
        isPrimary: true,
        location: { type: 'Point', coordinates: [72.8777, 19.0760] }
    }, tokens.worker);
    
    if (addAddress.status === 200) {
        log('pass', 'Address added');
    }
    
    log('pass', '✅ WORKER JOURNEY COMPLETED', {
        workerId: testIds.workerId,
        serviceId: testIds.workerServiceId
    });
    
    return true;
}

async function testShopJourney() {
    section('🏪 SHOP COMPLETE JOURNEY');
    
    // Step 1: Shop Owner Registration
    log('info', 'Step 1: Shop Owner Registration');
    const phone = `9${Math.floor(Math.random() * 900000000) + 100000000}`;
    const email = `shop.test.${Date.now()}@gmail.com`;
    
    const otpSend = await request('POST', 'auth/send-otp', { phone, role: 'SHOP' });
    if (otpSend.status === 200) {
        log('pass', 'OTP sent successfully');
    }
    
    const verifyOTP = await request('POST', 'auth/verify-otp', {
        phone, otp: '1234', role: 'SHOP',
        name: 'Priya Sharma', email
    });
    
    if (verifyOTP.status === 200 && verifyOTP.data.data?.token) {
        tokens.shopOwner = verifyOTP.data.data.token;
        testIds.shopOwnerId = verifyOTP.data.data.user._id;
        log('pass', 'Shop owner registered');
    } else {
        log('fail', 'Shop registration failed', verifyOTP.data);
        return false;
    }
    
    // Step 2: Create Shop
    log('info', 'Step 2: Create Shop');
    const createShop = await request('POST', 'shops', {
        name: 'Fresh Mart Grocery',
        category: 'Grocery Store',
        description: 'Fresh vegetables, fruits, and daily essentials',
        address: 'Shop No 5, MG Road, Andheri',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        businessHours: { monFri: '9 AM - 10 PM', sat: '9 AM - 10 PM', sun: '10 AM - 8 PM' }
    }, tokens.shopOwner);
    
    if (createShop.status === 201) {
        testIds.shopId = createShop.data.data._id;
        log('pass', 'Shop created');
        log('info', `Shop ID: ${testIds.shopId}`);
    } else {
        log('fail', 'Shop creation failed', createShop.data);
        return false;
    }
    
    // Step 3: Update Shop Settings
    log('info', 'Step 3: Configure Delivery Settings');
    const updateSettings = await request('PATCH', 'shops/my', {
        deliveryConfig: {
            deliveryRadiusKm: 5,
            deliveryCharge: 40,
            freeDeliveryAbove: 500,
            minOrderAmount: 100
        }
    }, tokens.shopOwner);
    
    if (updateSettings.status === 200) {
        log('pass', 'Delivery settings configured');
    } else {
        log('fail', 'Settings update failed', updateSettings.data);
    }
    
    // Step 4: Add Products
    log('info', 'Step 4: Add Products');
    const products = [
        { name: 'Fresh Tomatoes', price: 40, unit: 'kg', stock: 50, category: 'Vegetables' },
        { name: 'Onions', price: 30, unit: 'kg', stock: 100, category: 'Vegetables' },
        { name: 'Potatoes', price: 25, unit: 'kg', stock: 80, category: 'Vegetables' }
    ];
    
    for (const product of products) {
        const addProduct = await request('POST', 'shops/products', {
            ...product,
            shopId: testIds.shopId
        }, tokens.shopOwner);
        
        if (addProduct.status === 201) {
            testIds.productIds = testIds.productIds || [];
            testIds.productIds.push(addProduct.data.data._id);
        }
    }
    
    log('pass', `Products added: ${testIds.productIds?.length || 0}`);
    
    // Step 5: View Products
    log('info', 'Step 5: View Products');
    const myProducts = await request('GET', 'shops/products', null, tokens.shopOwner);
    if (myProducts.status === 200) {
        log('pass', `Products listed: ${myProducts.data.data?.length || 0}`);
    }
    
    // Step 6: View Orders
    log('info', 'Step 6: View Orders');
    const shopOrders = await request('GET', 'shops/orders', null, tokens.shopOwner);
    if (shopOrders.status === 200) {
        log('pass', 'Orders fetched');
    }
    
    // Step 7: View Settlements
    log('info', 'Step 7: View Settlements');
    const settlements = await request('GET', 'shops/settlements', null, tokens.shopOwner);
    if (settlements.status === 200) {
        log('pass', 'Settlements fetched');
    }
    
    // Step 8: Check Wallet
    log('info', 'Step 8: Check Shop Wallet');
    const shopWallet = await request('GET', 'wallet/balance', null, tokens.shopOwner);
    if (shopWallet.status === 200) {
        log('pass', `Wallet balance: ₹${shopWallet.data.data?.balance || 0}`);
    }
    
    log('pass', '✅ SHOP JOURNEY COMPLETED', {
        shopOwnerId: testIds.shopOwnerId,
        shopId: testIds.shopId,
        productsCount: testIds.productIds?.length || 0
    });
    
    return true;
}

async function testAdminOperations() {
    section('👨‍💼 ADMIN OPERATIONS');
    
    // Login as Admin
    log('info', 'Step 1: Admin Login');
    const adminLogin = await request('POST', 'auth/login', {
        email: 'admin@kwickly.com',
        password: 'admin123',
        role: 'ADMIN'
    });
    
    if (adminLogin.status === 200 && adminLogin.data.data?.token) {
        tokens.admin = adminLogin.data.data.token;
        log('pass', 'Admin logged in');
    } else {
        log('fail', 'Admin login failed', adminLogin.data);
        return false;
    }
    
    // Step 2: Dashboard Stats
    log('info', 'Step 2: View Dashboard');
    const dashboard = await request('GET', 'admin/stats?range=week', null, tokens.admin);
    if (dashboard.status === 200) {
        const data = dashboard.data.data;
        log('pass', 'Dashboard loaded');
        log('info', `Customers: ${data.totalCustomers}, Workers: ${data.totalWorkers}, Shops: ${data.totalShops}`);
        log('info', `Active Jobs: ${data.activeJobs}, Revenue: ₹${data.totalRevenue}`);
    }
    
    // Step 3: User Management
    log('info', 'Step 3: User Management');
    const users = await request('GET', 'admin/users?page=1', null, tokens.admin);
    if (users.status === 200) {
        log('pass', `Users listed: ${users.data.data?.length || 0}`);
    }
    
    // Step 4: Worker Management
    log('info', 'Step 4: Worker Management');
    const workers = await request('GET', 'admin/workers?page=1', null, tokens.admin);
    if (workers.status === 200) {
        log('pass', `Workers listed: ${workers.data.data?.length || 0}`);
    }
    
    // Step 5: Shop Management
    log('info', 'Step 5: Shop Management');
    const shops = await request('GET', 'admin/shops?page=1', null, tokens.admin);
    if (shops.status === 200) {
        log('pass', `Shops listed: ${shops.data.data?.length || 0}`);
    }
    
    // Step 6: KYC Management
    log('info', 'Step 6: KYC Management');
    const kyc = await request('GET', 'admin/kyc?type=SHOP&page=1', null, tokens.admin);
    if (kyc.status === 200) {
        log('pass', 'KYC requests fetched');
    }
    
    // Step 7: Jobs Management
    log('info', 'Step 7: Jobs Management');
    const jobs = await request('GET', 'admin/jobs?page=1', null, tokens.admin);
    if (jobs.status === 200) {
        log('pass', `Jobs listed: ${jobs.data.data?.length || 0}`);
    }
    
    // Step 8: Orders Management
    log('info', 'Step 8: Orders Management');
    const orders = await request('GET', 'admin/orders?page=1', null, tokens.admin);
    if (orders.status === 200) {
        log('pass', `Orders listed: ${orders.data.data?.length || 0}`);
    }
    
    // Step 9: Disputes Management
    log('info', 'Step 9: Disputes Management');
    const disputes = await request('GET', 'admin/disputes', null, tokens.admin);
    if (disputes.status === 200) {
        log('pass', `Disputes listed: ${disputes.data.data?.length || 0}`);
    }
    
    // Step 10: Settlements Management
    log('info', 'Step 10: Settlements Management');
    const adminSettlements = await request('GET', 'admin/settlements', null, tokens.admin);
    if (adminSettlements.status === 200) {
        log('pass', `Settlements listed: ${adminSettlements.data.data?.length || 0}`);
    }
    
    // Step 11: Wallet Management
    log('info', 'Step 11: Wallet Management');
    const wallets = await request('GET', 'admin/wallets?page=1', null, tokens.admin);
    if (wallets.status === 200) {
        log('pass', `Wallets listed: ${wallets.data.data?.length || 0}`);
    }
    
    // Step 12: Admin Wallet
    log('info', 'Step 12: Admin Wallet');
    const adminWallet = await request('GET', 'admin/admin-wallet', null, tokens.admin);
    if (adminWallet.status === 200) {
        log('pass', `Admin wallet balance: ₹${adminWallet.data.data?.balance || 0}`);
    }
    
    // Step 13: Ledger
    log('info', 'Step 13: Ledger Management');
    const ledger = await request('GET', 'admin/ledger?entityType=ADMIN', null, tokens.admin);
    if (ledger.status === 200) {
        log('pass', 'Ledger fetched');
    }
    
    // Step 14: Promotions
    log('info', 'Step 14: Promotions Management');
    const promotions = await request('GET', 'admin/promotions', null, tokens.admin);
    if (promotions.status === 200) {
        log('pass', `Promotions listed: ${promotions.data.data?.length || 0}`);
    }
    
    // Step 15: Subscriptions
    log('info', 'Step 15: Subscriptions');
    const subscriptions = await request('GET', 'admin/subscriptions/plans', null, tokens.admin);
    if (subscriptions.status === 200) {
        log('pass', `Subscription plans: ${subscriptions.data.data?.length || 0}`);
    }
    
    // Step 16: Categories
    log('info', 'Step 16: Categories Management');
    const categories = await request('GET', 'admin/categories', null, tokens.admin);
    if (categories.status === 200) {
        log('pass', `Categories: ${categories.data.data?.length || 0}`);
    }
    
    // Step 17: Reports
    log('info', 'Step 17: Reports');
    const reports = await request('GET', 'admin/reports/transactions?type=WALLET_CREDIT', null, tokens.admin);
    if (reports.status === 200) {
        log('pass', 'Reports fetched');
    }
    
    // Step 18: Notifications
    log('info', 'Step 18: Notifications');
    const notifications = await request('GET', 'admin/notifications', null, tokens.admin);
    if (notifications.status === 200) {
        log('pass', 'Notifications fetched');
    }
    
    // Step 19: Settings
    log('info', 'Step 19: Settings');
    const settings = await request('GET', 'admin/settings', null, tokens.admin);
    if (settings.status === 200) {
        log('pass', 'Settings fetched');
    }
    
    log('pass', '✅ ADMIN OPERATIONS COMPLETED', {
        adminId: tokens.admin ? 'logged_in' : 'not_logged_in'
    });
    
    return true;
}

async function testOrderFlow() {
    section('🛒 PRODUCT ORDER FLOW');
    
    if (!testIds.shopId || !testIds.customerId) {
        log('info', 'Skipping order flow test - no shop or customer created');
        return;
    }
    
    // Step 1: Customer places order
    log('info', 'Step 1: Customer Places Order');
    const placeOrder = await request('POST', 'shoporders', {
        shopId: testIds.shopId,
        items: [{
            productId: testIds.productIds?.[0],
            name: 'Fresh Tomatoes',
            price: 40,
            qty: 2
        }],
        deliveryAddress: '123 MG Road, Andheri West',
        paymentMethod: 'WALLET',
        deliveryLocation: { type: 'Point', coordinates: [72.8777, 19.0760] }
    }, tokens.customer);
    
    if (placeOrder.status === 201) {
        testIds.orderId = placeOrder.data.data._id;
        testIds.orderTotal = placeOrder.data.data.total;
        log('pass', 'Order placed');
        log('info', `Order ID: ${testIds.orderId}, Total: ₹${testIds.orderTotal}`);
    } else {
        log('fail', 'Order placement failed', placeOrder.data);
        return;
    }
    
    // Step 2: Shop confirms order
    log('info', 'Step 2: Shop Confirms Order');
    const confirmOrder = await request('PATCH', `shoporders/${testIds.orderId}/status`, {
        status: 'CONFIRMED'
    }, tokens.shopOwner);
    
    if (confirmOrder.status === 200) {
        log('pass', 'Order confirmed');
    } else {
        log('fail', 'Order confirmation failed', confirmOrder.data);
    }
    
    // Step 3: View Order Details
    log('info', 'Step 3: View Order Details');
    const orderDetails = await request('GET', `shoporders/${testIds.orderId}`, null, tokens.shopOwner);
    if (orderDetails.status === 200) {
        log('pass', 'Order details fetched');
    }
    
    // Step 4: My Orders (Customer)
    log('info', 'Step 4: Customer My Orders');
    const myOrders = await request('GET', 'shoporders/my', null, tokens.customer);
    if (myOrders.status === 200) {
        log('pass', `Customer orders: ${myOrders.data.data?.length || 0}`);
    }
    
    log('pass', '✅ ORDER FLOW COMPLETED', {
        orderId: testIds.orderId,
        total: testIds.orderTotal
    });
    
    return true;
}

async function testChatFlow() {
    section('💬 CHAT FUNCTIONALITY');
    
    if (!testIds.jobId) {
        log('info', 'Skipping chat test - no job created');
        return;
    }
    
    // Step 1: Send Message (Customer)
    log('info', 'Step 1: Customer Sends Message');
    const sendMessage = await request('POST', 'chat/messages', {
        jobId: testIds.jobId,
        content: 'When can you start the work?',
        senderType: 'CUSTOMER'
    }, tokens.customer);
    
    if (sendMessage.status === 200) {
        testIds.messageId = sendMessage.data.data._id;
        log('pass', 'Message sent');
    } else {
        log('fail', 'Send message failed', sendMessage.data);
    }
    
    // Step 2: Get Chat List
    log('info', 'Step 2: Get Chat List');
    const chatList = await request('GET', 'chat/list', null, tokens.customer);
    if (chatList.status === 200) {
        log('pass', `Chat list: ${chatList.data.data?.length || 0} conversations`);
    }
    
    // Step 3: Get Chat Messages
    log('info', 'Step 3: Get Chat Messages');
    const chatMessages = await request('GET', `chat/messages/${testIds.jobId}`, null, tokens.customer);
    if (chatMessages.status === 200) {
        log('pass', `Messages: ${chatMessages.data.data?.length || 0}`);
    }
    
    log('pass', '✅ CHAT FUNCTIONALITY COMPLETED');
    return true;
}

async function testWalletFlows() {
    section('💰 WALLET OPERATIONS');
    
    // Customer Wallet
    log('info', 'Customer Wallet');
    const customerWallet = await request('GET', 'wallet/balance', null, tokens.customer);
    if (customerWallet.status === 200) {
        log('info', `Balance: ₹${customerWallet.data.data?.balance || 0}`);
    }
    
    const customerTxn = await request('GET', 'wallet/transactions?limit=10', null, tokens.customer);
    if (customerTxn.status === 200) {
        log('info', `Transactions: ${customerTxn.data.data?.length || 0}`);
    }
    
    // Worker Wallet
    log('info', 'Worker Wallet');
    const workerWallet = await request('GET', 'wallet/balance', null, tokens.worker);
    if (workerWallet.status === 200) {
        log('info', `Balance: ₹${workerWallet.data.data?.balance || 0}`);
    }
    
    // Shop Owner Wallet
    log('info', 'Shop Owner Wallet');
    const shopWallet = await request('GET', 'wallet/balance', null, tokens.shopOwner);
    if (shopWallet.status === 200) {
        log('info', `Balance: ₹${shopWallet.data.data?.balance || 0}`);
    }
    
    // Admin Wallet
    log('info', 'Admin Wallet');
    const adminWallet = await request('GET', 'admin/admin-wallet', null, tokens.admin);
    if (adminWallet.status === 200) {
        log('info', `Balance: ₹${adminWallet.data.data?.balance || 0}`);
    }
    
    const adminTxn = await request('GET', 'admin/admin-wallet/transactions?limit=10', null, tokens.admin);
    if (adminTxn.status === 200) {
        log('info', `Transactions: ${adminTxn.data.data?.length || 0}`);
    }
    
    log('pass', '✅ WALLET OPERATIONS COMPLETED');
    return true;
}

async function generateReport() {
    section('📊 TEST SUMMARY');
    
    const summary = {
        passed: testResults.filter(r => r.type === 'pass').length,
        failed: testResults.filter(r => r.type === 'fail').length,
        info: testResults.filter(r => r.type === 'info').length
    };
    
    log('pass', `Tests Passed: ${summary.passed}`);
    log('fail', `Tests Failed: ${summary.failed}`);
    log('info', `Info Messages: ${summary.info}`);
    
    const successRate = ((summary.passed / (summary.passed + summary.failed)) * 100).toFixed(2);
    console.log(`\n${colors.cyan}Success Rate: ${successRate}%${colors.reset}\n`);
    
    if (summary.failed === 0) {
        console.log(`${colors.green}🎉 ALL TESTS PASSED! Platform is working correctly.${colors.reset}\n`);
    } else {
        console.log(`${colors.red}⚠️  Some tests failed. Review the logs above.${colors.reset}\n`);
    }
    
    console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
    console.log(`${colors.yellow}Test IDs Generated:${colors.reset}`);
    console.log(`${colors.gray}Customer ID: ${testIds.customerId || 'N/A'}${colors.reset}`);
    console.log(`${colors.gray}Worker ID: ${testIds.workerId || 'N/A'}${colors.reset}`);
    console.log(`${colors.gray}Shop Owner ID: ${testIds.shopOwnerId || 'N/A'}${colors.reset}`);
    console.log(`${colors.gray}Shop ID: ${testIds.shopId || 'N/A'}${colors.reset}`);
    console.log(`${colors.gray}Job ID: ${testIds.jobId || 'N/A'}${colors.reset}`);
    console.log(`${colors.gray}Order ID: ${testIds.orderId || 'N/A'}${colors.reset}`);
    console.log(`${colors.gray}Product IDs: ${testIds.productIds?.length || 0} products${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
}

async function runAllTests() {
    console.log(`\n${colors.cyan}`);
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║         KWICKLY PLATFORM - END-TO-END FLOW TESTING              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}\n`);
    
    const startTime = Date.now();
    
    await testCustomerJourney();
    await testWorkerJourney();
    await testShopJourney();
    await testAdminOperations();
    await testOrderFlow();
    await testChatFlow();
    await testWalletFlows();
    
    await generateReport();
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`${colors.cyan}Total Test Duration: ${totalTime}s${colors.reset}\n`);
    
    process.exit(testResults.filter(r => r.type === 'fail').length > 0 ? 1 : 0);
}

runAllTests().catch(e => {
    console.error(`${colors.red}Test Suite Error:${colors.reset}`, e);
    process.exit(1);
});
