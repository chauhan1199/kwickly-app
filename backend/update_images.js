const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
if (!process.env.MONGO_URI) require('dotenv').config({ path: path.join(__dirname, '.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Shop = require('./src/modules/shop/shop.model');
    const shops = await Shop.find({});
    for (let shop of shops) {
        if (shop.logoUrl && shop.logoUrl.includes('via.placeholder.com')) {
            try {
                const url = new URL(shop.logoUrl);
                const parts = url.pathname.split('/');
                const bg = parts[2] || 'cccccc';
                let fg = parts[3] ? parts[3].replace('.png', '') : '000000';
                const text = url.searchParams.get('text') || 'Shop';
                
                shop.logoUrl = `https://dummyimage.com/150x150/${bg}/${fg}.png&text=${encodeURIComponent(text)}`;
                await shop.save();
                console.log('Updated shop:', shop.name, 'to', shop.logoUrl);
            } catch(e) {
                console.log('Error parsing URL for shop', shop.name, e);
            }
        }
    }
    
    const Product = require('./src/modules/product/product.model');
    const products = await Product.find({ imageUrl: { $regex: 'via.placeholder.com' } });
    let count = 0;
    for (let product of products) {
        try {
            const url = new URL(product.imageUrl);
            const parts = url.pathname.split('/');
            const bg = parts[2] || 'cccccc';
            let fg = parts[3] ? parts[3].replace('.png', '') : '000000';
            const text = url.searchParams.get('text') || 'Product';
            
            product.imageUrl = `https://dummyimage.com/200x200/${bg}/${fg}.png&text=${encodeURIComponent(text)}`;
            await product.save();
            count++;
        } catch(e) {}
    }
    console.log(`Updated ${count} products`);
    
    try {
        const { getRedis } = require('./src/helpers/redis.helper');
        const redisClient = getRedis();
        const keys = await redisClient.keys('*');
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log('Cleared redis cache');
        }
    } catch(e) {}
    
    mongoose.disconnect();
});
