const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kwickly').then(async () => {
  const Message = require('./src/modules/chat/message.model');
  // Fix all messages that have the 10.0.2.2 emulator IP in their mediaUrl
  const result = await Message.updateMany(
    { mediaUrl: /10\.0\.2\.2/ },
    [{ $set: { mediaUrl: { $replaceAll: { input: '$mediaUrl', find: '10.0.2.2', replacement: 'localhost' } } } }],
    { updatePipeline: true }
  );
  console.log('Fixed messages:', result.modifiedCount);
  
  // Verify
  const msgs = await Message.find({ mediaUrl: { $exists: true, $ne: null } }).sort({ createdAt: -1 }).limit(5).select('mediaUrl text');
  console.log(JSON.stringify(msgs, null, 2));
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
