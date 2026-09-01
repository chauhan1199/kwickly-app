require('dotenv').config();
const mongoose = require('mongoose');
const AppSettings = require('../src/modules/settings/settings.model');
const { DEFAULT_TERMS_OF_SERVICE, DEFAULT_PRIVACY_POLICY, DEFAULT_FAQS } = require('../src/constants/legal');
const { initRedis, delCache } = require('../src/helpers/redis.helper');

const run = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        initRedis();

        console.log('Updating AppSettings singleton with comprehensive T&C, Privacy Policy, and 24 FAQs...');
        const res = await AppSettings.findOneAndUpdate(
            { isSingleton: 'CONFIG' },
            { 
                $set: {
                    'legal.termsOfService': DEFAULT_TERMS_OF_SERVICE,
                    'legal.privacyPolicy': DEFAULT_PRIVACY_POLICY,
                    faqs: DEFAULT_FAQS
                }
            },
            { upsert: true, new: true }
        );

        console.log('AppSettings updated successfully. FAQs count:', res.faqs?.length);

        console.log('Clearing Redis caches...');
        await delCache('public_settings');
        await delCache('app_settings');
        await delCache('app_branding');
        console.log('Redis caches cleared.');

        console.log('DONE!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding FAQs:', err);
        process.exit(1);
    }
};

run();
