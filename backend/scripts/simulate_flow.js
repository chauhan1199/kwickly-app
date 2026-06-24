const axios = require('axios');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api/v1';

async function simulate() {
  console.log('--- STARTING END-TO-END SIMULATION ---');

  const customerPhone = '9999999990';
  const workerPhone = '8888888880';

  // 1. Send OTP
  console.log('1. Sending OTPs...');
  await axios.post(`${BASE_URL}/auth/send-otp`, { phone: customerPhone, role: 'CUSTOMER' });
  await axios.post(`${BASE_URL}/auth/send-otp`, { phone: workerPhone, role: 'WORKER' });

  // Assume OTP is hardcoded or we fetch from Redis. Wait, OTP is sent via SMS and cached.
  // We need to either mock OTP or fetch it from Redis to verify.
  // Instead of dealing with Redis, I'll connect to Redis and get the OTPs.
  const Redis = require('ioredis');
  const redis = new Redis();
  
  const custOtp = (await redis.get(`otp:${customerPhone}`)).replace(/"/g, '');
  const workOtp = (await redis.get(`otp:${workerPhone}`)).replace(/"/g, '');
  console.log(`Cust OTP: ${custOtp}, Worker OTP: ${workOtp}`);

  // 2. Verify OTP and login
  console.log('2. Verifying OTPs & Logging in...');
  const custRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: customerPhone, code: custOtp, role: 'CUSTOMER' });
  const workRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: workerPhone, code: workOtp, role: 'WORKER' });

  const custToken = custRes.data.data.token;
  const workToken = workRes.data.data.token;

  // 3. Update Profiles
  console.log('3. Updating Profiles...');
  await axios.put(`${BASE_URL}/customers/me/profile`, { name: 'Test Customer', email: 'cust@test.com' }, { headers: { Authorization: `Bearer ${custToken}` }});
  await axios.put(`${BASE_URL}/workers/me/profile`, { name: 'Test Worker', email: 'worker@test.com', services: ['Cleaning'] }, { headers: { Authorization: `Bearer ${workToken}` }});

  // Connect to DB to force worker KYC and Wallet
  console.log('--- Connecting to MongoDB to force Worker State ---');
  await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
  const Customer = mongoose.connection.collection('customers');
  const AppSettings = mongoose.connection.collection('appsettings');

  // Insert test subscription plan in settings
  await AppSettings.updateOne(
      { isSingleton: 'CONFIG' },
      { $push: { subscriptionPlans: { id: 'TEST_PLAN', label: 'Test Plan', price: 100, durationDays: 30, targetRole: 'WORKER' } } },
      { upsert: true }
  );

  await Customer.updateOne(
    { phone: workerPhone, role: 'WORKER' },
    { $set: { 
        'kyc.status': 'APPROVED', 
        'wallet.balance': 500, 
        isOnline: true,
        serviceRadius: 50,
        city: 'Mumbai',
        activeLocation: { type: 'Point', coordinates: [72.8800, 19.0800] },
        services: [{ isActive: true, categoryName: 'Cleaning' }]
    } }
  );
  console.log('Worker forcefully approved and wallet funded.');

  // 3.5 Test Atomic Subscription
  console.log('3.5 Worker Purchasing Subscription...');
  try {
      await axios.post(`${BASE_URL}/subscriptions/subscribe`, { planId: 'TEST_PLAN', paymentId: 'test_pay' }, { headers: { Authorization: `Bearer ${workToken}` }});
      console.log('Subscription purchased successfully (Atomic TX worked).');
  } catch (err) {
      console.log('Subscription failed or already exists:', err.response?.data || err.message);
  }

  // 4. Create Job (Customer)
  console.log('4. Creating Job with City constraints...');
  const jobPayload = {
    category: 'Cleaning',
    subcategory: 'Home Cleaning',
    description: 'E2E Test Job',
    timeSlot: 'urgent',
    city: 'Mumbai',
    addressDetails: { fullAddress: 'Test Address', city: 'Mumbai' },
    location: {
      type: 'Point',
      coordinates: [72.8777, 19.0760] // Mumbai longitude, latitude
    }
  };
  const jobRes = await axios.post(`${BASE_URL}/jobs`, jobPayload, { headers: { Authorization: `Bearer ${custToken}` }});
  const jobId = jobRes.data.data._id;
  console.log(`Job Created: ${jobId}`);

  // 4.5 Worker Places Quote
  console.log('4.5 Worker Places Quote...');
  const quoteRes = await axios.post(`${BASE_URL}/quotes`, {
    jobId: jobId,
    amount: 500,
    description: 'I can do it!',
    workerLocation: { type: 'Point', coordinates: [72.8800, 19.0800] }
  }, { headers: { Authorization: `Bearer ${workToken}` }});
  const quoteId = quoteRes.data.data._id;

  // 4.6 Customer Accepts Quote
  console.log('4.6 Customer Accepts Quote...');
  const acceptRes = await axios.patch(`${BASE_URL}/quotes/${quoteId}/accept`, {}, { headers: { Authorization: `Bearer ${custToken}` }});
  
  const arrivalOtp = acceptRes.data.data.job.security.arrivalOtp;
  const completionOtp = acceptRes.data.data.job.security.completionOtp;
  console.log(`Job Allocated! Arrival OTP: ${arrivalOtp}, Completion OTP: ${completionOtp}`);

  // 5. Worker Starts Job
  console.log('5. Worker Starts Job...');
  await axios.post(`${BASE_URL}/jobs/${jobId}/start`, { arrivalOtp }, { headers: { Authorization: `Bearer ${workToken}` }});

  // 6. Worker Completes Job
  console.log('6. Worker Completes Job...');
  await axios.post(`${BASE_URL}/jobs/${jobId}/complete`, {}, { headers: { Authorization: `Bearer ${workToken}` }});

  // 7. Customer Pays & Rates Job
  console.log('7. Customer Pays and Rates Job...');
  await axios.post(`${BASE_URL}/jobs/${jobId}/pay`, { paymentMethod: 'CASH', completionOtp }, { headers: { Authorization: `Bearer ${custToken}` }});
  await axios.post(`${BASE_URL}/jobs/${jobId}/rate`, { score: 5, review: 'Great job!' }, { headers: { Authorization: `Bearer ${custToken}` }});

  console.log('--- SIMULATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

simulate().catch(err => {
  console.error('SIMULATION FAILED:', err.response ? err.response.data : err.message);
  process.exit(1);
});
