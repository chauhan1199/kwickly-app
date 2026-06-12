const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kwickly').then(async () => {
  const Customer = require('./src/modules/customer/customer.model');
  
  // Drop the old unique indexes if they exist
  try {
    await Customer.collection.dropIndex('phone_1');
    console.log('Dropped old phone_1 index');
  } catch (e) { console.log('phone_1 index not found or already dropped'); }
  
  try {
    await Customer.collection.dropIndex('email_1');
    console.log('Dropped old email_1 index');
  } catch (e) { console.log('email_1 index not found or already dropped'); }

  // Sync new indexes
  await Customer.syncIndexes();
  console.log('Indexes synced');

  // Create Worker account for 9274344141
  let worker = await Customer.findOne({ phone: '9274344141', role: 'WORKER' });
  
  if (!worker) {
    console.log('Creating WORKER account for 9274344141...');
    const hashed = await bcrypt.hash('Admin@12', 10);
    worker = await Customer.create({
      phone: '9274344141',
      role: 'WORKER',
      name: 'Ghanshyam Worker',
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
    console.log('Worker created with ID:', worker._id);
  } else {
    console.log('Worker account for 9274344141 already exists. Resetting to online and approved...');
    worker.kyc = { status: 'APPROVED', documents: [] };
    worker.isOnline = true;
    worker.services = [
      { category: new mongoose.Types.ObjectId('6a1ff858b8b59e2597370831'), subcategories: ['AC Deep Cleaning', 'Gas Refilling'], isActive: true },
      { category: new mongoose.Types.ObjectId('6a1ff858b8b59e259737082e'), subcategories: ['Switch Repair', 'Wiring & Rewiring'], isActive: true },
      { category: new mongoose.Types.ObjectId('6a1ff858b8b59e259737082b'), subcategories: ['Tap Replacement', 'Pipe Leak Repair'], isActive: true }
    ];
    await worker.save();
    console.log('Worker updated.');
  }

  mongoose.disconnect();
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
