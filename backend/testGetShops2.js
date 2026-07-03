const mongoose = require('mongoose');
const Shop = require('./src/modules/shop/shop.model');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
    const allShops = await Shop.find({});
    console.log("Total shops:", allShops.length);
    console.log("First shop isOnline:", allShops[0]?.isOnline);
    console.log("First shop:", allShops[0]);
    mongoose.disconnect();
}
run().catch(console.error);
