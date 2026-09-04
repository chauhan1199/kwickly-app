/**
 * Test Suite: P2P Wallet Transfer & Recipient Lookup Verification Flow
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Customer = require('./src/modules/customer/customer.model');
const WalletTxn = require('./src/modules/wallet/wallet.model');
const walletController = require('./src/modules/wallet/wallet.controller');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

/**
 * Helper to invoke catchAsync Express controller functions synchronously in tests
 */
const callController = (fn, req) => new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            resolve({ statusCode, body: payload });
        }
    };
    fn(req, res, (err) => {
        if (err) reject(err);
        else resolve({ statusCode, body: null });
    });
});

async function runTests() {
    console.log('════════════════════════════════════════════════════════════════════════');
    console.log('🧪 RUNNING P2P WALLET TRANSFER & RECIPIENT LOOKUP VERIFICATION TEST');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    if (!MONGO_URI) {
        throw new Error('MONGO_URI is undefined. Check backend/.env');
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    // Setup Test Users
    const senderPhone = '9999900001';
    const receiverPhone = '9999900002';

    await Customer.deleteMany({ phone: { $in: [senderPhone, receiverPhone] } });
    await WalletTxn.deleteMany({ description: /P2P Transfer/i });

    const sender = await Customer.create({
        name: 'Sender TestUser',
        phone: senderPhone,
        role: 'CUSTOMER',
        wallet: { balance: 500 }
    });

    const receiver = await Customer.create({
        name: 'Receiver TestUser',
        phone: receiverPhone,
        role: 'WORKER',
        wallet: { balance: 100 }
    });

    console.log(`👤 Sender Initial Balance:   ₹${sender.wallet.balance}`);
    console.log(`👤 Receiver Initial Balance: ₹${receiver.wallet.balance}\n`);

    // TEST 1: Lookup Self Rejection
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log('TEST 1: Lookup Self Rejection');
    const selfLookupRes = await callController(walletController.lookupRecipient, {
        body: { phone: senderPhone },
        user: sender
    });

    if (selfLookupRes.statusCode === 400 && selfLookupRes.body?.message?.includes('yourself')) {
        console.log('✅ PASS: Self-lookup safely blocked with 400 Bad Request.');
    } else {
        throw new Error(`Self-lookup test failed! Status: ${selfLookupRes.statusCode}, Body: ${JSON.stringify(selfLookupRes.body)}`);
    }

    // TEST 2: Valid Recipient Lookup
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log('TEST 2: Valid Recipient Lookup');
    const validLookupRes = await callController(walletController.lookupRecipient, {
        body: { phone: receiverPhone },
        user: sender
    });

    const foundRecipient = validLookupRes.body?.data;
    if (validLookupRes.statusCode === 200 && foundRecipient && foundRecipient.name === 'Receiver TestUser') {
        console.log(`✅ PASS: Found recipient "${foundRecipient.name}" (${foundRecipient.role}).`);
    } else {
        throw new Error(`Recipient lookup failed! Status: ${validLookupRes.statusCode}, Body: ${JSON.stringify(validLookupRes.body)}`);
    }

    // TEST 3: Insufficient Balance Rejection
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log('TEST 3: Insufficient Balance Rejection (Trying to send ₹1000 from ₹500)');
    const insufficientRes = await callController(walletController.transferWallet, {
        body: { recipientPhone: receiverPhone, amount: 1000 },
        user: sender
    });

    if (insufficientRes.statusCode === 402 && insufficientRes.body?.message?.includes('Insufficient')) {
        console.log('✅ PASS: Insufficient balance transfer safely rejected with 402 Payment Required.');
    } else {
        throw new Error(`Insufficient balance was not rejected properly! Status: ${insufficientRes.statusCode}, Body: ${JSON.stringify(insufficientRes.body)}`);
    }

    // TEST 4: Successful P2P Transfer of ₹150
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log('TEST 4: Successful P2P Transfer of ₹150.00');
    const transferRes = await callController(walletController.transferWallet, {
        body: { recipientPhone: receiverPhone, amount: 150, note: 'Dinner split' },
        user: sender
    });

    if (transferRes.statusCode !== 200) {
        throw new Error(`Transfer failed with status ${transferRes.statusCode}: ${JSON.stringify(transferRes.body)}`);
    }

    const freshSender = await Customer.findById(sender._id);
    const freshReceiver = await Customer.findById(receiver._id);

    console.log(`💰 Sender Balance:   ₹500.00 - ₹150.00 = ₹${freshSender.wallet.balance}`);
    console.log(`💰 Receiver Balance: ₹100.00 + ₹150.00 = ₹${freshReceiver.wallet.balance}`);

    if (freshSender.wallet.balance !== 350 || freshReceiver.wallet.balance !== 250) {
        throw new Error(`Balance calculation mismatch! Sender: ${freshSender.wallet.balance}, Receiver: ${freshReceiver.wallet.balance}`);
    }
    console.log('✅ PASS: Balances updated with mathematical precision.');

    // TEST 5: Verify Transactions in Ledger
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log('TEST 5: Verify Double-Entry Transactions');
    const senderTxn = await WalletTxn.findOne({ userId: sender._id, type: 'TRANSFER_SENT' });
    const receiverTxn = await WalletTxn.findOne({ userId: receiver._id, type: 'TRANSFER_RECEIVED' });

    if (!senderTxn || senderTxn.amount !== 150 || senderTxn.balance !== 350) {
        throw new Error('Sender TRANSFER_SENT transaction invalid!');
    }
    if (!receiverTxn || receiverTxn.amount !== 150 || receiverTxn.balance !== 250) {
        throw new Error('Receiver TRANSFER_RECEIVED transaction invalid!');
    }
    console.log(`✅ PASS: Sender Debit Txn:   ${senderTxn.description} (Balance: ₹${senderTxn.balance})`);
    console.log(`✅ PASS: Receiver Credit Txn: ${receiverTxn.description} (Balance: ₹${receiverTxn.balance})`);

    // Clean up
    await Customer.deleteMany({ phone: { $in: [senderPhone, receiverPhone] } });
    await WalletTxn.deleteMany({ description: /P2P Transfer/i });

    console.log('\n════════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 5 P2P TRANSFER TESTS PASSED WITH 100% PRECISION!');
    console.log('════════════════════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
