const mongoose = require('mongoose');
const { initRedis, getCache, delCache } = require('./src/helpers/redis.helper');
const AppSettings = require('./src/modules/settings/settings.model.js');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    initRedis();
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    if (settings) {
        settings.subscriptionPlans = [
            { id: 'monthly', label: 'Monthly Pro', price: 499, durationDays: 30, features: ['Priority support', 'Reduced commission', 'Featured tag'], isActive: true, targetRole: 'WORKER' },
            { id: 'semi', label: 'Half-Yearly Pro', price: 2499, durationDays: 180, features: ['Priority support', 'Reduced commission', 'Featured tag'], isActive: true, targetRole: 'WORKER' },
            { id: 'annual', label: 'Annual Pro', price: 4499, durationDays: 365, features: ['Priority support', 'Reduced commission', 'Featured tag'], isActive: true, targetRole: 'WORKER' }
        ];
        await settings.save();
        
        await delCache('app_settings');
        console.log('Database updated and Redis cache cleared successfully.');
    }
    process.exit(0);
  });
