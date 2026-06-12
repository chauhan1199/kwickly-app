const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kwickly').then(async () => {
  console.log('Connected to MongoDB');
  
  const Customer = require('./src/modules/customer/customer.model');
  
  // Check existing users
  const allUsers = await Customer.find({ phone: { $in: ['9274344141', '9274344142'] } }).select('phone role name kyc isOnline services');
  console.log('EXISTING USERS:', JSON.stringify(allUsers, null, 2));
  
  // Check all BROADCASTING jobs
  const Job = require('./src/modules/job/job.model');
  const jobs = await Job.find({ status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] } }).select('category subcategory status customerId');
  console.log('ACTIVE JOBS:', JSON.stringify(jobs, null, 2));
  
  // Check if worker account 9274344142 exists
  let worker = await Customer.findOne({ phone: '9274344142' });
  
  if (worker) {
    console.log('Updating existing account 9274344142 to WORKER with approved KYC...');
    worker.role = 'WORKER';
    worker.name = 'Test Worker';
    worker.kyc = { status: 'APPROVED', documents: [] };
    worker.isOnline = true;
    worker.wallet = { balance: 500 };
    worker.subscription = { isTrial: true };
    worker.services = [
      { category: new mongoose.Types.ObjectId('6a1ff858b8b59e2597370831'), subcategories: ['AC Deep Cleaning', 'Gas Refilling'], isActive: true },
      { category: new mongoose.Types.ObjectId('6a1ff858b8b59e259737082e'), subcategories: ['Switch Repair', 'Wiring & Rewiring'], isActive: true },
      { category: new mongoose.Types.ObjectId('6a1ff858b8b59e259737082b'), subcategories: ['Tap Replacement', 'Pipe Leak Repair'], isActive: true }
    ];
    const hashed = await bcrypt.hash('Admin@12', 10);
    worker.password = hashed;
    await worker.save();
    console.log('Updated!');
  } else {
    console.log('Creating new WORKER account 9274344142...');
    const hashed = await bcrypt.hash('Admin@12', 10);
    worker = await Customer.create({
      phone: '9274344142',
      role: 'WORKER',
      name: 'Test Worker',
      password: hashed,
      isVerified: true,
      isOnline: true,
      kyc: { status: 'APPROVED', documents: [] },
      wallet: { balance: 500 },
      subscription: { isTrial: true },
      services: [
        { category: new mongoose.Types.ObjectId('6a1ff858b8b59e2597370831'), subcategories: ['AC Deep Cleaning', 'Gas Refilling'], isActive: true },
        { category: new mongoose.Types.ObjectId('6a1ff858b8b59e259737082e'), subcategories: ['Switch Repair', 'Wiring & Rewiring'], isActive: true },
        { category: new mongoose.Types.ObjectId('6a1ff858b8b59e259737082b'), subcategories: ['Tap Replacement', 'Pipe Leak Repair'], isActive: true }
      ]
    });
    console.log('Created worker with ID:', worker._id.toString());
  }
  
  // Verify the worker
  const finalWorker = await Customer.findOne({ phone: '9274344142' }).populate('services.category', 'name');
  console.log('\nFINAL WORKER STATE:', JSON.stringify({
    id: finalWorker._id,
    phone: finalWorker.phone,
    role: finalWorker.role,
    kycStatus: finalWorker.kyc.status,
    isOnline: finalWorker.isOnline,
    walletBalance: finalWorker.wallet.balance,
    services: finalWorker.services.map(s => ({ category: s.category ? s.category.name : 'MISSING', isActive: s.isActive }))
  }, null, 2));
  
  // Also fix the existing 9274344141 customer (make sure isOnline is false for customer)
  await Customer.findOneAndUpdate({ phone: '9274344141', role: 'CUSTOMER' }, { isOnline: false });
  console.log('\nCustomer 9274344141 isOnline set to false');
  
  mongoose.disconnect();
  console.log('\n✅ Done! Use phone 9274344142 / Admin@12 to log in as WORKER');
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
