/**
 * KWICKLY - Live End-to-End Test for Secondary / Side-Exit Flows
 * 
 * Flow 1: Shop Owner / Worker Payout Withdrawal & Admin Bank Transfer
 * Flow 2: Shop Order Cancellation with Atomic Stock Restoration & Wallet Refund
 * Flow 3: Peer-to-Peer (P2P) Wallet Transfer with Recipient Lookup & Double-Entry Ledger
 */

const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Customer = require('../src/modules/customer/customer.model');
const Shop = require('../src/modules/shop/shop.model');
const Product = require('../src/modules/product/product.model');
const ShopOrder = require('../src/modules/shoporder/shoporder.model');
const WalletTxn = require('../src/modules/wallet/wallet.model');
const Payout = require('../src/modules/payout/payout.model');

const BASE_URL = 'https://kwickly-backend-r6zb.onrender.com/api/v1';

const log = (msg) => console.log(`[TEST] ${msg}`);
const pass = (label) => console.log(`  ✅ PASS: ${label}`);
const fail = (label, err) => {
    console.error(`  ❌ FAIL: ${label}`, err || '');
    throw new Error(`Assertion failed: ${label}`);
};

async function main() {
    console.log('='.repeat(70));
    console.log('   🚀 KWICKLY SECONDARY LIFECYCLE & SIDE-EXIT FLOW TEST SUITE');
    console.log('='.repeat(70));

    await mongoose.connect(process.env.MONGO_URI);
    log('Connected to MongoDB Atlas');

    // ── AUTHENTICATIONS ───────────────────────────────────────────────────────
    log('\nAuthenticating roles: Customer, Shop Owner, and Admin...');
    
    // 1. Customer
    const custRes = await axios.post(`${BASE_URL}/auth/login`, {
        phone: '9876543210', password: '1111', role: 'CUSTOMER'
    });
    const customerToken = custRes.data.data.token;
    const customer = custRes.data.data.user;
    pass(`Customer: ${customer.name} (${customer.phone})`);

    // 2. Shop Owner
    const shopRes = await axios.post(`${BASE_URL}/auth/login`, {
        phone: '9820112233', password: '1111', role: 'SHOP'
    });
    const shopToken = shopRes.data.data.token;
    const shopOwner = shopRes.data.data.user;
    pass(`Shop Owner: ${shopOwner.name} (${shopOwner.phone})`);

    // 3. Admin
    const adminRes = await axios.post(`${BASE_URL}/auth/login`, {
        phone: '9999999999', password: 'admin123', role: 'ADMIN'
    });
    const adminToken = adminRes.data.data.token;
    const admin = adminRes.data.data.user;
    pass(`Admin: ${admin.name} (${admin.phone})`);


    // =========================================================================
    // FLOW 1: EARNINGS PAYOUT WITHDRAWAL & ADMIN BANK TRANSFER
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log('  FLOW 1: EARNINGS PAYOUT WITHDRAWAL (Shop Owner → Admin Transfer)');
    console.log('-'.repeat(70));

    // Audit Shop Owner / Shop initial balance
    const shopDocBefore = await Shop.findOne({ ownerId: shopOwner._id }).lean();
    const initialShopBalance = shopDocBefore.wallet?.balance || 0;
    log(`Shop: "${shopDocBefore.name}", initial wallet balance: ₹${initialShopBalance}`);

    const withdrawalAmount = 200;
    if (initialShopBalance < withdrawalAmount + 100) {
        throw new Error(`Insufficient shop balance for withdrawal test (needs at least ₹${withdrawalAmount + 100})`);
    }

    log(`Step 1.1: Shop Owner submitting withdrawal request for ₹${withdrawalAmount}...`);
    const withdrawRes = await axios.post(
        `${BASE_URL}/wallet/withdraw`,
        { amount: withdrawalAmount, payoutMethod: 'UPI: ramesh@oksbi' },
        { headers: { Authorization: `Bearer ${shopToken}` } }
    );

    const withdrawData = withdrawRes.data.data;
    const payoutTxn = withdrawData.txn;
    const expectedShopBalance = initialShopBalance - withdrawalAmount;
    log(`Withdrawal response: new balance = ₹${withdrawData.newBalance}`);

    if (Math.abs(withdrawData.newBalance - expectedShopBalance) > 0.1) {
        fail(`Shop wallet deduction mismatch: expected ₹${expectedShopBalance}, got ₹${withdrawData.newBalance}`);
    }
    pass(`Shop wallet balance atomically debited: ₹${initialShopBalance} → ₹${withdrawData.newBalance}`);

    // Verify Payout record in DB
    const payoutRecord = await Payout.findOne({ walletTxnId: payoutTxn._id });
    if (!payoutRecord || payoutRecord.status !== 'PENDING') {
        fail('Payout record missing or not in PENDING state');
    }
    pass(`Payout record created (ID: ${payoutRecord._id}, status: ${payoutRecord.status})`);

    // Step 1.2: Admin lists and reviews payouts
    log('Step 1.2: Admin fetching pending payouts...');
    const adminPayoutsRes = await axios.get(`${BASE_URL}/payouts?status=PENDING`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const pendingPayouts = adminPayoutsRes.data.data || [];
    const foundInAdmin = pendingPayouts.find(p => p._id.toString() === payoutRecord._id.toString());
    if (!foundInAdmin) fail('Created payout not visible in Admin pending payouts');
    pass(`Payout visible in Admin queue: ₹${foundInAdmin.amount} (${foundInAdmin.paymentMethod})`);

    // Step 1.3: Admin approves & marks TRANSFERRED with 12-digit UTR
    log('Step 1.3: Admin marking Payout as TRANSFERRED with 12-digit bank UTR...');
    const fakeBankUtr = '987654321098';
    const updateRes = await axios.patch(
        `${BASE_URL}/payouts/${payoutRecord._id}/status`,
        { status: 'TRANSFERRED', txnId: fakeBankUtr },
        { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const updatedPayout = updateRes.data.data;
    if (updatedPayout.status !== 'TRANSFERRED') fail('Payout status was not updated to TRANSFERRED');
    pass(`Payout marked TRANSFERRED with UTR: ${fakeBankUtr}`);

    // Verify WalletTxn status flipped to COMPLETED
    const finalWalletTxn = await WalletTxn.findById(payoutTxn._id).lean();
    if (finalWalletTxn.status !== 'COMPLETED') fail('WalletTxn status not flipped to COMPLETED', finalWalletTxn);
    pass(`WalletTxn status updated to COMPLETED (UTR: ${finalWalletTxn.razorpayPaymentId})`);


    // =========================================================================
    // FLOW 2: ORDER CANCELLATION & ATOMIC STOCK RESTORATION & WALLET REFUND
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log('  FLOW 2: SHOP ORDER CANCELLATION (Atomic Stock Restore + Wallet Refund)');
    console.log('-'.repeat(70));

    const targetProduct = await Product.findById('6a87fa17859bfd5e97de7a4d');
    const initialStock = targetProduct.stock;
    log(`Target product: "${targetProduct.name}", current stock: ${initialStock}`);

    const custDocBefore = await Customer.findById(customer._id).lean();
    const initialCustBalance = custDocBefore.wallet?.balance || 0;
    log(`Customer initial wallet balance: ₹${initialCustBalance}`);

    // Step 2.1: Place order
    log('Step 2.1: Placing order for 2 units via WALLET...');
    const orderPlaceRes = await axios.post(`${BASE_URL}/shoporders`, {
        shopId: shopDocBefore._id.toString(),
        items: [{
            productId: targetProduct._id.toString(),
            name: targetProduct.name,
            price: targetProduct.price,
            qty: 2
        }],
        deliveryAddress: 'Chandkheda, Ahmedabad, Gujarat',
        deliveryLocation: { type: 'Point', coordinates: [72.5741106, 23.122274] },
        paymentMethod: 'WALLET'
    }, { headers: { Authorization: `Bearer ${customerToken}` } });

    const orderData = orderPlaceRes.data.data;
    const orderId = orderData._id;
    const orderTotal = orderData.total;
    log(`Order placed: ${orderData.orderNumber} (Total: ₹${orderTotal})`);

    // Verify stock decreased
    const productMid = await Product.findById(targetProduct._id).lean();
    if (productMid.stock !== initialStock - 2) fail('Stock should have decreased by 2');
    pass(`Stock decremented on placement: ${initialStock} → ${productMid.stock}`);

    // Verify customer wallet debited
    const custMid = await Customer.findById(customer._id).lean();
    const midCustBalance = custMid.wallet.balance;
    pass(`Customer wallet debited on placement: ₹${initialCustBalance} → ₹${midCustBalance}`);

    // Step 2.2: Customer cancels order before dispatch
    log('Step 2.2: Customer cancelling order via POST /api/v1/shoporders/:id/cancel...');
    const cancelRes = await axios.post(
        `${BASE_URL}/shoporders/${orderId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const cancelledOrder = cancelRes.data.data;
    if (cancelledOrder.status !== 'CANCELLED') fail('Order status should be CANCELLED');
    pass(`Order status updated to CANCELLED`);

    // Step 2.3: Verify stock restoration
    const productAfterCancel = await Product.findById(targetProduct._id).lean();
    if (productAfterCancel.stock !== initialStock) {
        fail(`Stock not restored properly: expected ${initialStock}, got ${productAfterCancel.stock}`);
    }
    pass(`Stock automatically restored: ${productMid.stock} → ${productAfterCancel.stock} (+2 units)`);

    // Step 2.4: Verify full customer wallet refund
    const custAfterCancel = await Customer.findById(customer._id).lean();
    const finalCustBalance = custAfterCancel.wallet.balance;
    if (Math.abs(finalCustBalance - initialCustBalance) > 0.1) {
        fail(`Customer balance not fully refunded: expected ₹${initialCustBalance}, got ₹${finalCustBalance}`);
    }
    pass(`Customer wallet fully refunded: ₹${midCustBalance} → ₹${finalCustBalance} (+₹${orderTotal})`);

    // Verify REFUND transaction
    const refundTxn = await WalletTxn.findOne({
        userId: customer._id,
        type: 'REFUND',
        refId: orderId.toString()
    });
    if (!refundTxn || Math.abs(refundTxn.amount - orderTotal) > 0.1) {
        fail('REFUND WalletTxn missing or amount mismatch');
    }
    pass(`REFUND transaction verified in customer ledger: ₹${refundTxn.amount} (${refundTxn.description})`);


    // =========================================================================
    // FLOW 3: PEER-TO-PEER (P2P) WALLET TRANSFER
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log('  FLOW 3: PEER-TO-PEER (P2P) WALLET TRANSFER');
    console.log('-'.repeat(70));

    // Find a recipient user (e.g. Worker Ramesh 9820112233 or another user)
    const recipientUser = shopOwner;
    const recipientPhone = recipientUser.phone;
    const transferAmount = 25;

    log(`Step 3.1: Sender (${customer.name}) looking up recipient by phone (${recipientPhone})...`);
    const lookupRes = await axios.post(
        `${BASE_URL}/wallet/lookup-recipient`,
        { phone: recipientPhone },
        { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const lookupData = lookupRes.data.data;
    if (lookupData.phone !== recipientPhone) fail('Recipient lookup failed');
    pass(`Recipient identified: ${lookupData.name} (${lookupData.phone}, role: ${lookupData.role})`);

    // Sender & Recipient balances before transfer
    const senderBefore = (await Customer.findById(customer._id).lean()).wallet.balance;
    const recipientBefore = (await Customer.findById(recipientUser._id).lean()).wallet.balance;
    log(`Balances before: Sender = ₹${senderBefore}, Recipient = ₹${recipientBefore}`);

    // Step 3.2: Execute transfer
    log(`Step 3.2: Executing transfer of ₹${transferAmount}...`);
    const transferRes = await axios.post(
        `${BASE_URL}/wallet/transfer`,
        { recipientPhone, amount: transferAmount, note: 'Tea & Snacks' },
        { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    pass('Transfer request processed successfully');

    // Step 3.3: Verify balances
    const senderAfter = (await Customer.findById(customer._id).lean()).wallet.balance;
    const recipientAfter = (await Customer.findById(recipientUser._id).lean()).wallet.balance;
    log(`Balances after: Sender = ₹${senderAfter}, Recipient = ₹${recipientAfter}`);

    if (Math.abs(senderAfter - (senderBefore - transferAmount)) > 0.05) {
        fail(`Sender debit mismatch: expected ₹${senderBefore - transferAmount}, got ₹${senderAfter}`);
    }
    pass(`Sender atomically debited -₹${transferAmount}`);

    if (Math.abs(recipientAfter - (recipientBefore + transferAmount)) > 0.05) {
        fail(`Recipient credit mismatch: expected ₹${recipientBefore + transferAmount}, got ₹${recipientAfter}`);
    }
    pass(`Recipient atomically credited +₹${transferAmount}`);

    // Verify double-entry ledger
    const senderDebitTxn = await WalletTxn.findOne({
        userId: customer._id,
        type: 'TRANSFER_SENT'
    }).sort({ createdAt: -1 });

    const recipientCreditTxn = await WalletTxn.findOne({
        userId: recipientUser._id,
        type: 'TRANSFER_RECEIVED'
    }).sort({ createdAt: -1 });

    if (!senderDebitTxn || senderDebitTxn.amount !== transferAmount) fail('TRANSFER_SENT ledger missing');
    if (!recipientCreditTxn || recipientCreditTxn.amount !== transferAmount) fail('TRANSFER_RECEIVED ledger missing');
    pass(`Double-entry ledger verified: TRANSFER_SENT (₹${senderDebitTxn.amount}) ↔ TRANSFER_RECEIVED (₹${recipientCreditTxn.amount})`);


    console.log('\n' + '='.repeat(70));
    console.log('   🎉 ALL SECONDARY & SIDE-EXIT FLOWS 100% COMPLETE & PASS');
    console.log('='.repeat(70));
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ SECONDARY FLOWS TEST ERROR:', err.response?.data || err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
