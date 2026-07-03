const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kwickly').then(async () => {
  const Message = require('./src/modules/chat/message.model');
  const msgs = await Message.find({ mediaUrl: { $exists: true, $ne: null } }).sort({ createdAt: -1 }).limit(5).select('mediaUrl text createdAt');
  console.log(JSON.stringify(msgs, null, 2));
  mongoose.disconnect();
}).catch(err => { console.error(err); process.exit(1); });
