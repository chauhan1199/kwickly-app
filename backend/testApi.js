const mongoose = require('mongoose');
const Customer = require('./src/modules/customer/customer.model');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kwickly');
  const user = await Customer.findOne({ role: 'CUSTOMER' });
  
  if (!user) {
    console.log("No user found");
    process.exit(1);
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  
  try {
    const res = await fetch('http://localhost:5000/api/v1/customers/me/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        label: 'API Test',
        street: '123 API St',
        city: 'Mumbai',
        pincode: '400001',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.0760]
        },
        isPrimary: false
      })
    });
    const data = await res.json();
    console.log("API Response Status:", res.status);
    console.log("API Response Data:", data);
  } catch(e) {
    console.error("API Error:", e);
  }
  process.exit(0);
}
run();
