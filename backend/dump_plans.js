const mongoose = require('mongoose');
const AppSettings = require('./src/modules/settings/settings.model');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    const s = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    console.log(JSON.stringify(s.subscriptionPlans, null, 2));
    process.exit(0);
  });
