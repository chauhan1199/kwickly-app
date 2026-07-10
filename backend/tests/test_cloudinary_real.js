require('dotenv').config();
const mongoose = require('mongoose');
const { uploadImage } = require('../src/services/cloudinary.service');
const sharp = require('sharp');

// Load Product Model
require('../src/modules/product/product.model.js');
const Product = mongoose.model('Product');

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Generating a real colorful image using Sharp...');
        const buffer = await sharp({
            create: {
                width: 400, height: 400, channels: 4,
                background: { r: 255, g: 105, b: 180, alpha: 1 } // Hot Pink!
            }
        }).png().toBuffer();

        console.log('Uploading real image to Cloudinary kwickly/products...');
        const result = await uploadImage(buffer, 'kwickly/products');
        
        console.log('Creating a new test product in the database...');
        const newProduct = await Product.create({
            shopId: new mongoose.Types.ObjectId(), // dummy shop ID
            name: 'Cloudinary Pink Test Product',
            category: 'General',
            price: 999,
            unit: 'Item',
            description: 'This is a test product to verify Cloudinary URLs in the database',
            stock: 100,
            imageUrl: result.url // THIS IS THE CLOUDINARY URL!
        });

        console.log('----------------------------------------------------');
        console.log('SUCCESS!');
        console.log('Product created in MongoDB with ID:', newProduct._id.toString());
        console.log('Cloudinary URL saved in DB:', newProduct.imageUrl);
        console.log('Please click "Find" (or Refresh) in MongoDB Compass and scroll to the bottom!');
        console.log('----------------------------------------------------');
        
        process.exit(0);
    } catch (e) {
        console.error('Failed:', e);
        process.exit(1);
    }
}

run();
