const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kwickly').then(async () => {
  const Customer = require('./src/modules/customer/customer.model');
  
  const worker = await Customer.findOne({ phone: '9274344142' });
  if (!worker) {
    console.log('WORKER NOT FOUND');
    process.exit(0);
  }
  
  console.log('WORKER:', JSON.stringify({
    id: worker._id,
    phone: worker.phone,
    role: worker.role,
    kycStatus: worker.kyc.status,
    isOnline: worker.isOnline,
    walletBalance: worker.wallet.balance,
    servicesCount: worker.services.length,
    services: worker.services
  }, null, 2));
  
  // Test the login
  const bcrypt = require('bcryptjs');
  const match = await bcrypt.compare('Admin@12', worker.password);
  console.log('\nPassword "Admin@12" matches:', match);
  
  mongoose.disconnect();
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
