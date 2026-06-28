const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  
  const result = await db.collection('jobs').updateMany(
    { category: 'Service' },
    { 
      $set: { 
        category: 'Bike two wheeler service',
        subcategory: 'Bike servicing'
      } 
    }
  );
  
  console.log(`Updated ${result.modifiedCount} jobs`);
  process.exit(0);
}

run().catch(console.error);
