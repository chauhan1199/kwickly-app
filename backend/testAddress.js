const mongoose = require('mongoose');
const Customer = require('./src/modules/customer/customer.model');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kwickly');
  console.log("Connected to DB");

  const user = await Customer.findOne({ role: 'CUSTOMER' });
  if (!user) return console.log("No customer found");

  try {
    user.addresses.push({
      label: 'Home',
      street: '123 Test St',
      city: 'Test City',
      pincode: '123456',
      location: { type: 'Point', coordinates: [72.8777, 19.0760] }
    });
    await user.save();
    console.log("Address saved successfully");
  } catch (err) {
    console.error("Save Error:", err.message);
  }
  process.exit(0);
}

run();
