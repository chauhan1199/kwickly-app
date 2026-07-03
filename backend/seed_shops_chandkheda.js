const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Shop = require('./src/modules/shop/shop.model');
const Customer = require('./src/modules/customer/customer.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kwickly';

const seedShops = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const shopsData = [
            {
                name: 'Chandkheda SuperMart',
                category: 'Grocery',
                description: 'Fresh groceries and daily essentials in Chandkheda.',
                address: '123 Main Road, Chandkheda, Ahmedabad',
                location: { type: 'Point', coordinates: [72.5800, 23.1119] },
                logoUrl: 'https://via.placeholder.com/150/09f/fff.png?text=SuperMart'
            },
            {
                name: 'Shreeji Dairy & Bakery',
                category: 'Dairy',
                description: 'Fresh milk, paneer, bread and cakes.',
                address: 'Opp. Bus Stand, Chandkheda, Ahmedabad',
                location: { type: 'Point', coordinates: [72.5780, 23.1125] },
                logoUrl: 'https://via.placeholder.com/150/ff9/000.png?text=Shreeji'
            },
            {
                name: 'Ahmedabad Pharmacy',
                category: 'Pharmacy',
                description: 'All your medical needs, delivered fast.',
                address: 'IOC Road, Chandkheda, Ahmedabad',
                location: { type: 'Point', coordinates: [72.5810, 23.1100] },
                logoUrl: 'https://via.placeholder.com/150/f00/fff.png?text=Pharmacy'
            },
            {
                name: 'Fresh Greens Veggies',
                category: 'Vegetables',
                description: 'Farm fresh vegetables directly from farmers.',
                address: 'Sabarmati-Gandhinagar Highway, Chandkheda',
                location: { type: 'Point', coordinates: [72.5825, 23.1150] },
                logoUrl: 'https://via.placeholder.com/150/0f0/fff.png?text=Veggies'
            },
            {
                name: 'Gujarat Electronics',
                category: 'Electronics',
                description: 'Gadgets, repairs and home appliances.',
                address: 'New CG Road, Chandkheda, Ahmedabad',
                location: { type: 'Point', coordinates: [72.5790, 23.1130] },
                logoUrl: 'https://via.placeholder.com/150/333/fff.png?text=Electronics'
            }
        ];

        for (let i = 0; i < shopsData.length; i++) {
            const data = shopsData[i];
            
            // Create dummy owner
            const phone = `99000${Math.floor(10000 + Math.random() * 90000)}`;
            const owner = await Customer.create({
                name: `Owner of ${data.name}`,
                phone: phone,
                role: 'SHOP',
                isVerified: true,
                wallet: { balance: 0 }
            });

            const shop = await Shop.create({
                ...data,
                ownerId: owner._id,
                kyc: { status: 'APPROVED' },
                subscription: { status: 'ACTIVE', isTrial: true },
                isOnline: true,
                rating: 4.5 + (Math.random() * 0.5),
                totalOrders: Math.floor(Math.random() * 100) + 10
            });

            console.log(`Created shop: ${shop.name} with owner phone: ${phone}`);
        }

        console.log('Seeding completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding shops:', err);
        process.exit(1);
    }
};

seedShops();
