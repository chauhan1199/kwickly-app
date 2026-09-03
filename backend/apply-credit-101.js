require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Payment = require('./src/modules/payment/payment.model');
  const Customer = require('./src/modules/customer/customer.model');
  const WalletTxn = require('./src/modules/wallet/wallet.model');

  const payment = await Payment.findById('6a99374f385f847da34ca80e');
  if (!payment) {
    console.log('Payment not found');
    process.exit(1);
  }
  const utr = '661220784111';

  const updatedUser = await Customer.findByIdAndUpdate(
    payment.userId,
    { $inc: { 'wallet.balance': payment.amount } },
    { returnDocument: 'after' }
  );

  payment.status = 'COMPLETED';
  payment.razorpayPaymentId = utr;
  await payment.save();

  const txn = await WalletTxn.create({
    userId: payment.userId,
    type: 'TOPUP',
    amount: payment.amount,
    balance: updatedUser.wallet.balance,
    status: 'COMPLETED',
    razorpayOrderId: payment._id.toString(),
    razorpayPaymentId: utr,
    verifiedAt: new Date(),
    description: `Wallet Top-up via Direct UPI (Verified - Ref ${utr})`
  });

  console.log('SUCCESS! Updated Balance:', updatedUser.wallet.balance, 'Txn ID:', txn._id);
  await mongoose.disconnect();
})().catch(console.error);
