require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Customer = require('./src/modules/customer/customer.model');
  const WalletTxn = require('./src/modules/wallet/wallet.model');
  const Payment = require('./src/modules/payment/payment.model');

  // Remove the fake auto-credited payments
  await Payment.deleteMany({
    userId: '6a87ee5d49d35982d3979069',
    razorpayPaymentId: { $regex: '^UPI_' }
  });

  await WalletTxn.deleteMany({
    userId: '6a87ee5d49d35982d3979069',
    razorpayPaymentId: { $regex: '^UPI_' }
  });

  // Reset wallet balance to 1674 (genuine amount after 101 + 102)
  await Customer.findByIdAndUpdate('6a87ee5d49d35982d3979069', { 'wallet.balance': 1674 });

  console.log('CLEANED UP! Balance reset to 1674');
  await mongoose.disconnect();
})().catch(console.error);
