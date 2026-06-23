const mongoose = require('mongoose');
require('dotenv').config({path:'../.env'});

async function testShopSubscription() {
    await mongoose.connect(process.env.MONGO_URI);
    
    const Shop = require('../src/modules/shop/shop.model');
    const Customer = require('../src/modules/customer/customer.model');
    const WalletTxn = require('../src/modules/wallet/wallet.model');
    const ctrl = require('../src/modules/subscription/subscription.controller');

    // Find a shop
    const shop = await Shop.findOne().populate('ownerId');
    if (!shop) {
        console.log('No shop found.');
        return;
    }

    const userId = shop.ownerId._id || shop.ownerId;
    console.log(`--- TEST: SHOP SUBSCRIPTION FLOW ---`);
    console.log(`Shop Name: ${shop.name}`);
    console.log(`Initial Shop Expiry Date: ${shop.subscription?.expiryDate || 'None'}`);
    console.log(`Initial Shop Balance: ₹${shop.wallet?.balance || 0}`);

    const reqBody = { planId: 'shop_monthly', targetRole: 'SHOP' };
    const req = { body: reqBody, user: { _id: userId } };
    
    let result;
    await new Promise((resolve) => {
        const res = { 
            status: function() { return this; }, 
            json: function(d) { result = d; resolve(d); return this; },
            send: function(d) { result = d; resolve(d); return this; }
        };
        ctrl.subscribe(req, res);
    });

    if (result && result.status === 'success') {
        console.log(`\n✅ Controller Execution Finished!`);
    } else {
        console.log(`\n❌ Controller Error:`, result);
    }

    const afterShop = await Shop.findById(shop._id);
    const txn = await WalletTxn.findOne({ userId, type: 'TOPUP' }).sort('-createdAt');
    const Notification = require('../src/modules/notification/notification.model');
    const directNotif = await Notification.findOne({ userId, type: 'DIRECT' }).sort('-createdAt');
    const sysNotif = await Notification.findOne({ type: 'SYSTEM', title: /New Subscription Purchase/ }).sort('-createdAt');

    console.log(`\nFinal Shop Expiry Date: ${afterShop.subscription?.expiryDate}`);
    console.log(`Final Shop Balance: ₹${afterShop.wallet.balance}`);
    console.log(`Wallet Transaction Created: ${txn ? 'YES' : 'NO'} (Amount: ₹${txn?.amount})`);
    console.log(`User Notification Created: ${directNotif ? 'YES' : 'NO'} (${directNotif?.message})`);
    console.log(`Admin Notification Created: ${sysNotif ? 'YES' : 'NO'} (${sysNotif?.message})`);
    
    await mongoose.disconnect();
}
testShopSubscription().catch(console.error);
