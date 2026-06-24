const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Customer = require('./src/modules/customer/customer.model');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kwickly';
mongoose.connect(MONGODB_URI).then(async () => {
  const hash = await bcrypt.hash('password123', 10);
  await Customer.updateOne(
    { role: 'ADMIN' },
    { $set: { email: 'admin@kwickly.com', password: hash, isVerified: true, name: 'Super Admin' } },
    { upsert: true }
  );
  console.log('Admin credentials created/updated');
  process.exit(0);
});
