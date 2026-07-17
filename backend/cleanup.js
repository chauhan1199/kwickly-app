require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./src/modules/notification/notification.model');
const db = require('./src/config/db');

async function run() {
    await db();
    const query = { 
        type: 'BROADCAST', 
        title: { $in: ['Wallet Credited', 'Customer Updated', 'Customer Activated', 'Customer Deactivated', 'Shop Updated', 'New Customer Created'] } 
    };
    const badNotifs = await Notification.find(query);
    console.log('Found', badNotifs.length, 'bad notifications');
    
    if (badNotifs.length > 0) {
        const res = await Notification.deleteMany(query);
        console.log('Deleted successfully:', res.deletedCount);
    }
    
    mongoose.disconnect();
}

run().catch(console.error);
