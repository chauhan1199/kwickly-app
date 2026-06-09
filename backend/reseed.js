require('dotenv').config();
const mongoose = require('mongoose');
const seedData = require('./src/helpers/seeder.helper');
const logger = require('./src/helpers/logger.helper');

const reseed = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kwickly';
        logger.info('Connecting to MongoDB for reseeding...');
        
        await mongoose.connect(mongoUri);
        logger.info('Connected.');

        // Wipe collections
        const collections = Object.keys(mongoose.connection.collections);
        for (const collectionName of collections) {
            await mongoose.connection.collections[collectionName].deleteMany({});
            logger.info(`Wiped collection: ${collectionName}`);
        }

        // Run seeder
        await seedData();
        
        logger.info('Database reseeded successfully.');
        process.exit(0);
    } catch (error) {
        logger.error('Reseed failed: ' + error.message);
        process.exit(1);
    }
};

reseed();
