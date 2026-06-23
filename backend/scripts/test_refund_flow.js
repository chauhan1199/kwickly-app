const mongoose = require('mongoose');
require('dotenv').config({path:'../.env'});

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const WalletTxn = require('../src/modules/wallet/wallet.model');
    const Notification = require('../src/modules/notification/notification.model');
    
    const txns = await WalletTxn.find({ amount: 350 }).sort({ createdAt: -1 }).limit(2).lean();
    console.log('\n--- WALLET TXNS ---');
    txns.forEach(t => console.log(`[${t.type}] Amount: ₹${t.amount} | Bal: ₹${t.balance} | Desc: ${t.description}`));
    
    const notifs = await Notification.find({ message: /dispute/i }).sort({ createdAt: -1 }).limit(2).lean();
    console.log('\n--- NOTIFICATIONS ---');
    notifs.forEach(n => console.log(n.message));
    
    await mongoose.disconnect();
}
check().catch(console.error);
