const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({path:'../.env'});

async function cleanup() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const collectionsToDrop = ['bids', 'subscriptionplans', 'bankaccounts', 'upiaccounts', 'transactions', 'suggestions', 'cities', 'coupons', 'reviews', 'supporttickets'];
    for (const c of collectionsToDrop) {
        try {
            await db.dropCollection(c);
            console.log(`Dropped ${c}`);
        } catch(e) {
            console.log(`Skipped ${c} (${e.codeName})`);
        }
    }

    const filesToDelete = [
        '../src/modules/paymentMethod/paymentMethod.controller.js',
        '../src/modules/paymentMethod/paymentMethod.model.js',
        '../src/modules/paymentMethod/paymentMethod.routes.js',
        '../src/modules/transaction/transaction.model.js',
        '../src/modules/audit/audit.model.js',
        '../src/modules/audit/audit.service.js'
    ];

    for (const f of filesToDelete) {
        try {
            fs.unlinkSync(f);
            console.log(`Deleted ${f}`);
        } catch(e) {
            console.log(`Failed to delete ${f}`);
        }
    }

    try { fs.rmdirSync('../src/modules/paymentMethod'); console.log('Deleted paymentMethod folder'); } catch(e) {}
    try { fs.rmdirSync('../src/modules/transaction'); console.log('Deleted transaction folder'); } catch(e) {}
    try { fs.rmdirSync('../src/modules/audit'); console.log('Deleted audit folder'); } catch(e) {}

    console.log('Done!');
    process.exit(0);
}

cleanup();
