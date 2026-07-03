const mongoose = require('mongoose');
const Shop = require('./src/modules/shop/shop.model');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
    const allShops = await Shop.find({});
    console.log("Total shops in DB:", allShops.length);
    const approvedShops = await Shop.find({ 'kyc.status': { $in: ['APPROVED', 'PENDING'] } });
    console.log("Approved/Pending shops:", approvedShops.length);
    console.log("Sample shop kyc status:", allShops[0]?.kyc?.status);
    mongoose.disconnect();
}
run().catch(console.error);
