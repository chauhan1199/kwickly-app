'use strict';

const mongoose = require('mongoose');

const uri = 'mongodb+srv://kwickly:Admin%4012@kwickly.bzvkcwl.mongodb.net/kwickly?retryWrites=true&w=majority&appName=Kwickly';

async function run() {
  await mongoose.connect(uri);
  const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));
  const WalletTxn = mongoose.model('WalletTxn', new mongoose.Schema({}, { strict: false }));
  
  const testTxnIds = [
    '6a9bf80a3ee329f14d5dfa9f', // 103
    '6a9bf84e3ee329f14d5dfaa5', // 102
    '6a9bf88b3ee329f14d5dfaab', // 122
    '6a9bfa203ee329f14d5dfab1'  // 101
  ].map(id => new mongoose.Types.ObjectId(id));

  // Mark test transactions as VOID / FAILED
  const res = await WalletTxn.updateMany(
    { _id: { $in: testTxnIds } },
    { $set: { status: 'FAILED', description: 'Test transaction voided during UTR validation audit' } }
  );
  console.log('Voided test txns count:', res.modifiedCount);

  // Restore balance to verified 1979
  const updatedUser = await Customer.findOneAndUpdate(
    { phone: '9274344141' },
    { $set: { 'wallet.balance': 1979 } },
    { returnDocument: 'after' }
  );

  console.log('Restored balance to:', updatedUser?.wallet?.balance);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
