const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');

const BASE_URL = 'http://localhost:5000/api/v1';

async function simulateCityFilter() {
  console.log('--- STARTING CITY FILTER SIMULATION ---');

  const customerPhone = '9000000001';
  const workerMumbaiPhone = '8000000001';
  const workerAhmedabadPhone = '8000000002';

  // 1. Send OTPs
  console.log('1. Sending OTPs...');
  await axios.post(`${BASE_URL}/auth/send-otp`, { phone: customerPhone, role: 'CUSTOMER' });
  await axios.post(`${BASE_URL}/auth/send-otp`, { phone: workerMumbaiPhone, role: 'WORKER' });
  await axios.post(`${BASE_URL}/auth/send-otp`, { phone: workerAhmedabadPhone, role: 'WORKER' });

  const redis = new Redis();
  const custOtp = (await redis.get(`otp:${customerPhone}`)).replace(/"/g, '');
  const wMumbaiOtp = (await redis.get(`otp:${workerMumbaiPhone}`)).replace(/"/g, '');
  const wAhmOtp = (await redis.get(`otp:${workerAhmedabadPhone}`)).replace(/"/g, '');

  // 2. Verify OTPs
  console.log('2. Verifying OTPs & Logging in...');
  const custRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: customerPhone, code: custOtp, role: 'CUSTOMER' });
  const wMumbaiRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: workerMumbaiPhone, code: wMumbaiOtp, role: 'WORKER' });
  const wAhmRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: workerAhmedabadPhone, code: wAhmOtp, role: 'WORKER' });

  const custToken = custRes.data.data.token;

  // 3. Force Worker States in DB (skip profile endpoints for speed)
  console.log('3. Forcing DB States (Setting City constraints)...');
  await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
  const Customer = mongoose.connection.collection('customers');
  const AppSettings = mongoose.connection.collection('appsettings');

  await AppSettings.updateOne(
      { isSingleton: 'CONFIG' },
      { $push: { subscriptionPlans: { id: 'TEST_PLAN', label: 'Test Plan', price: 100, durationDays: 30, targetRole: 'WORKER' } } },
      { upsert: true }
  );

  // Set Worker 1 (Mumbai) - Make them perfectly eligible EXCEPT for city
  await Customer.updateOne(
    { phone: workerMumbaiPhone, role: 'WORKER' },
    { $set: { 
        'kyc.status': 'APPROVED', 
        'wallet.balance': 500, 
        'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'subscription.isTrial': false,
        isOnline: true,
        serviceRadius: 50,
        city: 'Mumbai', // <--- MUMBAI
        activeLocation: { type: 'Point', coordinates: [72.8800, 19.0800] }, // Within 15km of job
        services: [{ isActive: true, categoryName: 'Cleaning' }]
    } }
  );

  // Set Worker 2 (Ahmedabad) - Perfectly eligible and CORRECT city
  await Customer.updateOne(
    { phone: workerAhmedabadPhone, role: 'WORKER' },
    { $set: { 
        'kyc.status': 'APPROVED', 
        'wallet.balance': 500, 
        'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'subscription.isTrial': false,
        isOnline: true,
        serviceRadius: 50,
        city: 'Ahmedabad', // <--- AHMEDABAD
        activeLocation: { type: 'Point', coordinates: [72.8800, 19.0800] }, // Same coordinates for testing radius logic vs city logic
        services: [{ isActive: true, categoryName: 'Cleaning' }]
    } }
  );
  console.log('Workers updated.');

  // 4. Create Job in Ahmedabad
  console.log('4. Customer Creates Job in Ahmedabad...');
  const jobPayload = {
    category: 'Cleaning',
    subcategory: 'Home Cleaning',
    description: 'City Filter Test Job',
    timeSlot: 'urgent',
    city: 'Ahmedabad', // <--- Customer requests Ahmedabad
    addressDetails: { fullAddress: 'Test Address in Ahmedabad', city: 'Ahmedabad' },
    location: {
      type: 'Point',
      coordinates: [72.8777, 19.0760] // Close enough for radius match
    }
  };

  try {
      const jobRes = await axios.post(`${BASE_URL}/jobs`, jobPayload, { headers: { Authorization: `Bearer ${custToken}` }});
      console.log(`Job Created Successfully: ${jobRes.data.data._id}`);
      console.log(`\n==== RESULT ====\nEligible Workers Notified: ${jobRes.data.data.notifiedWorkers}`);
      
      if (jobRes.data.data.notifiedWorkers === 1) {
          console.log('SUCCESS: Only the Ahmedabad worker was notified!');
      } else {
          console.log(`FAILURE: Expected 1 worker, got ${jobRes.data.data.notifiedWorkers}`);
      }

  } catch (err) {
      console.error('Failed to create job:', err.response?.data || err.message);
  }

  process.exit(0);
}

simulateCityFilter().catch(err => {
  console.error('SIMULATION FAILED:', err.message);
  process.exit(1);
});
