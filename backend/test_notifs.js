const mongoose = require('mongoose');
const Notification = require('./src/modules/notification/notification.model');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const notifs = await Notification.find();
    console.log(`Total notifications: ${notifs.length}`);
    for(const n of notifs) {
      console.log(`Type: ${n.type}, readBy: ${n.readBy.length}, deletedBy: ${n.deletedBy.length}, targetRole: ${n.targetRole}, userId: ${n.userId}`);
    }
    process.exit(0);
  });
