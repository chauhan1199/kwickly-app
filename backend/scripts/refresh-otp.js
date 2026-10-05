require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const ShopOrder = mongoose.model('ShopOrder', new mongoose.Schema({}, { strict: false }));
    const res = await ShopOrder.updateOne(
        { _id: new mongoose.Types.ObjectId('6abb78fc994666dea8a564a2') },
        { deliveryOtpGeneratedAt: new Date(), deliveryOtpAttempts: 0 }
    );
    console.log('Delivery OTP timestamp refreshed successfully:', res);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
