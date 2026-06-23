const mongoose = require('mongoose');
require('dotenv').config({path:'../.env'});

async function testPendingSettlement() {
    await mongoose.connect(process.env.MONGO_URI);
    
    const Dispute = require('../src/modules/dispute/dispute.model');
    const Settlement = require('../src/modules/settlement/settlement.model');
    const Customer = require('../src/modules/customer/customer.model');
    const Shop = require('../src/modules/shop/shop.model');
    const ShopOrder = require('../src/modules/shoporder/shoporder.model');
    const ctrl = require('../src/modules/dispute/dispute.controller');

    const dispute = await Dispute.findById('6a3a0eb63618b1c990c77c0c');
    const shop = await Shop.findOne({ ownerId: dispute.workerId });
    const cust = await Customer.findById(dispute.customerId);
    
    console.log('--- TEST: PENDING SETTLEMENT REFUND FLOW ---');
    console.log(`Initial Customer Balance: ₹${cust.wallet.balance}`);
    console.log(`Initial Shop Balance: ₹${shop.wallet.balance}`);
    
    const reqBody = { status: 'refunded', resolutionNotes: 'Testing PENDING settlement', refundAmount: 1000 };
    const req = { params: { id: dispute._id }, body: reqBody, user: { _id: cust._id } };
    
    await new Promise((resolve) => {
        const res = { 
            status: function() { return this; }, 
            json: function(d) { resolve(d); return this; },
            send: function(d) { resolve(d); return this; }
        };
        ctrl.updateDisputeStatus(req, res);
    });
    
    console.log('Controller Execution Finished.');
    
    const afterCust = await Customer.findById(cust._id);
    const afterShop = await Shop.findOne({ ownerId: dispute.workerId });
    const afterSt = await Settlement.findOne({ orderId: dispute.shopOrderId });
    
    console.log(`\nFinal Customer Balance: ₹${afterCust.wallet.balance}`);
    console.log(`Final Shop Balance: ₹${afterShop.wallet.balance}`);
    console.log(`Settlement Status: ${afterSt.status}`);
    console.log(`Settlement Note: ${afterSt.note}`);
    
    await mongoose.disconnect();
}
testPendingSettlement().catch(console.error);
