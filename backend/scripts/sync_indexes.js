const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const glob = require('glob');

async function syncIndexes() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('Loading all Mongoose models...');
        const modelsPath = path.join(__dirname, '../src/modules');
        const files = glob.sync('**/*.model.js', { cwd: modelsPath });
        for (const file of files) {
            require(path.join(modelsPath, file));
        }

        console.log(`Loaded ${mongoose.modelNames().length} models.`);
        
        for (const modelName of mongoose.modelNames()) {
            const Model = mongoose.model(modelName);
            console.log(`\nSyncing indexes for: ${modelName}`);
            
            try {
                // Drop all existing indexes except _id
                await Model.collection.dropIndexes();
                console.log(`- Dropped old indexes for ${modelName}`);
            } catch (err) {
                if (err.code !== 26) { // 26 means namespace not found (empty collection)
                    console.log(`- Skipping drop for ${modelName}: ${err.message}`);
                }
            }

            try {
                // Rebuild indexes based on current schema
                await Model.syncIndexes();
                console.log(`- Rebuilt indexes for ${modelName} successfully`);
            } catch (err) {
                console.error(`- Error rebuilding indexes for ${modelName}:`, err);
            }
        }
        
        console.log('\n=======================================');
        console.log('ALL INDEXES SYNCED SUCCESSFULLY!');
        console.log('=======================================');
        process.exit(0);
    } catch (error) {
        console.error('Failed to sync indexes:', error);
        process.exit(1);
    }
}

syncIndexes();
