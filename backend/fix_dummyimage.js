const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
if (!process.env.MONGO_URI) require('dotenv').config({ path: path.join(__dirname, '.env') });
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Product = require('./src/modules/product/product.model');
    const products = await Product.find({});
    let count = 0;
    for (let product of products) {
        if (product.imageUrl && product.imageUrl.includes('&text=')) {
            product.imageUrl = product.imageUrl.replace('&text=', '?text=');
            await product.save();
            count++;
        }
    }
    console.log('Fixed', count, 'product images.');
    mongoose.disconnect();
});
