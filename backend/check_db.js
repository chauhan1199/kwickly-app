require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('./src/modules/customer/customer.model');
const bcrypt = require('bcryptjs');

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const admin = await Customer.findOne({ role: 'ADMIN' });
        if (admin) {
            console.log('Admin found:', {
                email: admin.email,
                role: admin.role,
                hasPassword: !!admin.password
            });
        } else {
            console.log('No admin found. Seeding...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const newAdmin = await Customer.create({
                email: 'admin@kwickly.com',
                password: hashedPassword,
                role: 'ADMIN',
                phone: '0000000000', // required field
                name: 'Kwickly Admin',
                isVerified: true
            });
            console.log('Admin seeded with email: admin@kwickly.com and password: admin123');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
};

checkAdmin();
