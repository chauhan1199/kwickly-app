const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Customer = require('./src/modules/customer/customer.model');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const customer = await Customer.findOne({ role: 'CUSTOMER' });
  if (!customer) {
    console.log('No customer found');
    process.exit(1);
  }
  
  const token = jwt.sign({ id: customer._id, role: customer.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  console.log('Token:', token);

  const axios = require('axios');
  try {
    const res = await axios.put('http://localhost:5000/api/v1/customers/me/profile', { name: 'Test' }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
        console.error('Data:', err.response.data);
    }
  }

  process.exit(0);
}

run();
