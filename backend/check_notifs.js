const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const res = await mongoose.connection.db.collection('notifications').find({ title: { $regex: 'Credited', $options: 'i' } }).sort({ createdAt: -1 }).limit(2).toArray();
    console.log("Credited notifications:");
    console.log(JSON.stringify(res, null, 2));

    const res2 = await mongoose.connection.db.collection('notifications').find({ title: { $regex: 'Subscription', $options: 'i' } }).sort({ createdAt: -1 }).limit(2).toArray();
    console.log("Subscription notifications:");
    console.log(JSON.stringify(res2, null, 2));
    process.exit(0);
  });
