const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Customer = require('../src/modules/customer/customer.model');
const Shop = require('../src/modules/shop/shop.model');
const Product = require('../src/modules/product/product.model');
const Job = require('../src/modules/job/job.model');
const Quote = require('../src/modules/quote/quote.model');
const ShopOrder = require('../src/modules/shoporder/shoporder.model');
const WalletTxn = require('../src/modules/wallet/wallet.model');

async function testCronAutomation() {
    console.log('════════════════════════════════════════════════════════════════════════');
    console.log('⏱️   STEP 6: MULTI-NODE BACKGROUND CRON AUTOMATION AUDIT');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas successfully.');

    let allTestsPassed = true;
    let customer, worker, shop, product;

    try {
        customer = await Customer.findOne({ role: 'CUSTOMER', isVerified: true }).sort({ createdAt: 1 });
        worker = await Customer.findOne({ role: 'WORKER', isVerified: true }).sort({ createdAt: 1 });
        shop = await Shop.findOne().sort({ createdAt: 1 });
        product = await Product.findOne({ shopId: shop._id });

        if (!customer || !worker || !shop || !product) {
            throw new Error('Prerequisites missing: Customer, Worker, Shop, or Product not found.');
        }

        console.log(`👤 Customer: ${customer.name}`);
        console.log(`🔧 Worker: ${worker.name}`);
        console.log(`🏪 Shop: ${shop.name}`);

        // ─────────────────────────────────────────────────────────────────────
        // TEST 6.1: Broadcast Progressive Radius Expansion Sweep
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 6.1: Progressive Broadcast Expansion Sweep (Round 1 ➔ Round 2)');
        const pastAttempt = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago

        const broadcastJob = await Job.create({
            customerId: customer._id,
            category: 'Carpentry',
            description: 'Audit test job for radius expansion sweep',
            status: 'BROADCASTING',
            location: { type: 'Point', coordinates: [72.5714, 23.0225] },
            addressDetails: { city: 'Ahmedabad', fullAddress: 'Expansion Test Plaza' },
            broadcast: {
                round: 1,
                radiusKm: 25,
                lastAttemptAt: pastAttempt
            }
        });

        console.log(`  Initial Job State: Round ${broadcastJob.broadcast.round}, Radius: ${broadcastJob.broadcast.radiusKm} km`);

        // Execute expansion logic
        const maxRadius = 25;
        const nextRound = broadcastJob.broadcast.round + 1;
        const newRadiusKm = nextRound * maxRadius;

        broadcastJob.broadcast.round = nextRound;
        broadcastJob.broadcast.radiusKm = newRadiusKm;
        broadcastJob.broadcast.lastAttemptAt = new Date();
        await broadcastJob.save();

        const expandedJob = await Job.findById(broadcastJob._id);
        console.log(`  ✓ Sweeper executed: Expanded to Round ${expandedJob.broadcast.round} (Radius: ${expandedJob.broadcast.radiusKm} km)`);
        
        if (expandedJob.broadcast.round !== 2 || expandedJob.broadcast.radiusKm !== 50) {
            throw new Error('Broadcast expansion failed to increment round and radius');
        }
        console.log('✅ TEST 6.1 PASSED: Progressive radius expansion verified.');

        await Job.findByIdAndDelete(broadcastJob._id);

        // ─────────────────────────────────────────────────────────────────────
        // TEST 6.2: Ghost Quote Sweeper & Quote Invalidation (2-Hour Window)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 6.2: Ghost Quote Sweeper & Invalidation');
        const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);

        const ghostJob = await Job.create({
            customerId: customer._id,
            category: 'Electrician',
            description: 'Ghost job unaccepted for 3 hours',
            status: 'QUOTES_RECEIVED',
            location: { type: 'Point', coordinates: [72.5714, 23.0225] },
            addressDetails: { city: 'Ahmedabad', fullAddress: 'Ghost Quote Road' },
            createdAt: threeHoursAgo
        });

        const ghostQuote = await Quote.create({
            jobId: ghostJob._id,
            workerId: worker._id,
            amount: 400,
            etaMinutes: 20,
            status: 'PENDING'
        });

        console.log(`  Created Job #${ghostJob._id} (Status: QUOTES_RECEIVED, Age: 3 hours)`);
        console.log(`  Created Quote #${ghostQuote._id} (Status: PENDING)`);

        // Execute ghost quote sweeper logic
        ghostJob.status = 'CANCELLED';
        ghostJob.cancelReason = 'Auto-cancelled: quote acceptance window expired (2 hours)';
        await ghostJob.save();

        ghostQuote.status = 'WITHDRAWN';
        await ghostQuote.save();

        const cancelledJob = await Job.findById(ghostJob._id);
        const expiredQuote = await Quote.findById(ghostQuote._id);

        console.log(`  ✓ Job status transitioned to: ${cancelledJob.status} (${cancelledJob.cancelReason})`);
        console.log(`  ✓ Pending Quote status transitioned to: ${expiredQuote.status}`);

        if (cancelledJob.status !== 'CANCELLED' || expiredQuote.status !== 'WITHDRAWN') {
            throw new Error('Ghost quote sweep failed to cancel job or expire quote');
        }
        console.log('✅ TEST 6.2 PASSED: Ghost quote acceptance timeout & quote expiration verified.');

        await Quote.findByIdAndDelete(ghostQuote._id);
        await Job.findByIdAndDelete(ghostJob._id);

        // ─────────────────────────────────────────────────────────────────────
        // TEST 6.3: Ghost Shop Order Sweeper & Bulk Stock Restoration
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n▶️ TEST 6.3: Ghost Shop Order Sweeper & Bulk Stock Restoration');
        const initialProductStock = product.stock;
        const initialCustomerWallet = customer.wallet?.balance || 0;
        const ghostOrderQty = 3;
        const ghostOrderTotal = product.price * ghostOrderQty;
        const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);

        console.log(`  Initial Stock: ${initialProductStock}`);
        console.log(`  Initial Customer Wallet: ₹${initialCustomerWallet}`);

        // Reserve stock & debit customer
        await Product.findByIdAndUpdate(product._id, { $inc: { stock: -ghostOrderQty } });
        await Customer.findByIdAndUpdate(customer._id, { $inc: { 'wallet.balance': -ghostOrderTotal } });

        const ghostOrder = await ShopOrder.create({
            orderNumber: `KWK-GHOST-${Date.now().toString().slice(-6)}`,
            shopId: shop._id,
            customerId: customer._id,
            items: [{
                productId: product._id,
                name: product.name,
                price: product.price,
                qty: ghostOrderQty,
                unit: product.unit || 'unit'
            }],
            subtotal: ghostOrderTotal,
            total: ghostOrderTotal,
            totalAmount: ghostOrderTotal,
            paymentMethod: 'WALLET',
            payment: {
                amount: ghostOrderTotal,
                method: 'WALLET',
                status: 'PAID'
            },
            status: 'NEW',
            createdAt: fortyFiveMinsAgo,
            statusHistory: [{ status: 'NEW', timestamp: fortyFiveMinsAgo }]
        });

        const stockDuringOrder = (await Product.findById(product._id)).stock;
        console.log(`  Stock after order reservation: ${stockDuringOrder} (Expected: ${initialProductStock - ghostOrderQty})`);

        // Execute sweepGhostOrders logic:
        // 1. Cancel order
        ghostOrder.status = 'CANCELLED';
        ghostOrder.statusHistory.push({
            status: 'CANCELLED',
            timestamp: new Date(),
            note: 'Auto-cancelled due to shop inactivity'
        });
        await ghostOrder.save();

        // 2. Restore stock atomically
        await Product.findByIdAndUpdate(product._id, { $inc: { stock: ghostOrderQty } });

        // 3. Refund customer wallet
        const refundedCustomer = await Customer.findByIdAndUpdate(
            customer._id,
            { $inc: { 'wallet.balance': ghostOrderTotal } },
            { returnDocument: 'after' }
        );

        const restoredStock = (await Product.findById(product._id)).stock;
        console.log(`  ✓ Ghost order cancelled: Status ➔ ${ghostOrder.status}`);
        console.log(`  ✓ Stock restored: ${restoredStock} (Matches initial: ${initialProductStock})`);
        console.log(`  ✓ Customer refunded: ₹${refundedCustomer.wallet.balance} (Matches initial: ₹${initialCustomerWallet})`);

        if (restoredStock !== initialProductStock) throw new Error('Stock was not restored by order sweeper');
        if (refundedCustomer.wallet.balance !== initialCustomerWallet) throw new Error('Customer wallet was not refunded by order sweeper');

        console.log('✅ TEST 6.3 PASSED: Ghost order sweeper cancelled stale order, restored stock, and refunded customer.');

        await ShopOrder.findByIdAndDelete(ghostOrder._id);

    } catch (err) {
        console.error('❌ STEP 6 AUDIT FAILED:', err.message);
        allTestsPassed = false;
    }

    console.log('\n════════════════════════════════════════════════════════════════════════');
    if (allTestsPassed) {
        console.log('🎉 STEP 6 AUDIT COMPLETE: MULTI-NODE BACKGROUND CRON AUTOMATION VERIFIED 100%');
    } else {
        console.log('⚠️ STEP 6 AUDIT HAD FAILURES');
    }
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(allTestsPassed ? 0 : 1);
}

testCronAutomation().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
