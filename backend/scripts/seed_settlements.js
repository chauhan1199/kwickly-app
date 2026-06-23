const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function seedSettlements() {
    await mongoose.connect(process.env.MONGO_URI);
    const Shop = require('../src/modules/shop/shop.model');
    const Settlement = require('../src/modules/settlement/settlement.model');
    const Customer = require('../src/modules/customer/customer.model');

    const shops = await Shop.find().limit(3);
    const customer = await Customer.findOne({ role: 'CUSTOMER' });

    if (!shops.length || !customer) {
        console.log('No shops or customers found. Run basic seeders first.');
        process.exit(1);
    }

    console.log('Clearing old settlements...');
    await Settlement.deleteMany({});

    console.log('Creating mock pending settlements...');
    for (let i = 0; i < 5; i++) {
        const shop = shops[i % shops.length];
        const total = Math.floor(Math.random() * 2500) + 500;
        const commission = Math.round(total * 0.1); // 10%

        await Settlement.create({
            type: 'PRODUCT_ORDER',
            orderId: new mongoose.Types.ObjectId(), // Mock order ID
            shopId: shop._id,
            customerId: customer._id,
            totalAmount: total,
            platformCommission: commission,
            shopEarning: total - commission,
            status: 'PENDING'
        });
    }

    console.log('Creating mock settled settlements...');
    for (let i = 0; i < 3; i++) {
        const shop = shops[i % shops.length];
        const total = Math.floor(Math.random() * 4000) + 1000;
        const commission = Math.round(total * 0.1);

        await Settlement.create({
            type: 'PRODUCT_ORDER',
            orderId: new mongoose.Types.ObjectId(),
            shopId: shop._id,
            customerId: customer._id,
            totalAmount: total,
            platformCommission: commission,
            shopEarning: total - commission,
            status: 'SETTLED',
            settledAt: new Date(),
            note: 'Settled on time'
        });
    }

    console.log('Settlements seeded successfully!');
    await mongoose.disconnect();
}

seedSettlements().catch(console.error);
