const mongoose = require('mongoose');
const Notification = require('./src/modules/notification/notification.model');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const userId = new mongoose.Types.ObjectId('6a3d1d6f0ec16c13a9453e03');
    const role = 'WORKER';

    const query = {
        deletedBy: { $ne: userId },
        readBy:    { $ne: userId },
        $or: [
            { type: 'DIRECT',    userId },
            { type: 'BROADCAST', targetRole: { $in: ['ALL', role] } },
            { type: 'SYSTEM' }
        ]
    };

    const count = await Notification.countDocuments(query);
    console.log(`Unread count for ${userId}: ${count}`);
    process.exit(0);
  });
