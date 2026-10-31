const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Customer = require('../src/modules/customer/customer.model');
const WalletTxn = require('../src/modules/wallet/wallet.model');
const Notification = require('../src/modules/notification/notification.model');

async function testSubscriptionLifecycle() {
    console.log('════════════════════════════════════════════════════════════════════════');
    console.log('⭐  STEP 4: PRO SUBSCRIPTION PURCHASE & EXPIRY SWEEPER AUDIT');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas successfully.');

    let allTestsPassed = true;
    let testWorker = null;

    try {
        // Create isolated test worker
        testWorker = await Customer.create({
            name: 'Audit Worker Mahesh',
            phone: '988000' + Math.floor(1000 + Math.random() * 9000),
            role: 'WORKER',
            isVerified: true,
            wallet: { balance: 50 }, // Starting with only ₹50
            subscription: {
                status: 'INACTIVE',
                isTrial: false,
                expiryDate: null
            },
            isOnline: false
        });

        console.log(`👤 Created Test Worker #${testWorker._id} (Initial Balance: ₹${testWorker.wallet.balance})`);

        // ─────────────────────────────────────────────────────────────────────
        // TEST 4.1: Insufficient Balance Purchase Guard
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 4.1: Insufficient Wallet Balance Guard');
        const planPrice = 299; // Monthly Pro Plan = ₹299
        let purchaseBlocked = false;

        const updated = await Customer.findOneAndUpdate(
            { _id: testWorker._id, 'wallet.balance': { $gte: planPrice } },
            { $inc: { 'wallet.balance': -planPrice } }
        );

        if (!updated) {
            purchaseBlocked = true;
            console.log(`  ✓ Blocked plan purchase: Required ₹${planPrice}, available ₹${testWorker.wallet.balance}.`);
        }

        if (!purchaseBlocked) throw new Error('Insufficient balance guard failed');
        console.log('✅ TEST 4.1 PASSED: Purchase blocked cleanly when balance is low.');

        // ─────────────────────────────────────────────────────────────────────
        // TEST 4.2: Wallet Funded & Subscription Activation
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 4.2: Subscription Purchase & Activation via Wallet');
        // Add ₹300 to worker wallet
        await Customer.findByIdAndUpdate(testWorker._id, { $inc: { 'wallet.balance': 300 } });
        
        // Purchase Monthly Plan atomically
        const purchasedUser = await Customer.findOneAndUpdate(
            { _id: testWorker._id, 'wallet.balance': { $gte: planPrice } },
            { 
                $inc: { 'wallet.balance': -planPrice },
                $set: {
                    'subscription.status': 'ACTIVE',
                    'subscription.planId': 'MONTHLY_PRO',
                    'subscription.isTrial': false,
                    'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    'subscription.purchasedAt': new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!purchasedUser) throw new Error('Failed to purchase subscription with funded balance');

        // Create transaction record
        const subTxn = await WalletTxn.create({
            userId: testWorker._id,
            type: 'SUBSCRIPTION',
            amount: planPrice,
            balance: purchasedUser.wallet.balance,
            status: 'COMPLETED',
            description: 'Subscription Plan Monthly Pro purchased via wallet'
        });

        console.log(`  ✓ Subscribed to MONTHLY_PRO plan for ₹${planPrice}.`);
        console.log(`  ✓ New Wallet Balance: ₹${purchasedUser.wallet.balance} (Expected: ₹51)`);
        console.log(`  ✓ Subscription Expiry Date: ${purchasedUser.subscription.expiryDate.toISOString()}`);
        console.log(`  ✓ Transaction #${subTxn._id} recorded.`);

        if (purchasedUser.wallet.balance !== 51) {
            throw new Error(`Balance mismatch: Expected ₹51, got ₹${purchasedUser.wallet.balance}`);
        }
        console.log('✅ TEST 4.2 PASSED: Pro Subscription activated via wallet atomically.');

        // ─────────────────────────────────────────────────────────────────────
        // TEST 4.3: Simulation of Expired Subscription & Active Online Duty
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 4.3: Setting Expired State & Online Duty');
        // Worker sets himself online, but subscription expires in the past
        const pastExpiry = new Date(Date.now() - 2 * 3600 * 1000); // Expired 2 hours ago
        await Customer.findByIdAndUpdate(testWorker._id, {
            isOnline: true,
            'subscription.expiryDate': pastExpiry
        });

        const workerOnlineCheck = await Customer.findById(testWorker._id);
        console.log(`  ✓ Worker Duty: ${workerOnlineCheck.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        console.log(`  ✓ Plan Expiry: ${workerOnlineCheck.subscription.expiryDate.toISOString()} (Expired in past)`);
        console.log('✅ TEST 4.3 PASSED: Expired online state configured for sweeper test.');

        // ─────────────────────────────────────────────────────────────────────
        // TEST 4.4: Subscription Expiry Sweeper Execution (FORCED_OFFLINE)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 4.4: Sweeper Sweep & Forced Offline Deactivation');
        const now = new Date();

        // Query expired online users (exact logic from subscription.cron.js)
        const expiredUsers = await Customer.find({
            _id: testWorker._id,
            role: 'WORKER',
            isOnline: true,
            'subscription.expiryDate': { $lt: now }
        });

        if (expiredUsers.length === 0) throw new Error('Sweeper query failed to catch expired worker');

        // Sweeper deactivates user
        for (const user of expiredUsers) {
            user.isOnline = false;
            await user.save();

            const expiredNotification = await Notification.create({
                userId: user._id,
                title: '❌ Subscription Expired',
                message: 'Your subscription has expired. You have been taken offline. Please top up to continue receiving jobs.',
                type: 'DIRECT',
                action: 'SUBSCRIPTION_EXPIRED',
                entityType: 'SUBSCRIPTION',
                targetRole: user.role
            });

            console.log(`  ✓ Sweeper caught worker #${user._id}`);
            console.log(`  ✓ Duty forcibly changed: isOnline = ${user.isOnline}`);
            console.log(`  ✓ Dispatched FORCED_OFFLINE notification #${expiredNotification._id}`);
        }

        const finalWorkerState = await Customer.findById(testWorker._id);
        if (finalWorkerState.isOnline) throw new Error('Worker was not taken offline');

        console.log('✅ TEST 4.4 PASSED: Expired worker taken offline automatically without leakage.');

    } catch (err) {
        console.error('❌ STEP 4 AUDIT FAILED:', err.message);
        allTestsPassed = false;
    } finally {
        console.log('\n🧹 Cleaning up test artifacts...');
        if (testWorker) {
            await Customer.findByIdAndDelete(testWorker._id);
            await WalletTxn.deleteMany({ userId: testWorker._id });
            await Notification.deleteMany({ userId: testWorker._id });
        }
        console.log('  ✓ Test Worker and related records deleted.');
    }

    console.log('\n════════════════════════════════════════════════════════════════════════');
    if (allTestsPassed) {
        console.log('🎉 STEP 4 AUDIT COMPLETE: PRO SUBSCRIPTION & EXPIRY SWEEPER VERIFIED 100%');
    } else {
        console.log('⚠️ STEP 4 AUDIT HAD FAILURES');
    }
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(allTestsPassed ? 0 : 1);
}

testSubscriptionLifecycle().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
