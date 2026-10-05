require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const ShopOrder = mongoose.model('ShopOrder', new mongoose.Schema({}, { strict: false }));
    const order = await ShopOrder.findOne({ orderNumber: 'ORD-20260929-AGFC' });
    if (!order) {
        console.error('Order ORD-20260929-AGFC not found!');
        const latest = await ShopOrder.find().sort({ createdAt: -1 }).limit(3);
        console.log('Latest orders:', latest.map(o => ({ id: o._id, orderNumber: o.orderNumber, status: o.status })));
        process.exit(1);
    }

    console.log('Found order:', {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryOtp: order.deliveryOtp,
        customerId: order.customerId,
        shopId: order.shopId,
        total: order.total
    });

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
