const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Customer = require('../modules/customer/customer.model');
const Category = require('../modules/category/category.model');
const Job = require('../modules/job/job.model');
const Payout = require('../modules/payout/payout.model');
const Notification = require('../modules/notification/notification.model');
const AppSettings = require('../modules/settings/settings.model');
const Dispute = require('../modules/dispute/dispute.model');
const Suggestion = require('../modules/suggestion/suggestion.model');
const Transaction = require('../modules/transaction/transaction.model');
const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const ShopOrder = require('../modules/shoporder/shoporder.model');
const logger = require('./logger.helper');
const { delCache } = require('./redis.helper');

const seedData = async () => {
    try {
        const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@kwickly.com';
        const existingAdmin = await Customer.findOne({ email: adminEmail });
        
        if (existingAdmin) {
            logger.info('Database already seeded. Skipping master seed process to prevent data loss.');
            return;
        }

        logger.info('Starting master seeding process (Schema Aligned)...');

        // 1. Seed Admin
        const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        
        await Customer.deleteMany({ role: 'ADMIN' });
        await Customer.create({
            name: 'Super Admin',
            email: adminEmail,
            password: hashedPassword,
            phone: '0000000000',
            role: 'ADMIN',
            isVerified: true
        });
        logger.info('Admin user created.');

        // 2. Seed Settings
        await AppSettings.deleteMany({});
        await AppSettings.create({
            isSingleton: 'CONFIG',
            branding: {
              appName: 'Kwickly',
              logoUrl: 'http://localhost:5000/uploads/logowithtext.jpeg',
              iconUrl: 'http://localhost:5000/uploads/logo.jpeg'
            },
            fees: { amount: 12, type: 'percent' },
            paymentMethods: { qrExpiry: 45, cashEnabled: true },
            wallet: { minimumBalance: 200, topupPresets: [100, 200, 500, 1000] },
            trialDurationDays: 90,
            radius: { 
                maxKm: 15,
                rounds: [
                    { waitMinutes: 5, radiusKm: 5 },
                    { waitMinutes: 10, radiusKm: 15 }
                ]
            },
            otp: { validityMinutes: 10, maxAttempts: 5, resendCooldownSeconds: 60 },
            maintenance: { mode: false, message: 'Platform under maintenance' },
            subscriptionPlans: [
                { id: 'monthly', name: 'Monthly Pro', price: 499, interval: 'month', features: ['Priority support', 'Reduced commission', 'Featured tag'], active: true },
                { id: 'semi', name: 'Half-Yearly Pro', price: 2499, interval: 'month', features: ['Priority support', 'Reduced commission', 'Featured tag'], active: true },
                { id: 'annual', name: 'Annual Pro', price: 4499, interval: 'month', features: ['Priority support', 'Reduced commission', 'Featured tag'], active: true }
            ]
        });
        logger.info('App settings initialized.');

        // Cities feature has been removed from this layer

        // 4. Seed Categories
        const categories = [
            {
                name: 'Plumbing', icon: '🔧', color: '#2563EB', description: 'All water-related repairs.', active: true,
                subcategories: [
                    { name: 'Pipe Leak Repair', minPrice: 249, platformFee: 50, suggestedMax: 800, active: true },
                    { name: 'Tap Replacement', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true }
                ]
            },
            {
                name: 'Electrical', icon: '⚡', color: '#F97316', description: 'Electrical repairs and installations.', active: true,
                subcategories: [
                    { name: 'Wiring & Rewiring', minPrice: 499, platformFee: 100, suggestedMax: 5000, active: true },
                    { name: 'Switch Repair', minPrice: 99, platformFee: 20, suggestedMax: 300, active: true }
                ]
            },
            {
                name: 'AC Service', icon: '❄️', color: '#0EA5E9', description: 'AC servicing and gas refilling.', active: true,
                subcategories: [
                    { name: 'AC Deep Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
                    { name: 'Gas Refilling', minPrice: 1200, platformFee: 250, suggestedMax: 3500, active: true }
                ]
            }
        ];
        await Category.deleteMany({});
        await Category.create(categories);
        logger.info('Categories seeded.');

        // Banners and Coupons features have been removed from this layer

        // 7. Seed Sample Workers
        const workerPwd = await bcrypt.hash('worker123', 12);
        const workers = [
            { 
              name: 'Amit Kumar', phone: '9876543210', role: 'WORKER', isVerified: true, password: workerPwd, 
              city: 'Mumbai', wallet: { balance: 500 }, kyc: { status: 'APPROVED', documents: [{ type: 'PAN', url: 'https://placehold.co/400x250/blue/white?text=PAN+Card'}, { type: 'OTHER', url: 'https://placehold.co/400x250/purple/white?text=Selfie' }] }, plan: 'pro',
              profileImage: 'https://i.pravatar.cc/150?img=11'
            },
            { 
              name: 'Rajan Verma', phone: '9876543211', role: 'WORKER', isVerified: true, password: workerPwd, 
              city: 'Delhi', wallet: { balance: 250 }, kyc: { status: 'PENDING', documents: [{ type: 'AADHAR', url: 'https://placehold.co/600x400/orange/white?text=Aadhar+Front'}, { type: 'AADHAR', url: 'https://placehold.co/600x400/orange/white?text=Aadhar+Back' }] }, plan: 'free',
              profileImage: 'https://i.pravatar.cc/150?img=12'
            },
            { 
              name: 'Vikram Singh', phone: '9876543212', role: 'WORKER', isVerified: false, password: workerPwd, 
              city: 'Bangalore', wallet: { balance: 0 }, kyc: { status: 'PENDING', documents: [{ type: 'AADHAR', url: 'https://placehold.co/600x400/purple/white?text=Aadhar+Front' }] }, plan: 'free',
              profileImage: 'https://i.pravatar.cc/150?img=13'
            }
        ];
        await Customer.deleteMany({ role: 'WORKER' });
        const createdWorkers = await Customer.create(workers);
        logger.info('Sample workers created.');

        // 8. Seed Sample Customers
        const customerPwd = await bcrypt.hash('customer123', 12);
        const customers = [
            { name: 'Rahul Sharma', phone: '9000000001', role: 'CUSTOMER', isVerified: true, password: customerPwd }
        ];
        await Customer.deleteMany({ role: 'CUSTOMER' });
        const createdCustomers = await Customer.create(customers);
        logger.info('Sample customers created.');

        // 9. Seed Sample Jobs
        const jobs = [
            {
                customerId: createdCustomers[0]._id,
                workerId: createdWorkers[0]._id,
                category: 'Plumbing',
                description: 'Kitchen sink tap leaking',
                status: 'COMPLETED',
                location: { type: 'Point', coordinates: [72.8777, 19.0760] },
                payment: { amount: 450, platformFee: 50, workerPayout: 400, status: 'PAID' }
            },
            {
                customerId: createdCustomers[0]._id,
                workerId: createdWorkers[1]._id,
                category: 'Electrical',
                description: 'Short circuit in living room',
                status: 'IN_PROGRESS',
                location: { type: 'Point', coordinates: [77.1025, 28.7041] },
                payment: { amount: 650, platformFee: 50, workerPayout: 600, status: 'PENDING' }
            }
        ];
        await Job.deleteMany({});
        const createdJobs = await Job.create(jobs);
        logger.info('Sample jobs created.');

        // Reviews feature has been removed from this layer

        // 11. Seed Transactions (Platform Ledger)
        const transactions = [
            { 
              workerId: createdWorkers[0]._id, type: 'earning', jobId: createdJobs[0]._id, 
              amount: 400, description: 'Earnings for Job #' + createdJobs[0]._id.toString().slice(-6) 
            },
            { 
              workerId: createdWorkers[0]._id, type: 'subscription', 
              amount: -499, description: 'Pro Expert monthly subscription fee' 
            }
        ];
        await Transaction.deleteMany({});
        await Transaction.create(transactions);
        logger.info('Platform transactions seeded.');

        // Support Tickets feature has been removed from this layer

        // 13. Seed Worker Suggestions
        const suggestions = [
            {
                workerId: createdWorkers[1]._id, workerName: 'Rajan Verma', workerCity: 'Delhi',
                type: 'new_category', status: 'pending',
                payload: {
                    name: 'Gardening',
                    description: 'Professional lawn mowing and plant care.',
                    icon: '🌿',
                    suggestedSubcategories: ['Lawn Mowing', 'Plant Pruning']
                }
            }
        ];
        await Suggestion.deleteMany({});
        await Suggestion.create(suggestions);
        logger.info('Worker suggestions seeded.');

        // 14. Seed Disputes
        const disputes = [
            {
                jobId: createdJobs[0]._id, customerId: createdCustomers[0]._id,
                issue: 'Work not completed as promised',
                description: 'The tap is still leaking after repair.', status: 'open'
            }
        ];
        await Dispute.deleteMany({});
        await Dispute.create(disputes);
        logger.info('Disputes seeded.');

        // 15. Seed Payouts
        const payouts = [
            {
                workerId: createdWorkers[0]._id, amount: 1000, status: 'PENDING',
                paymentMethod: 'UPI', paymentDetails: 'amit@upi'
            }
        ];
        await Payout.deleteMany({});
        await Payout.create(payouts);
        logger.info('Payout requests seeded.');

        // 15.5 Seed Shops, Products, and ShopOrders
        await Shop.deleteMany({});
        await Product.deleteMany({});
        await ShopOrder.deleteMany({});
        
        const shopOwnerPwd = await bcrypt.hash('shop123', 12);
        const shopOwners = [
            { name: 'Kwickly Mart Owner', phone: '9000000002', role: 'SHOP', isVerified: true, password: shopOwnerPwd }
        ];
        await Customer.deleteMany({ role: 'SHOP' });
        const createdShopOwners = await Customer.create(shopOwners);

        const shops = [
            {
                ownerId: createdShopOwners[0]._id,
                name: 'Kwickly Mart Sector 12',
                description: 'Your neighborhood daily needs store',
                logoUrl: 'https://placehold.co/150x150/green/white?text=Kwickly+Mart',
                address: 'Sector 12, Noida',
                location: { type: 'Point', coordinates: [77.3178, 28.5800] },
                kyc: { status: 'APPROVED' },
                isOnline: true,
                rating: 4.8,
                totalOrders: 15
            }
        ];
        const createdShops = await Shop.create(shops);
        
        const products = [
            { shopId: createdShops[0]._id, name: 'Amul Milk 1L', price: 68, stock: 50, imageUrl: '🥛' },
            { shopId: createdShops[0]._id, name: 'Fortune Oil 1L', price: 149, stock: 20, imageUrl: '🫙' },
            { shopId: createdShops[0]._id, name: 'Parle-G 250g', price: 20, stock: 100, imageUrl: '🍪' }
        ];
        const createdProducts = await Product.create(products);

        const shopOrders = [
            {
                shopId: createdShops[0]._id,
                customerId: createdCustomers[0]._id,
                items: [
                    { productId: createdProducts[0]._id, name: 'Amul Milk 1L', price: 68, qty: 2, imageUrl: '🥛' }
                ],
                subtotal: 136,
                deliveryFee: 40,
                total: 176,
                deliveryAddress: 'A-14, Sector 12, Noida',
                status: 'NEW',
                payment: { amount: 176, status: 'PENDING' }
            }
        ];
        await ShopOrder.create(shopOrders);
        logger.info('Shops, Products, and ShopOrders seeded.');

        // 16. Clear Redis Cache to prevent stale ObjectIds from haunting the frontend
        const { getRedis } = require('./redis.helper');
        const redisClient = getRedis();
        if (redisClient) {
            await redisClient.flushall();
            logger.info('Redis cache flushed globally.');
        }

        logger.info('Master seeding completed successfully (v2 Alignment).');
    } catch (error) {
        logger.error('Error during master seeding: ' + error.message);
    }
};

module.exports = seedData;
