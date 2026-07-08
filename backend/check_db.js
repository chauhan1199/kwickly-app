const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const res = await mongoose.connection.db.collection('notifications').find({ title: 'Product Updated' }).sort({ createdAt: -1 }).limit(2).toArray();
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  });
