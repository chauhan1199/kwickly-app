const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function cleanup() {
    await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
    console.log('Connected to DB');

    // Register all models so they are available
    require('./src/modules/adminWallet/adminWallet.model');
    require('./src/modules/cart/cart.model');
    require('./src/modules/category/category.model');
    require('./src/modules/chat/message.model');
    require('./src/modules/customer/customer.model');
    require('./src/modules/deliveryStaff/deliveryStaff.model');
    require('./src/modules/dispute/dispute.model');
    require('./src/modules/job/job.model');
    require('./src/modules/notification/notification.model');
    require('./src/modules/payment/payment.model');
    require('./src/modules/payout/payout.model');
    require('./src/modules/product/product.model');
    require('./src/modules/promotion/promotion.model');
    require('./src/modules/quote/quote.model');
    require('./src/modules/settings/settings.model');
    require('./src/modules/settlement/settlement.model');
    require('./src/modules/shop/shop.model');
    require('./src/modules/shoporder/shoporder.model');
    require('./src/modules/subscription/subscription.model');
    require('./src/modules/suggestion/suggestion.model');
    require('./src/modules/wallet/wallet.model');
    
    // There might be a worker model that was missed in the find command? 
    // Yes, the find output didn't list worker.model.js, let's include it just in case.
    try {
        require('./src/modules/worker/worker.model');
    } catch(e) {}

    const models = mongoose.modelNames();
    console.log('Models found:', models);

    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        console.log('No uploads directory found');
        process.exit(0);
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`Found ${files.length} files in uploads directory`);

    // Get all DB data as string
    let fullDbString = '';
    for (const modelName of models) {
        const Model = mongoose.model(modelName);
        const docs = await Model.find().lean();
        fullDbString += JSON.stringify(docs);
    }

    let deletedCount = 0;
    for (const file of files) {
        if (file === '.gitkeep' || file === 'README.md') continue;
        
        // Encode URI component might be used in DB, so check both raw and encoded
        const isUsed = fullDbString.includes(file) || fullDbString.includes(encodeURIComponent(file));
        
        if (!isUsed) {
            const filePath = path.join(uploadsDir, file);
            fs.unlinkSync(filePath);
            console.log(`Deleted unused file: ${file}`);
            deletedCount++;
        }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} unused images.`);
    process.exit(0);
}

cleanup().catch(err => {
    console.error(err);
    process.exit(1);
});
