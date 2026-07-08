const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const res = await mongoose.connection.db.collection('notifications').deleteMany({ title: 'Subscription Plans Updated 🎯' });
    console.log('Cleaned subscription spam:', res.deletedCount);
    process.exit(0);
  });
