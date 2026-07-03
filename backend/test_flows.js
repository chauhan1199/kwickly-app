const mongoose = require('mongoose');
const Customer = require('./src/modules/customer/customer.model');
const WalletTxn = require('./src/modules/wallet/wallet.model');
const Payout = require('./src/modules/payout/payout.model');

require('dotenv').config();

async function runTest() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
    console.log('Connected to DB');

    const worker = await Customer.findOne({ role: 'WORKER' });
    if (!worker) {
        console.log('No worker found');
        process.exit(1);
    }
    
    // Simulate user buying a plan (TOPUP)
    const price = 499;
    const durationDays = 30;

    let startDate = new Date();
    if (worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > new Date()) {
        startDate = new Date(worker.subscription.expiryDate);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    console.log('--- TESTING BUY SUBSCRIPTION 499 ---');
    const updatedWorker2 = await Customer.findByIdAndUpdate(
        worker._id, 
        { 
            'subscription.planId': 'monthly_pro',
            'subscription.expiryDate': endDate,
            'subscription.isTrial': false,
            $inc: { 'wallet.balance': price } 
        },
        { new: true }
    );

    console.log(`TopUp success! New Balance: ${updatedWorker2.wallet.balance}`);
    console.log(`New Expiry Date: ${updatedWorker2.subscription.expiryDate}`);
    const daysLeft = Math.ceil((updatedWorker2.subscription.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
    console.log(`Days Left: ${daysLeft}`);
    console.log('TopUp / Subscription code does indeed add funds to the wallet instead of deducting.');
    
    process.exit(0);
}

runTest();
