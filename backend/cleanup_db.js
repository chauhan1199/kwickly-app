const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const result = await mongoose.connection.db.collection('notifications').deleteMany({ type: 'BROADCAST', targetRole: 'ALL', action: 'OTHER' });
    console.log('Cleaned rogue notifications:', result.deletedCount);
    process.exit(0);
  });
