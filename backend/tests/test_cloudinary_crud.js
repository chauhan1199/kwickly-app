require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

function loadModels() {
    const glob = require('glob');
    glob.sync('../src/**/*.model.js', { cwd: __dirname }).forEach(f => {
        require(path.resolve(__dirname, f));
    });
}
loadModels();

const Customer = mongoose.model('Customer');
const Shop = mongoose.model('Shop');
const Product = mongoose.model('Product');
const Category = mongoose.model('Category');
const { uploadImage, deleteImage } = require('../src/services/cloudinary.service');
const fs = require('fs');

const log = (msg) => console.log('[TEST] ' + msg);

async function runTests() {
    try {
        log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        
        // 1. Create a dummy buffer (1x1 transparent PNG)
        const dummyImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

        log('--- TESTING CLOUDINARY UPLOAD ---');
        const uploadResult = await uploadImage(dummyImageBuffer, 'kwickly/test');
        log('Cloudinary Upload Success: ' + uploadResult.url);
        
        if (!uploadResult.url.includes('res.cloudinary.com')) {
            throw new Error('Upload URL does not contain Cloudinary domain!');
        }

        log('--- TESTING DATABASE CRUD (Category) ---');
        // Create Category
        const newCategory = await Category.create({
            name: 'Test Category ' + Date.now(),
            description: 'Test Desc',
            imageUrl: uploadResult.url,
            active: true
        });
        log('Category Created with Image: ' + newCategory.name);

        // Update Category
        newCategory.description = 'Updated Desc';
        await newCategory.save();
        log('Category Updated');

        // Delete Category
        await Category.findByIdAndDelete(newCategory._id);
        log('Category Deleted');

        log('--- TESTING DATABASE CRUD (Product) ---');
        const dummyShopId = new mongoose.Types.ObjectId();
        const newProduct = await Product.create({
            shopId: dummyShopId,
            name: 'Test Product ' + Date.now(),
            category: 'Test Category',
            price: 100,
            imageUrl: uploadResult.url
        });
        log('Product Created with Image: ' + newProduct.name);
        
        await Product.findByIdAndDelete(newProduct._id);
        log('Product Deleted');
        
        log('--- CLEANING UP CLOUDINARY ---');
        await deleteImage(uploadResult.public_id);
        log('Cloudinary Test Image Deleted');

        log('====================================');
        log('ALL CRUD & CLOUDINARY TESTS PASSED!');
        log('====================================');
        
        process.exit(0);
    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}

runTests();
