const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Customer = require('./src/modules/customer/customer.model');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kwickly');
        
        const adminEmail = 'admin@kwickly.com';
        const existingAdmin = await Customer.findOne({ email: adminEmail });
        
        if (existingAdmin) {
            console.log('Admin already exists');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('admin123', 12);
        
        const admin = new Customer({
            role: 'ADMIN',
            phone: '0000000000',
            email: adminEmail,
            password: hashedPassword,
            name: 'Super Admin',
            isVerified: true
        });

        await admin.save();
        console.log('Admin user created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
