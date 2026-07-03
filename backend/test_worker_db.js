const mongoose = require('mongoose');
require('dotenv').config();
const Customer = require('./src/modules/customer/customer.model');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const worker = await Customer.findOne({ role: 'WORKER' }).populate('services.category');
    console.log(JSON.stringify(worker, null, 2));
    process.exit(0);
  });
