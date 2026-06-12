const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect('mongodb://localhost:27017/kwickly').then(async () => {
    const Customer = require('./src/modules/customer/customer.model');
    const worker = await Customer.findOneAndUpdate({ phone: '9274344111' }, { $inc: { 'wallet.balance': 365 } }, { new: true });
    
    const WalletTxn = require('./src/modules/wallet/wallet.model');
    await WalletTxn.create({
        userId: worker._id,
        type: 'TOPUP',
        amount: 365,
        balance: worker.wallet.balance,
        description: 'Plan Recharge: Plan'
    });

    console.log('Wallet successfully credited with 365. New balance:', worker.wallet.balance);
    process.exit(0);
});
