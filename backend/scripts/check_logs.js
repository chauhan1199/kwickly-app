const mongoose = require('mongoose');
require('dotenv').config({path:'../.env'});

async function checkRecent() {
    await mongoose.connect(process.env.MONGO_URI);
    
    const WalletTxn = require('../src/modules/wallet/wallet.model');
    const Notification = require('../src/modules/notification/notification.model');
    const Customer = require('../src/modules/customer/customer.model');
    const Shop = require('../src/modules/shop/shop.model');
    const Dispute = require('../src/modules/dispute/dispute.model');
    
    console.log('--- RECENT WALLET TRANSACTIONS (LAST 5) ---');
    const txns = await WalletTxn.find().sort({ createdAt: -1 }).limit(5).lean();
    for (const t of txns) {
        let userStr = t.userId.toString();
        // try to find name
        const c = await Customer.findById(t.userId);
        if (c) userStr = `Customer: ${c.name || c.phone}`;
        else {
           const s = await Shop.findOne({ ownerId: t.userId });
           if (s) userStr = `Shop Owner: ${s.name}`;
        }
        console.log(`[${new Date(t.createdAt).toLocaleTimeString()}] ${t.type} | ₹${t.amount} | Bal: ₹${t.balance} | User: ${userStr} | Desc: ${t.description}`);
    }
    
    console.log('\n--- RECENT NOTIFICATIONS (LAST 5) ---');
    const notifs = await Notification.find().sort({ createdAt: -1 }).limit(5).lean();
    notifs.forEach(n => {
        console.log(`[${new Date(n.createdAt).toLocaleTimeString()}] To User: ${n.userId} | "${n.title}" - ${n.message}`);
    });
    
    console.log('\n--- RECENT DISPUTES (LAST 3) ---');
    const disputes = await Dispute.find().sort({ createdAt: -1 }).limit(3).lean();
    disputes.forEach(d => {
        console.log(`[${d.status.toUpperCase()}] Ref: ${d._id} | Resol: ${d.resolutionNotes || 'N/A'}`);
    });

    await mongoose.disconnect();
}
checkRecent().catch(console.error);
