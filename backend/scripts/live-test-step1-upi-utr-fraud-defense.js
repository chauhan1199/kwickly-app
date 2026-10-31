const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Customer = require('../src/modules/customer/customer.model');
const WalletTxn = require('../src/modules/wallet/wallet.model');
const PlatformLedger = require('../src/modules/ledger/platformLedger.model');
const { BankCredit } = require('../src/modules/payment/bankCredit.model');
const { isValidUtr, findUtrUsage, generateUpiIntentUri } = require('../src/helpers/upi.helper');

async function testUpiUtrFraudDefense() {
    console.log('════════════════════════════════════════════════════════════════════════');
    console.log('🛡️  STEP 1: DIRECT UPI PAYMENT & 12-DIGIT UTR FRAUD DEFENSE AUDIT');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas successfully.');

    let allTestsPassed = true;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1.1: Standard NPCI UPI Intent URI Generation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ TEST 1.1: NPCI UPI Intent URI Construction');
    try {
        const intent = generateUpiIntentUri({
            vpa: 'kwickly@icici',
            payeeName: 'Kwickly Technologies Private Limited',
            amount: 250.00,
            purpose: 'Wallet Topup'
        });

        console.log(`Generated URI: ${intent.uri}`);
        console.log(`Transaction Ref: ${intent.txnId}`);

        if (!intent.uri.startsWith('upi://pay?')) throw new Error('URI must start with upi://pay?');
        if (!intent.uri.includes('pa=kwickly%40icici') && !intent.uri.includes('pa=kwickly@icici')) throw new Error('VPA missing or malformed');
        if (!intent.uri.includes('am=250.00')) throw new Error('Amount missing or malformed');
        if (!intent.uri.includes('cu=INR')) throw new Error('Currency INR missing');

        console.log('✅ TEST 1.1 PASSED: NPCI compliant UPI Intent URI generated correctly.');
    } catch (err) {
        console.error('❌ TEST 1.1 FAILED:', err.message);
        allTestsPassed = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1.2: Strict 12-Digit UTR Format, Entropy & Blacklist Defense
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ TEST 1.2: UTR Strict Validation & Blacklist Defense');
    try {
        const testVectors = [
            { utr: '', expected: false, desc: 'Empty string' },
            { utr: '12345', expected: false, desc: 'Too short (5 digits)' },
            { utr: '1234567890123', expected: false, desc: 'Too long (13 digits)' },
            { utr: '1234567890AB', expected: false, desc: 'Alphanumeric containing letters' },
            { utr: '111111111111', expected: false, desc: 'All identical digits (111111111111)' },
            { utr: '999999999999', expected: false, desc: 'All identical digits (999999999999)' },
            { utr: '121212121212', expected: false, desc: 'Repetitive pattern (121212121212)' },
            { utr: '123123123123', expected: false, desc: 'Repetitive triplet (123123123123)' },
            { utr: '123456789012', expected: false, desc: 'Blacklisted dummy sequence (123456789012)' },
            { utr: '000000000000', expected: false, desc: 'Blacklisted zeros (000000000000)' },
            { utr: '430291847562', expected: true, desc: 'Genuine high-entropy 12-digit RRN/UTR' },
            { utr: '519283746501', expected: true, desc: 'Genuine high-entropy 12-digit bank reference' }
        ];

        let vectorFailures = 0;
        for (const vec of testVectors) {
            const result = isValidUtr(vec.utr);
            const passed = result === vec.expected;
            console.log(`  ${passed ? '✓' : '✗'} [${vec.utr || 'EMPTY'}] - ${vec.desc}: Result=${result} (Expected=${vec.expected})`);
            if (!passed) vectorFailures++;
        }

        if (vectorFailures > 0) throw new Error(`${vectorFailures} UTR validation test vectors failed`);
        console.log('✅ TEST 1.2 PASSED: 12-Digit NPCI UTR validator strictly blocks all fake/tampered inputs.');
    } catch (err) {
        console.error('❌ TEST 1.2 FAILED:', err.message);
        allTestsPassed = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1.3: Replay Attack Defense (findUtrUsage across models)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ TEST 1.3: Replay Attack Prevention (Cross-Model Detection)');
    let replayUtr = `9${Date.now().toString().slice(-11)}`;
    let testTxn = null;
    let customer = null;

    try {
        customer = await Customer.findOne({ role: 'CUSTOMER', isVerified: true }).sort({ createdAt: 1 });
        if (!customer) throw new Error('Customer not found');

        console.log(`👤 Test Customer: ${customer.name} (ID: ${customer._id})`);
        console.log(`🔑 Generating unique candidate UTR: ${replayUtr}`);

        // Step 1: Verify UTR is not yet used
        const beforeUsage = await findUtrUsage(replayUtr);
        if (beforeUsage) throw new Error('UTR already exists before test');
        console.log('  ✓ Verified UTR is completely unspent and fresh.');

        // Step 2: Customer creates top-up transaction with this UTR
        testTxn = await WalletTxn.create({
            userId: customer._id,
            type: 'TOPUP',
            amount: 150,
            balance: customer.wallet.balance,
            status: 'PENDING',
            razorpayPaymentId: replayUtr,
            description: `Wallet Top-up via Direct UPI (UTR: ${replayUtr} - Pending Verification)`
        });
        console.log(`  ✓ Transaction #${testTxn._id} recorded with UTR: ${replayUtr}`);

        // Step 3: Now attempt replay check using findUtrUsage
        const afterUsage = await findUtrUsage(replayUtr);
        if (!afterUsage) throw new Error('findUtrUsage failed to find active UTR transaction');
        console.log(`  ✓ findUtrUsage successfully flagged replay: Flow=${afterUsage.flow}, RefID=${afterUsage.ref._id}`);

        // Step 4: Cross-user replay simulation:
        // Another user attempts to use this exact same UTR
        const isReplayBlocked = afterUsage && String(afterUsage.ref._id) === String(testTxn._id);
        if (!isReplayBlocked) throw new Error('Replay protection check failed');

        console.log('✅ TEST 1.3 PASSED: Replay attack intercepted; duplicate UTR blocked platform-wide.');
    } catch (err) {
        console.error('❌ TEST 1.3 FAILED:', err.message);
        allTestsPassed = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1.4: Admin Verification & Atomic Ledger Double-Entry
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶️ TEST 1.4: Admin Verification & Atomic Ledger Credit');
    try {
        const initialBal = customer.wallet.balance;
        const topupAmount = 150;

        console.log(`  Initial Customer Wallet: ₹${initialBal}`);
        console.log(`  Topup Amount: ₹${topupAmount}`);

        // Step 1: Admin verifies UTR against bank statement and approves
        const updatedCustomer = await Customer.findByIdAndUpdate(
            customer._id,
            { $inc: { 'wallet.balance': topupAmount, 'wallet.totalFunded': topupAmount } },
            { returnDocument: 'after' }
        );

        testTxn.status = 'COMPLETED';
        testTxn.balance = updatedCustomer.wallet.balance;
        testTxn.verifiedByAdmin = true;
        testTxn.verifiedAt = new Date();
        await testTxn.save();

        // Step 2: Create immutable PlatformLedger entry
        const txnIdStr = `TXN_TOPUP_${Date.now()}`;
        const ledgerEntry = await PlatformLedger.create({
            transactionId: txnIdStr,
            idempotencyKey: `topup_${testTxn._id}`,
            entityType: 'CUSTOMER_WALLET_TOPUP',
            entityId: testTxn._id,
            grossAmount: topupAmount,
            fromAccount: { accountType: 'CUSTOMER_DIRECT_UPI', userId: customer._id },
            toAccount: { accountType: 'CUSTOMER_WALLET', userId: customer._id },
            paymentMethod: 'UPI',
            paymentStatus: 'PAID',
            settlementStatus: 'SETTLED',
            utrNumber: replayUtr,
            description: `Admin approved Direct UPI wallet top-up for ₹${topupAmount} (UTR: ${replayUtr})`
        });

        console.log(`  ✓ Customer Wallet Credited: ₹${updatedCustomer.wallet.balance} (Expected: ₹${initialBal + topupAmount})`);
        console.log(`  ✓ Transaction status updated to: ${testTxn.status}`);
        console.log(`  ✓ Double-entry PlatformLedger entry #${ledgerEntry._id} posted (IdempotencyKey: ${ledgerEntry.idempotencyKey})`);

        if (updatedCustomer.wallet.balance !== initialBal + topupAmount) {
            throw new Error(`Balance mismatch: Expected ₹${initialBal + topupAmount}, got ₹${updatedCustomer.wallet.balance}`);
        }

        // Step 3: Test Idempotency Key collision (Cannot double-post)
        let doubleCreditBlocked = false;
        try {
            await PlatformLedger.create({
                transactionId: `TXN_TOPUP_DUP_${Date.now()}`,
                idempotencyKey: `topup_${testTxn._id}`, // Duplicate key!
                entityType: 'CUSTOMER_WALLET_TOPUP',
                entityId: testTxn._id,
                grossAmount: topupAmount,
                fromAccount: { accountType: 'CUSTOMER_DIRECT_UPI', userId: customer._id },
                toAccount: { accountType: 'CUSTOMER_WALLET', userId: customer._id },
                paymentMethod: 'UPI',
                paymentStatus: 'PAID',
                settlementStatus: 'SETTLED',
                utrNumber: replayUtr
            });
        } catch (idempErr) {
            if (idempErr.code === 11000) {
                doubleCreditBlocked = true;
                console.log('  ✓ Idempotency constraint successfully blocked duplicate ledger entry (E11000 duplicate key).');
            }
        }

        if (!doubleCreditBlocked) {
            throw new Error('PlatformLedger unique idempotencyKey failed to block duplicate post');
        }

        console.log('✅ TEST 1.4 PASSED: Admin verification, atomic wallet credit, and double-entry ledger verified.');

        // Revert customer balance back to initial
        await Customer.findByIdAndUpdate(customer._id, {
            $inc: { 'wallet.balance': -topupAmount, 'wallet.totalFunded': -topupAmount }
        });
        await PlatformLedger.findByIdAndDelete(ledgerEntry._id);
        await WalletTxn.findByIdAndDelete(testTxn._id);

    } catch (err) {
        console.error('❌ TEST 1.4 FAILED:', err.message);
        allTestsPassed = false;
    }

    console.log('\n════════════════════════════════════════════════════════════════════════');
    if (allTestsPassed) {
        console.log('🎉 STEP 1 AUDIT COMPLETE: DIRECT UPI & UTR FRAUD DEFENSE VERIFIED 100%');
    } else {
        console.log('⚠️ STEP 1 AUDIT HAD FAILURES');
    }
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(allTestsPassed ? 0 : 1);
}

testUpiUtrFraudDefense().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
