const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const Customer = require('../src/modules/customer/customer.model');
const Category = require('../src/modules/category/category.model');
const Job = require('../src/modules/job/job.model');
const Quote = require('../src/modules/quote/quote.model');
const Payout = require('../src/modules/payout/payout.model');
const Notification = require('../src/modules/notification/notification.model');
const AppSettings = require('../src/modules/settings/settings.model');
const Dispute = require('../src/modules/dispute/dispute.model');
const Suggestion = require('../src/modules/suggestion/suggestion.model');
const Shop = require('../src/modules/shop/shop.model');
const Product = require('../src/modules/product/product.model');
const ShopOrder = require('../src/modules/shoporder/shoporder.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly';

async function seedRichData() {
    console.log('Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully!');

    try {
        // Clear collections
        await Customer.deleteMany({});
        await Category.deleteMany({});
        await Job.deleteMany({});
        await Quote.deleteMany({});
        await Payout.deleteMany({});
        await Notification.deleteMany({});
        await AppSettings.deleteMany({});
        await Dispute.deleteMany({});
        await Suggestion.deleteMany({});
        await Shop.deleteMany({});
        await Product.deleteMany({});
        await ShopOrder.deleteMany({});

        console.log('Cleared existing database records.');

        // 1. App Settings
        await AppSettings.create({
            isSingleton: 'CONFIG',
            branding: {
                appName: 'Kwickly',
                logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
                iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100'
            },
            fees: { amount: 10, type: 'percent' },
            paymentMethods: { qrExpiry: 45, cashEnabled: true },
            wallet: { minimumBalance: 100, topupPresets: [100, 200, 500, 1000, 2000] },
            trialDurationDays: 90,
            radius: { maxKm: 25, rounds: [{ waitMinutes: 5, radiusKm: 5 }, { waitMinutes: 10, radiusKm: 25 }] },
            otp: { validityMinutes: 10, maxAttempts: 5, resendCooldownSeconds: 60 },
            maintenance: { mode: false, message: 'Platform active and running' },
            subscriptionPlans: [
                { id: 'monthly', label: 'Monthly Pro Plan', price: 299, durationDays: 30, features: ['Priority job leads', 'Reduced 5% commission', 'Gold Badge'], isActive: true },
                { id: 'annual', label: 'Annual Pro Plan', price: 2499, durationDays: 365, features: ['Unlimited job access', 'Zero commission', 'Platinum Badge'], isActive: true }
            ]
        });
        console.log('App settings seeded.');

        // 2. Admin User
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = await Customer.create({
            name: 'Super Admin',
            email: 'admin@kwickly.com',
            phone: '9999999999',
            password: adminPassword,
            role: 'ADMIN',
            isVerified: true
        });
        console.log('Admin account created (admin@kwickly.com / admin123)');

        // 3. Customers
        const customerPassword = await bcrypt.hash('customer123', 10);
        const customers = await Customer.create([
            {
                name: 'Aarav Sharma',
                email: 'aarav@gmail.com',
                phone: '9000000001',
                password: customerPassword,
                role: 'CUSTOMER',
                isVerified: true,
                wallet: { balance: 1500 },
                addresses: [{ label: 'Home', street: 'B-204, Rosewood Heights, Sector 62', city: 'Noida', area: 'Sector 62', pincode: '201301', location: { type: 'Point', coordinates: [77.3639, 28.6280] } }]
            },
            {
                name: 'Priya Patel',
                email: 'priya@gmail.com',
                phone: '9000000002',
                password: customerPassword,
                role: 'CUSTOMER',
                isVerified: true,
                wallet: { balance: 800 },
                addresses: [{ label: 'Office', street: 'Cyber City Tower B, DLF Phase 2', city: 'Gurugram', area: 'DLF Phase 2', pincode: '122002', location: { type: 'Point', coordinates: [77.0878, 28.4950] } }]
            }
        ]);
        console.log('Customers created.');

        // 4. Workers
        const workerPassword = await bcrypt.hash('worker123', 10);
        const workers = await Customer.create([
            {
                name: 'Rajesh Kumar (Electrician & AC)',
                email: 'rajesh@kwickly.com',
                phone: '9876543210',
                password: workerPassword,
                role: 'WORKER',
                isVerified: true,
                city: 'Delhi NCR',
                wallet: { balance: 1200 },
                kyc: { status: 'APPROVED', documents: [{ type: 'PAN', url: 'https://placehold.co/400x250/blue/white?text=PAN+Card' }] },
                services: [{ categoryName: 'Home Services', subcategories: ['AC Services', 'AC Repair', 'Wiring Repair', 'Switch Repair'], isActive: true }],
                rating: { average: 4.9, count: 42 },
                totalJobsCompleted: 42,
                isOnline: true,
                activeLocation: { type: 'Point', coordinates: [77.3650, 28.6290] }
            },
            {
                name: 'Vikram Singh (Plumber)',
                email: 'vikram@kwickly.com',
                phone: '9876543211',
                password: workerPassword,
                role: 'WORKER',
                isVerified: true,
                city: 'Delhi NCR',
                wallet: { balance: 650 },
                kyc: { status: 'APPROVED' },
                services: [{ categoryName: 'Home Services', subcategories: ['Tap Repair', 'Pipe Leakage', 'Drain Cleaning', 'Toilet Repair'], isActive: true }],
                rating: { average: 4.7, count: 28 },
                totalJobsCompleted: 28,
                isOnline: true,
                activeLocation: { type: 'Point', coordinates: [77.3610, 28.6250] }
            },
            {
                name: 'Anita Devi (Home Cleaning)',
                email: 'anita@kwickly.com',
                phone: '9876543212',
                password: workerPassword,
                role: 'WORKER',
                isVerified: true,
                city: 'Delhi NCR',
                wallet: { balance: 400 },
                kyc: { status: 'APPROVED' },
                services: [{ categoryName: 'Cleaning Services', subcategories: ['Full Home Cleaning', 'Kitchen Cleaning', 'Bathroom Cleaning'], isActive: true }],
                rating: { average: 4.8, count: 19 },
                totalJobsCompleted: 19,
                isOnline: false,
                activeLocation: { type: 'Point', coordinates: [77.3600, 28.6200] }
            }
        ]);
        console.log('Workers created.');

        // 5. Shop Owners & Shops
        const shopPassword = await bcrypt.hash('shop123', 10);
        const shopOwners = await Customer.create([
            {
                name: 'Suresh Gupta',
                email: 'suresh@kwicklymart.com',
                phone: '9111111111',
                password: shopPassword,
                role: 'SHOP',
                isVerified: true
            },
            {
                name: 'Ramesh Hardware Owner',
                email: 'ramesh@hardware.com',
                phone: '9222222222',
                password: shopPassword,
                role: 'SHOP',
                isVerified: true
            }
        ]);

        const shops = await Shop.create([
            {
                ownerId: shopOwners[0]._id,
                name: 'Kwickly Super Mart - Sector 62',
                description: 'Fresh groceries, dairy, beverages, and essential home supplies.',
                logoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=300',
                address: 'Shop 12, Commercial Complex, Sector 62, Noida',
                location: { type: 'Point', coordinates: [77.3645, 28.6285] },
                kyc: { status: 'APPROVED' },
                isOnline: true,
                deliveryFee: 30,
                minOrderAmount: 100,
                rating: 4.8,
                totalOrders: 156
            },
            {
                ownerId: shopOwners[1]._id,
                name: 'Ramesh Hardware & Electricals',
                description: 'Pipes, wires, switches, tools, fixtures, paints, and hardware supplies.',
                logoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300',
                address: 'Shop 4, Main Market, Sector 63, Noida',
                location: { type: 'Point', coordinates: [77.3710, 28.6310] },
                kyc: { status: 'APPROVED' },
                isOnline: true,
                deliveryFee: 50,
                minOrderAmount: 200,
                rating: 4.6,
                totalOrders: 89
            }
        ]);
        console.log('Shops created.');

        // 6. Products
        const products = await Product.create([
            // Grocery Shop Products
            { shopId: shops[0]._id, name: 'Amul Taaza T-Special Milk 1L', price: 68, category: 'Dairy', stock: 100, imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200' },
            { shopId: shops[0]._id, name: 'Fortune Sunlite Sunflower Oil 1L', price: 145, category: 'Grocery', stock: 45, imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200' },
            { shopId: shops[0]._id, name: 'Aashirvaad Shudh Chakki Atta 5kg', price: 235, category: 'Grocery', stock: 30, imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200' },
            { shopId: shops[0]._id, name: 'Tata Salt Vacuum Evaporated 1kg', price: 28, category: 'Grocery', stock: 150, imageUrl: 'https://images.unsplash.com/photo-1518110168401-f2820689b7b9?w=200' },
            // Hardware Shop Products
            { shopId: shops[1]._id, name: 'Havells 1.5 sq mm Copper Wire (90m)', price: 1450, category: 'Electrical', stock: 15, imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=200' },
            { shopId: shops[1]._id, name: 'Anchor Modular 6A Switch (Pack of 5)', price: 195, category: 'Electrical', stock: 40, imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200' },
            { shopId: shops[1]._id, name: 'Supreme PVC Pipe 1 inch (3m)', price: 180, category: 'Plumbing', stock: 60, imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200' }
        ]);
        console.log('Products created.');

        // 7. Categories & Subcategories
        await Category.create([
            {
                name: 'Home Services', icon: '🏠', color: '#2563EB', description: 'AC, appliance repair, electrical, plumbing services.', active: true,
                subcategories: [
                    { name: 'AC Services', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'AC Repair', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
                    { name: 'Wiring Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Tap Repair', minPrice: 199, platformFee: 40, suggestedMax: 600, active: true },
                    { name: 'Pipe Leakage', minPrice: 249, platformFee: 50, suggestedMax: 800, active: true }
                ]
            },
            {
                name: 'Cleaning Services', icon: '🧹', color: '#10B981', description: 'Full home, kitchen, and bathroom deep cleaning.', active: true,
                subcategories: [
                    { name: 'Full Home Cleaning', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Kitchen Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1000, active: true },
                    { name: 'Bathroom Cleaning', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true }
                ]
            }
        ]);
        console.log('Categories created.');

        // 8. Service Jobs & Quotes
        const job1 = await Job.create({
            customerId: customers[0]._id,
            category: 'Home Services',
            subcategory: 'AC Repair',
            description: 'AC cooling is low, noise coming from outdoor unit.',
            address: 'B-204, Rosewood Heights, Sector 62, Noida',
            location: { type: 'Point', coordinates: [77.3639, 28.6280] },
            status: 'COMPLETED',
            workerId: workers[0]._id,
            acceptedPrice: 750,
            completionOtp: '4321',
            arrivalOtp: '1234',
            payment: { amount: 750, platformFee: 75, workerPayout: 675, status: 'PAID' }
        });

        const job2 = await Job.create({
            customerId: customers[1]._id,
            category: 'Home Services',
            subcategory: 'Wiring Repair',
            description: 'Short circuit in main board, spark coming from breaker.',
            address: 'Cyber City Tower B, DLF Phase 2, Gurugram',
            location: { type: 'Point', coordinates: [77.0878, 28.4950] },
            status: 'IN_PROGRESS',
            workerId: workers[0]._id,
            acceptedPrice: 500,
            arrivalOtp: '9876',
            completionOtp: '6789',
            payment: { amount: 500, platformFee: 50, workerPayout: 450, status: 'PENDING' }
        });

        const job3 = await Job.create({
            customerId: customers[0]._id,
            category: 'Home Services',
            subcategory: 'Tap Repair',
            description: 'Kitchen sink tap leaking heavily continuously.',
            address: 'B-204, Rosewood Heights, Sector 62, Noida',
            location: { type: 'Point', coordinates: [77.3639, 28.6280] },
            status: 'BROADCASTING'
        });

        await Quote.create([
            {
                jobId: job3._id,
                workerId: workers[1]._id,
                amount: 350,
                note: 'I can arrive within 15 minutes with replacement washer and tools.',
                status: 'PENDING'
            }
        ]);
        console.log('Jobs & Quotes created.');

        // 9. Shop Orders
        await ShopOrder.create([
            {
                orderNumber: 'ORD-2026-1001',
                shopId: shops[0]._id,
                customerId: customers[0]._id,
                items: [
                    { productId: products[0]._id, name: products[0].name, price: products[0].price, qty: 2 },
                    { productId: products[1]._id, name: products[1].name, price: products[1].price, qty: 1 }
                ],
                subtotal: 281,
                deliveryFee: 30,
                total: 311,
                deliveryAddress: 'B-204, Rosewood Heights, Sector 62, Noida',
                status: 'DELIVERED',
                payment: { amount: 311, status: 'PAID' }
            },
            {
                orderNumber: 'ORD-2026-1002',
                shopId: shops[1]._id,
                customerId: customers[1]._id,
                items: [
                    { productId: products[5]._id, name: products[5].name, price: products[5].price, qty: 2 }
                ],
                subtotal: 390,
                deliveryFee: 50,
                total: 440,
                deliveryAddress: 'Cyber City Tower B, DLF Phase 2, Gurugram',
                status: 'NEW',
                payment: { amount: 440, status: 'PENDING' }
            }
        ]);
        console.log('Shop orders created.');

        // 10. Disputes & Payouts
        await Dispute.create({
            jobId: job1._id,
            customerId: customers[0]._id,
            reason: 'Slight extra charge question',
            issue: 'Extra fee inquiry',
            description: 'Worker suggested extra gas refilling fee, wanted clarification.',
            status: 'resolved',
            resolutionNotes: 'Customer satisfied after explanation from support.'
        });

        await Payout.create({
            workerId: workers[0]._id,
            amount: 1500,
            status: 'PENDING',
            paymentMethod: 'UPI',
            paymentDetails: 'rajesh@upi'
        });
        console.log('Disputes and Payouts created.');

        console.log('==================================================');
        console.log('SUCCESS! Rich Indian Marketplace Seed Data populated!');
        console.log('Admin Email: admin@kwickly.com | Password: admin123');
        console.log('Customer Phone: 9000000001 | Password: customer123');
        console.log('Worker Phone: 9876543210 | Password: worker123');
        console.log('Shop Phone: 9111111111 | Password: shop123');
        console.log('==================================================');

    } catch (err) {
        console.error('Error during rich seeding:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

seedRichData();
