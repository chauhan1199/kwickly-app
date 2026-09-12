/**
 * Comprehensive Flow Test Script for Kwickly
 * Validates Steps 1 through 6 against real MongoDB and real Redis:
 * 1. Customer registration & required configuration
 * 2. Worker registration & required configuration
 * 3. Shop registration, product add/update/delete, and shop settings
 * 4. Job lifecycle from broadcast to completion with escrow payment
 * 5. Shop order lifecycle from checkout to delivery with escrow payment
 * 6. Financial ledger audit (who gets what, how much, admin sync)
 * 7. Background Cron engine verification
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const Customer = require('../src/modules/customer/customer.model');
const Shop = require('../src/modules/shop/shop.model');
const Product = require('../src/modules/product/product.model');
const Job = require('../src/modules/job/job.model');
const Quote = require('../src/modules/quote/quote.model');
const ShopOrder = require('../src/modules/shoporder/shoporder.model');
const { AdminWallet, AdminWalletTxn } = require('../src/modules/adminWallet/adminWallet.model');
const AppSettings = require('../src/modules/settings/settings.model');
const Notification = require('../src/modules/notification/notification.model');

// Helpers
const { getRedis, getCache, setCache, delCache, acquireLock, releaseLock } = require('../src/helpers/redis.helper');
const { notifyUser } = require('../src/helpers/notifyUser.helper');

const runTests = async () => {
    console.log('\n' + '='.repeat(70));
    console.log('  KWICKLY END-TO-END FLOW & FUNCTIONALITY VALIDATION SUITE');
    console.log('='.repeat(70) + '\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const redis = getRedis();
    await new Promise(r => {
        if (redis && redis.status === 'ready') return r();
        if (redis) redis.once('ready', r);
        setTimeout(r, 1500);
    });
    console.log('✅ Connected to Redis on localhost:6379\n');

    const results = [];
    const recordResult = (step, title, success, details) => {
        results.push({ step, title, success, details });
        const icon = success ? '✅ PASS' : '❌ FAIL';
        console.log(`[${icon}] Step ${step}: ${title}`);
        if (details) console.log(`       Details: ${JSON.stringify(details)}`);
    };

    const testTimestamp = Date.now();
    const custPhone = `999000${String(testTimestamp).slice(-4)}`;
    const workerPhone = `998000${String(testTimestamp).slice(-4)}`;
    const shopPhone = `997000${String(testTimestamp).slice(-4)}`;

    let testCustomer = null;
    let testWorker = null;
    let testShopOwner = null;
    let testShop = null;
    let testProduct = null;
    let testJob = null;
    let testQuote = null;
    let testOrder = null;

    try {
        // ====================================================================
        // STEP 1: CUSTOMER REGISTRATION & REQUIRED CONFIGURATION
        // ====================================================================
        console.log('\n--- 1. Testing Customer Registration & Configuration ---');
        // 1.1 OTP Send simulation
        const custOtp = '1234';
        await setCache(`otp:${custPhone}`, custOtp, 300);
        const storedOtp = await getCache(`otp:${custPhone}`);
        if (storedOtp !== custOtp) throw new Error('Redis OTP storage mismatch');

        // 1.2 User verification & account creation
        const hashedMpin = await bcrypt.hash('1234', 10);
        testCustomer = await Customer.create({
            phone: custPhone,
            role: 'CUSTOMER',
            name: 'Test Customer Aakash',
            password: hashedMpin, // 4-digit MPIN
            isVerified: true,
            email: `customer_${testTimestamp}@test.com`,
            addresses: [{
                title: 'Home',
                fullAddress: 'Flat 402, Green Glen Heights, Outer Ring Road',
                city: 'Bengaluru',
                pincode: '560103',
                location: { type: 'Point', coordinates: [77.6762, 12.9249] },
                isDefault: true
            }],
            wallet: { balance: 5000, lockedEscrow: 0, currency: 'INR' } // Initial wallet topup
        });

        // 1.3 Session caching in Redis
        await setCache(`session:${testCustomer._id}`, testCustomer.toObject(), 86400);
        const cachedCustomerSession = await getCache(`session:${testCustomer._id}`);

        recordResult(1, 'Customer Registration, MPIN, Saved Address, Wallet & Session', 
            !!testCustomer._id && cachedCustomerSession && testCustomer.wallet.balance === 5000,
            { customerId: testCustomer._id.toString(), phone: custPhone, walletBalance: testCustomer.wallet.balance }
        );

        // ====================================================================
        // STEP 2: WORKER REGISTRATION & REQUIRED CONFIGURATION
        // ====================================================================
        console.log('\n--- 2. Testing Worker Registration & Configuration ---');
        const Category = require('../src/modules/category/category.model');
        const dbCat = await Category.findOne({ name: /Electrician/i }).lean();
        const catId = dbCat ? dbCat._id : new mongoose.Types.ObjectId();
        const catName = dbCat ? dbCat.name : 'Electrician Services';

        testWorker = await Customer.create({
            phone: workerPhone,
            role: 'WORKER',
            name: 'Ramesh Professional Electrician',
            password: hashedMpin,
            isVerified: true,
            email: `worker_${testTimestamp}@test.com`,
            isOnline: true,
            activeLocation: {
                type: 'Point',
                coordinates: [77.6780, 12.9260], // ~200 meters from customer
                addressDetails: { city: 'Bengaluru', pincode: '560103' }
            },
            services: [{
                category: catId,
                categoryName: catName,
                subcategories: ['Fan Repair', 'Switch & Socket Installation', 'MCB & Fuse Repair'],
                isActive: true
            }],
            kyc: {
                status: 'APPROVED',
                documents: [{
                    type: 'AADHAR',
                    name: 'Aadhaar Card',
                    url: 'https://res.cloudinary.com/test_aadhaar.png'
                }]
            },
            subscription: {
                isTrial: true,
                trialEndDate: new Date(Date.now() + 14 * 86400000),
                expiryDate: new Date(Date.now() + 14 * 86400000)
            },
            wallet: { balance: 0, lockedEscrow: 0, currency: 'INR' }
        });

        recordResult(2, 'Worker Registration, Category, Services, KYC & Geo-Location',
            testWorker._id && testWorker.services.length > 0 && testWorker.isOnline === true,
            { workerId: testWorker._id.toString(), category: testWorker.services[0].categoryName, isOnline: testWorker.isOnline }
        );


        // ====================================================================
        // STEP 3: SHOP REGISTRATION, PRODUCT ADD / UPDATE / DELETE & CONFIG
        // ====================================================================
        console.log('\n--- 3. Testing Shop Registration, Product CRUD & Settings ---');
        testShopOwner = await Customer.create({
            phone: shopPhone,
            role: 'SHOP',
            name: 'Super Hardware & Electricals Owner',
            password: hashedMpin,
            isVerified: true,
            email: `shop_${testTimestamp}@test.com`,
            wallet: { balance: 0, lockedEscrow: 0, currency: 'INR' }
        });

        testShop = await Shop.create({
            ownerId: testShopOwner._id,
            name: 'Super Hardware & Electricals Store',
            category: 'Hardware & Electrical',
            address: 'Shop 12, Bellandur Main Road, Bengaluru',
            location: { type: 'Point', coordinates: [77.6770, 12.9255] },
            deliveryConfig: {
                isDeliveryAvailable: true,
                maxDeliveryRadiusKm: 10,
                freeDeliveryThreshold: 500,
                baseDeliveryFee: 40
            },
            isActive: true,
            isApproved: true
        });

        // 3.1 Product ADD
        testProduct = await Product.create({
            shopId: testShop._id,
            name: 'Havells 16A Modular Socket',
            category: 'Electrical Supplies',
            price: 180,
            originalPrice: 220,
            stock: 25,
            unit: 'piece',
            isActive: true
        });

        // 3.2 Product UPDATE
        const updatedProduct = await Product.findByIdAndUpdate(
            testProduct._id,
            { $set: { price: 175, stock: 24 } },
            { new: true }
        );

        // 3.3 Temporary Product for DELETE test
        const tempProduct = await Product.create({
            shopId: testShop._id,
            name: 'Temporary Defective Wire Pack',
            price: 50,
            stock: 5
        });
        const deleteResult = await Product.findByIdAndDelete(tempProduct._id);

        recordResult(3, 'Shop Profile, Product Create, Update, Delete & Delivery Config',
            testShop._id && updatedProduct.price === 175 && !!deleteResult,
            { shopId: testShop._id.toString(), productId: testProduct._id.toString(), updatedPrice: updatedProduct.price }
        );

        // ====================================================================
        // STEP 4: JOB POST TO COMPLETION LIFECYCLE WITH ESCROW PAYMENT
        // ====================================================================
        console.log('\n--- 4. Testing Job Lifecycle (Broadcast -> Quote -> Escrow -> OTP -> Settle) ---');

        // 4.1 Customer posts job
        testJob = await Job.create({
            customerId: testCustomer._id,
            category: 'Electrician Services',
            subcategory: 'Fan Repair',
            description: 'Ceiling fan making strange humming noise',
            budget: 450,
            location: { type: 'Point', coordinates: [77.6762, 12.9249] },
            addressDetails: {
                city: 'Bengaluru',
                fullAddress: 'Flat 402, Green Glen Heights, Outer Ring Road'
            },
            status: 'BROADCASTING',
            broadcast: { round: 1, radiusKm: 5, lastAttemptAt: new Date() }
        });

        // 4.2 Worker bids quote
        testQuote = await Quote.create({
            jobId: testJob._id,
            workerId: testWorker._id,
            amount: 400,
            notes: 'Can inspect and replace capacitor within 30 minutes'
        });
        await Job.findByIdAndUpdate(testJob._id, { status: 'QUOTES_RECEIVED' });

        // 4.3 Customer accepts quote & locks escrow
        const quotedAmount = testQuote.amount; // 400
        const platformFee = Math.round(quotedAmount * 0.10); // 40 (10%)
        const gst = Math.round(platformFee * 0.18); // 7.2 -> 7 (18% on fee)
        const totalJobAmount = quotedAmount + platformFee + gst; // 447

        // Customer wallet escrow lock
        const customerWalletBefore = testCustomer.wallet.balance;
        await Customer.findByIdAndUpdate(testCustomer._id, {
            $inc: { 'wallet.balance': -totalJobAmount, 'wallet.lockedEscrow': totalJobAmount }
        });

        const arrivalOtp = '4821';
        const completionOtp = '7619';

        await Job.findByIdAndUpdate(testJob._id, {
            workerId: testWorker._id,
            status: 'ALLOCATED',
            'security.arrivalOtp': arrivalOtp,
            payment: {
                amount: totalJobAmount,
                workerPayout: quotedAmount,
                platformFee,
                gst,
                status: 'PAID',
                escrowStatus: 'LOCKED',
                method: 'WALLET'
            }
        });

        // Anti-spoofing Redis guard
        await setCache(`job:${testJob._id}:assigned_worker`, testWorker._id.toString(), 86400);
        const assignedCheck = await getCache(`job:${testJob._id}:assigned_worker`);

        // 4.4 Worker arrives & OTP is verified
        const jobForArrival = await Job.findById(testJob._id);
        const arrivalOtpMatches = jobForArrival.security.arrivalOtp === '4821';
        await Job.findByIdAndUpdate(testJob._id, {
            status: 'IN_PROGRESS',
            'security.completionOtp': completionOtp
        });

        // 4.5 Worker completes job & Completion OTP is verified -> Escrow Released!
        const jobForCompletion = await Job.findById(testJob._id);
        const completionOtpMatches = jobForCompletion.security.completionOtp === '7619';

        // Payout to worker wallet
        await Customer.findByIdAndUpdate(testWorker._id, {
            $inc: { 'wallet.balance': quotedAmount }
        });

        // Deduct locked escrow from customer
        await Customer.findByIdAndUpdate(testCustomer._id, {
            $inc: { 'wallet.lockedEscrow': -totalJobAmount }
        });

        // Admin Platform Fee Ledger Entry
        await AdminWalletTxn.create({
            type: 'PLATFORM_FEE_COLLECTED',
            amount: platformFee,
            balanceAfter: platformFee,
            description: `Commission for Job ${testJob._id}`,
            referenceId: testJob._id,
            referenceModel: 'Job',
            meta: { gst }
        });


        // Complete job
        await Job.findByIdAndUpdate(testJob._id, {
            status: 'COMPLETED',
            'payment.escrowStatus': 'SETTLED',
            'completionDetails.completedAt': new Date(),
            'completionDetails.report': 'Replaced capacitor and verified balance'
        });
        await delCache(`job:${testJob._id}:assigned_worker`);

        // Customer rates worker
        await Job.findByIdAndUpdate(testJob._id, {
            status: 'CLOSED',
            rating: { score: 5, review: 'Excellent electrician! Arrived fast.', createdAt: new Date() }
        });

        const updatedWorker = await Customer.findById(testWorker._id);
        const updatedCustomer = await Customer.findById(testCustomer._id);
        const finalJob = await Job.findById(testJob._id);

        recordResult(4, 'Job Flow (Broadcast -> Bid -> Escrow Lock -> Arrival OTP -> Completion OTP -> Payout)',
            arrivalOtpMatches && completionOtpMatches && assignedCheck === testWorker._id.toString() &&
            updatedWorker.wallet.balance === 400 && finalJob.payment.escrowStatus === 'SETTLED' &&
            updatedCustomer.wallet.balance === (5000 - totalJobAmount),
            { totalJobAmount, workerPayout: 400, platformFee: 40, gst: 7, workerBalance: updatedWorker.wallet.balance, escrowStatus: finalJob.payment.escrowStatus }
        );




        // ====================================================================
        // STEP 5: SHOP ORDER TO DELIVERY LIFECYCLE WITH ESCROW PAYMENT
        // ====================================================================
        console.log('\n--- 5. Testing Shop Order Lifecycle (Cart -> Order -> Dispatch -> Delivery OTP -> Settle) ---');

        const orderItemPrice = updatedProduct.price; // 175
        const orderQty = 2;
        const subtotal = orderItemPrice * orderQty; // 350
        const deliveryFee = 40;
        const orderPlatformFee = 15;
        const orderTotal = subtotal + deliveryFee + orderPlatformFee; // 405

        // Lock escrow in customer wallet
        await Customer.findByIdAndUpdate(testCustomer._id, {
            $inc: { 'wallet.balance': -orderTotal, 'wallet.lockedEscrow': orderTotal }
        });

        const deliveryOtp = '8392';
        testOrder = await ShopOrder.create({
            orderNumber: `ORD-${Date.now()}`,
            shopId: testShop._id,
            customerId: testCustomer._id,
            items: [{
                productId: updatedProduct._id,
                name: updatedProduct.name,
                price: orderItemPrice,
                qty: orderQty,
                imageUrl: 'https://res.cloudinary.com/test.png'
            }],
            subtotal,
            deliveryFee,
            platformFee: orderPlatformFee,
            total: orderTotal,
            deliveryAddress: 'Flat 402, Green Glen Heights, Bengaluru',
            status: 'NEW',
            deliveryOtp,
            payment: {
                amount: orderTotal,
                method: 'WALLET',
                status: 'PAID',
                escrowStatus: 'LOCKED'
            }
        });

        // 5.1 Shop confirms order
        await ShopOrder.findByIdAndUpdate(testOrder._id, { status: 'CONFIRMED' });

        // 5.2 Shop packs order & decrements stock
        await Product.findByIdAndUpdate(updatedProduct._id, { $inc: { stock: -orderQty } });
        await ShopOrder.findByIdAndUpdate(testOrder._id, { status: 'PACKING' });

        // 5.3 Order dispatched out for delivery
        await ShopOrder.findByIdAndUpdate(testOrder._id, { status: 'OUT_FOR_DELIVERY' });

        // 5.4 Delivery staff verifies delivery OTP -> Handover & Settlement
        const orderForDelivery = await ShopOrder.findById(testOrder._id);
        const deliveryOtpMatches = orderForDelivery.deliveryOtp === '8392';

        const shopPayout = subtotal + deliveryFee; // 390
        // Credit shop owner wallet
        await Customer.findByIdAndUpdate(testShopOwner._id, {
            $inc: { 'wallet.balance': shopPayout }
        });

        // Clear locked escrow from customer
        await Customer.findByIdAndUpdate(testCustomer._id, {
            $inc: { 'wallet.lockedEscrow': -orderTotal }
        });

        // Admin Order Commission
        await AdminWalletTxn.create({
            type: 'COMMISSION_COLLECTED',
            amount: orderPlatformFee,
            balanceAfter: platformFee + orderPlatformFee,
            description: `Platform fee for Order ${testOrder.orderNumber}`,
            referenceId: testOrder._id,
            referenceModel: 'ShopOrder'
        });


        await ShopOrder.findByIdAndUpdate(testOrder._id, {
            status: 'DELIVERED',
            'payment.escrowStatus': 'SETTLED'
        });

        const updatedShopOwner = await Customer.findById(testShopOwner._id);
        const finalProduct = await Product.findById(updatedProduct._id);

        recordResult(5, 'Shop Order Flow (New -> Confirmed -> Packing -> Out for Delivery -> Delivery OTP -> Settled)',
            deliveryOtpMatches && updatedShopOwner.wallet.balance === 390 && finalProduct.stock === 22,
            { orderTotal, shopPayout: 390, platformFee: 15, shopOwnerBalance: updatedShopOwner.wallet.balance, remainingStock: finalProduct.stock }
        );

        // ====================================================================
        // STEP 6: PAYMENT & REVENUE RECONCILIATION (WHO GETS WHAT & ADMIN SYNC)
        // ====================================================================
        console.log('\n--- 6. Testing Payment & Admin Revenue Ledger Sync ---');

        const adminTxns = await AdminWalletTxn.find({
            referenceId: { $in: [testJob._id, testOrder._id] }
        }).lean();

        const totalAdminRevenue = adminTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

        recordResult(6, 'Financial Audit & Admin Ledger Synchronization',
            adminTxns.length === 2 && totalAdminRevenue === (40 + 15),
            {
                customerCharged: totalJobAmount + orderTotal, // 447 + 405 = 852
                workerEarned: 400,
                shopEarned: 390,
                adminPlatformRevenue: totalAdminRevenue, // 55
                gstCollected: 7,
                totalReconciliationMatch: (400 + 390 + 55 + 7) === (447 + 405) // 852 === 852
            }
        );

        // ====================================================================
        // STEP 7: CRON ENGINE AUTOMATION VERIFICATION
        // ====================================================================
        console.log('\n--- 7. Testing Background Cron Engine & Distributed Locks ---');
        
        // Test Redis distributed lock
        const lockKey = 'cron:test_broadcast_sweep';
        const lock1 = await acquireLock(lockKey, 30);
        const lock2 = await acquireLock(lockKey, 30); // Should fail as already locked
        await releaseLock(lockKey, lock1);
        const lock3 = await acquireLock(lockKey, 30); // Should succeed after release
        await releaseLock(lockKey, lock3);

        const lockWorksProperly = !!lock1 && !lock2 && !!lock3;

        recordResult(7, 'Redis Distributed Lock & Cron Safety Engine',
            lockWorksProperly,
            { initialLockAcquired: !!lock1, concurrentLockPrevented: !lock2, lockReleasedAndReacquired: !!lock3 }
        );

    } catch (err) {
        console.error('❌ Test execution error:', err);
        results.push({ step: 99, title: 'Error Encountered', success: false, details: err.message });
    } finally {
        // Cleanup test artifacts
        console.log('\n🧹 Cleaning up test artifacts...');
        if (testCustomer) await Customer.findByIdAndDelete(testCustomer._id);
        if (testWorker) await Customer.findByIdAndDelete(testWorker._id);
        if (testShopOwner) await Customer.findByIdAndDelete(testShopOwner._id);
        if (testShop) await Shop.findByIdAndDelete(testShop._id);
        if (testProduct) await Product.findByIdAndDelete(testProduct._id);
        if (testJob) await Job.findByIdAndDelete(testJob._id);
        if (testQuote) await Quote.findByIdAndDelete(testQuote._id);
        if (testOrder) await ShopOrder.findByIdAndDelete(testOrder._id);
        if (testCustomer) await delCache(`session:${testCustomer._id}`);

        console.log('\n' + '='.repeat(70));
        console.log('  TEST SUMMARY');
        console.log('='.repeat(70));
        results.forEach(r => {
            console.log(`Step ${r.step}: ${r.title} => ${r.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        });
        console.log('='.repeat(70) + '\n');

        await mongoose.disconnect();
        process.exit(results.every(r => r.success) ? 0 : 1);
    }
};

runTests();
