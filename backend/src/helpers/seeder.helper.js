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
                { id: 'monthly', label: 'Monthly Pro', price: 499, durationDays: 30, features: ['Priority support', 'Reduced commission', 'Featured tag'], isActive: true },
                { id: 'semi', label: 'Half-Yearly Pro', price: 2499, durationDays: 180, features: ['Priority support', 'Reduced commission', 'Featured tag'], isActive: true },
                { id: 'annual', label: 'Annual Pro', price: 4499, durationDays: 365, features: ['Priority support', 'Reduced commission', 'Featured tag'], isActive: true }
            ]
        });
        logger.info('App settings initialized.');

        // Cities feature has been removed from this layer

        // 4. Seed Categories
        const categories = [
            {
                name: 'Home Services', icon: '🏠', color: '#2563EB', description: 'AC, appliance repair, electrical, plumbing services.', active: true,
                subcategories: [
                    { name: 'AC Services', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'AC Installation', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'AC Repair', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
                    { name: 'AC Gas Refilling', minPrice: 1200, platformFee: 250, suggestedMax: 3500, active: true },
                    { name: 'AC Deep Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
                    { name: 'Refrigerator Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Washing Machine Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Microwave Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'TV Repair', minPrice: 499, platformFee: 100, suggestedMax: 3000, active: true },
                    { name: 'Geyser Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Water Purifier Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Fan Installation', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Light Installation', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
                    { name: 'Switch Repair', minPrice: 99, platformFee: 20, suggestedMax: 300, active: true },
                    { name: 'Wiring Repair', minPrice: 499, platformFee: 100, suggestedMax: 3000, active: true },
                    { name: 'Inverter Installation', minPrice: 799, platformFee: 160, suggestedMax: 2500, active: true },
                    { name: 'Tap Repair', minPrice: 199, platformFee: 40, suggestedMax: 600, active: true },
                    { name: 'Pipe Leakage', minPrice: 249, platformFee: 50, suggestedMax: 800, active: true },
                    { name: 'Drain Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Toilet Repair', minPrice: 299, platformFee: 60, suggestedMax: 1000, active: true },
                    { name: 'Water Tank Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
                    { name: 'Motor Installation', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Bathroom Fittings', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                ]
            },
            {
                name: 'Cleaning Services', icon: '🧹', color: '#10B981', description: 'Home, deep, sofa, commercial cleaning services.', active: true,
                subcategories: [
                    { name: 'Full Home Cleaning', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Kitchen Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1000, active: true },
                    { name: 'Bathroom Cleaning', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Deep Cleaning', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'Sofa Cleaning', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Carpet Cleaning', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
                    { name: 'Mattress Cleaning', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Curtain Cleaning', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Office Cleaning', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
                    { name: 'Shop Cleaning', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Restaurant Cleaning', minPrice: 2499, platformFee: 500, suggestedMax: 10000, active: true },
                ]
            },
            {
                name: 'Painting Services', icon: '🎨', color: '#8B5CF6', description: 'Interior, exterior, texture painting services.', active: true,
                subcategories: [
                    { name: 'Room Painting', minPrice: 1999, platformFee: 400, suggestedMax: 5000, active: true },
                    { name: 'Full House Painting', minPrice: 9999, platformFee: 2000, suggestedMax: 30000, active: true },
                    { name: 'Texture Painting', minPrice: 3999, platformFee: 800, suggestedMax: 10000, active: true },
                    { name: 'Exterior Painting', minPrice: 4999, platformFee: 1000, suggestedMax: 15000, active: true },
                    { name: 'Waterproof Painting', minPrice: 2999, platformFee: 600, suggestedMax: 8000, active: true },
                ]
            },
            {
                name: 'Carpentry Services', icon: '🪚', color: '#D97706', description: 'Furniture repair, woodwork, modular services.', active: true,
                subcategories: [
                    { name: 'Furniture Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Furniture Assembly', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Custom Furniture', minPrice: 4999, platformFee: 1000, suggestedMax: 20000, active: true },
                    { name: 'Door Repair', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Window Repair', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Cabinet Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Modular Furniture', minPrice: 4999, platformFee: 1000, suggestedMax: 25000, active: true },
                ]
            },
            {
                name: 'Pest Control', icon: '🐛', color: '#EF4444', description: 'Residential and commercial pest control.', active: true,
                subcategories: [
                    { name: 'Cockroach Control', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Termite Control', minPrice: 1999, platformFee: 400, suggestedMax: 5000, active: true },
                    { name: 'Bed Bug Treatment', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Mosquito Control', minPrice: 599, platformFee: 120, suggestedMax: 1500, active: true },
                    { name: 'Rodent Control', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Office Pest Control', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'Restaurant Pest Control', minPrice: 2499, platformFee: 500, suggestedMax: 8000, active: true },
                ]
            },
            {
                name: 'Home Renovation', icon: '🏗️', color: '#6366F1', description: 'Civil work, tiles, flooring, interior design.', active: true,
                subcategories: [
                    { name: 'Tiles Installation', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
                    { name: 'Flooring', minPrice: 2999, platformFee: 600, suggestedMax: 15000, active: true },
                    { name: 'Mason Work', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'False Ceiling', minPrice: 3999, platformFee: 800, suggestedMax: 12000, active: true },
                    { name: 'Modular Kitchen', minPrice: 19999, platformFee: 4000, suggestedMax: 50000, active: true },
                    { name: 'Wardrobe Design', minPrice: 9999, platformFee: 2000, suggestedMax: 30000, active: true },
                    { name: 'Home Interior', minPrice: 14999, platformFee: 3000, suggestedMax: 50000, active: true },
                ]
            },
            {
                name: 'Security Services', icon: '🔒', color: '#1E293B', description: 'CCTV, access control, fire safety services.', active: true,
                subcategories: [
                    { name: 'CCTV Installation', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
                    { name: 'CCTV Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Access Control', minPrice: 3999, platformFee: 800, suggestedMax: 15000, active: true },
                    { name: 'Fire Alarm Installation', minPrice: 2499, platformFee: 500, suggestedMax: 8000, active: true },
                    { name: 'Fire Safety Inspection', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                ]
            },
            {
                name: 'Gardening Services', icon: '🌿', color: '#059669', description: 'Lawn care, tree trimming, landscaping.', active: true,
                subcategories: [
                    { name: 'Lawn Mowing', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Tree Trimming', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Plant Maintenance', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
                    { name: 'Landscaping', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
                    { name: 'Garden Design', minPrice: 4999, platformFee: 1000, suggestedMax: 20000, active: true },
                    { name: 'Vertical Garden', minPrice: 3999, platformFee: 800, suggestedMax: 12000, active: true },
                ]
            },
            {
                name: 'Moving & Shifting', icon: '📦', color: '#0EA5E9', description: 'House shifting, packers and movers.', active: true,
                subcategories: [
                    { name: 'Local Shifting', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
                    { name: 'Intercity Shifting', minPrice: 7999, platformFee: 1600, suggestedMax: 30000, active: true },
                    { name: 'Packing Service', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Loading Service', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
                    { name: 'Unloading Service', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
                ]
            },
            {
                name: 'Beauty & Salon', icon: '💇', color: '#EC4899', description: 'At-home salon for women and men.', active: true,
                subcategories: [
                    { name: 'Women Haircut', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Hair Spa', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Hair Coloring', minPrice: 799, platformFee: 160, suggestedMax: 3000, active: true },
                    { name: 'Facial', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Waxing', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Manicure', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Pedicure', minPrice: 349, platformFee: 70, suggestedMax: 1000, active: true },
                    { name: 'Makeup', minPrice: 999, platformFee: 200, suggestedMax: 5000, active: true },
                    { name: 'Men Haircut', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
                    { name: 'Beard Styling', minPrice: 149, platformFee: 30, suggestedMax: 400, active: true },
                ]
            },
            {
                name: 'Spa & Wellness', icon: '💆', color: '#A78BFA', description: 'Massage, yoga, meditation trainers.', active: true,
                subcategories: [
                    { name: 'Full Body Massage', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Head Massage', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Foot Massage', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Yoga Trainer', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Meditation Trainer', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                ]
            },
            {
                name: 'Fitness Services', icon: '💪', color: '#F97316', description: 'Personal training, sports coaching.', active: true,
                subcategories: [
                    { name: 'Gym Trainer', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Weight Loss Trainer', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
                    { name: 'Strength Training', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Cricket Coach', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
                    { name: 'Football Coach', minPrice: 599, platformFee: 120, suggestedMax: 2500, active: true },
                    { name: 'Swimming Coach', minPrice: 699, platformFee: 140, suggestedMax: 3000, active: true },
                ]
            },
            {
                name: 'Tutoring & Education', icon: '📚', color: '#3B82F6', description: 'Home tutor, music, dance, language teachers.', active: true,
                subcategories: [
                    { name: 'Home Tutor', minPrice: 299, platformFee: 60, suggestedMax: 1000, active: true },
                    { name: 'Online Tutor', minPrice: 199, platformFee: 40, suggestedMax: 800, active: true },
                    { name: 'Music Teacher', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Dance Teacher', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Language Teacher', minPrice: 349, platformFee: 70, suggestedMax: 1200, active: true },
                ]
            },
            {
                name: 'Event Services', icon: '📸', color: '#F43F5E', description: 'Photography, decoration, DJ, entertainment.', active: true,
                subcategories: [
                    { name: 'Wedding Photography', minPrice: 4999, platformFee: 1000, suggestedMax: 20000, active: true },
                    { name: 'Event Photography', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
                    { name: 'Product Photography', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Birthday Decoration', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Wedding Decoration', minPrice: 4999, platformFee: 1000, suggestedMax: 25000, active: true },
                    { name: 'DJ Service', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
                    { name: 'Anchor Service', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'Live Singer', minPrice: 2499, platformFee: 500, suggestedMax: 10000, active: true },
                ]
            },
            {
                name: 'Vehicle Services', icon: '🚗', color: '#0D9488', description: 'Car wash, car repair, bike services.', active: true,
                subcategories: [
                    { name: 'Car Wash', minPrice: 399, platformFee: 80, suggestedMax: 1000, active: true },
                    { name: 'Car Repair', minPrice: 999, platformFee: 200, suggestedMax: 5000, active: true },
                    { name: 'Car Detailing', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'Bike Wash', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
                    { name: 'Bike Repair', minPrice: 299, platformFee: 60, suggestedMax: 1500, active: true },
                ]
            },
            {
                name: 'Digital Services', icon: '💻', color: '#7C3AED', description: 'IT support, web/app development, digital marketing.', active: true,
                subcategories: [
                    { name: 'Computer Repair', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'Laptop Repair', minPrice: 599, platformFee: 120, suggestedMax: 3000, active: true },
                    { name: 'Printer Repair', minPrice: 399, platformFee: 80, suggestedMax: 1500, active: true },
                    { name: 'Website Development', minPrice: 4999, platformFee: 1000, suggestedMax: 25000, active: true },
                    { name: 'Mobile App Development', minPrice: 9999, platformFee: 2000, suggestedMax: 50000, active: true },
                    { name: 'SEO Service', minPrice: 2999, platformFee: 600, suggestedMax: 10000, active: true },
                    { name: 'Digital Marketing', minPrice: 3999, platformFee: 800, suggestedMax: 15000, active: true },
                ]
            },
            {
                name: 'Professional Services', icon: '👔', color: '#334155', description: 'Legal, CA, tax filing, insurance advisory.', active: true,
                subcategories: [
                    { name: 'Legal Consultation', minPrice: 999, platformFee: 200, suggestedMax: 5000, active: true },
                    { name: 'Document Verification', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                    { name: 'CA Service', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'Tax Filing', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'GST Filing', minPrice: 1499, platformFee: 300, suggestedMax: 5000, active: true },
                    { name: 'Insurance Advisor', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                ]
            },
            {
                name: 'Domestic Help', icon: '👨‍👩‍👧', color: '#B45309', description: 'Maid, cook, babysitter, elder care, driver.', active: true,
                subcategories: [
                    { name: 'Maid', minPrice: 299, platformFee: 60, suggestedMax: 800, active: true },
                    { name: 'Cook', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                    { name: 'Babysitter', minPrice: 349, platformFee: 70, suggestedMax: 1000, active: true },
                    { name: 'Elder Care', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Personal Driver', minPrice: 599, platformFee: 120, suggestedMax: 2000, active: true },
                    { name: 'Temporary Driver', minPrice: 399, platformFee: 80, suggestedMax: 1200, active: true },
                ]
            },
            {
                name: 'Pet Services', icon: '🐾', color: '#C2410C', description: 'Pet grooming, walking, training, vet visits.', active: true,
                subcategories: [
                    { name: 'Pet Grooming', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Pet Walking', minPrice: 199, platformFee: 40, suggestedMax: 500, active: true },
                    { name: 'Pet Training', minPrice: 699, platformFee: 140, suggestedMax: 2500, active: true },
                    { name: 'Vet Visit', minPrice: 799, platformFee: 160, suggestedMax: 3000, active: true },
                    { name: 'Vaccination', minPrice: 499, platformFee: 100, suggestedMax: 2000, active: true },
                ]
            },
            {
                name: 'Healthcare at Home', icon: '🏥', color: '#DC2626', description: 'Nursing, physiotherapist, lab test, doctor visit.', active: true,
                subcategories: [
                    { name: 'Home Nurse', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Caregiver', minPrice: 799, platformFee: 160, suggestedMax: 2500, active: true },
                    { name: 'Physiotherapist', minPrice: 699, platformFee: 140, suggestedMax: 2500, active: true },
                    { name: 'Lab Test', minPrice: 399, platformFee: 80, suggestedMax: 2000, active: true },
                    { name: 'Doctor Visit', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                ]
            },
            {
                name: 'Laundry Services', icon: '👕', color: '#2563EB', description: 'Wash & fold, dry cleaning, ironing.', active: true,
                subcategories: [
                    { name: 'Wash & Fold', minPrice: 99, platformFee: 20, suggestedMax: 300, active: true },
                    { name: 'Dry Cleaning', minPrice: 199, platformFee: 40, suggestedMax: 600, active: true },
                    { name: 'Clothes Ironing', minPrice: 49, platformFee: 10, suggestedMax: 200, active: true },
                ]
            },
            {
                name: 'Real Estate Services', icon: '🏢', color: '#475569', description: 'Property inspection, tenant verification.', active: true,
                subcategories: [
                    { name: 'Property Inspection', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                    { name: 'Property Management', minPrice: 1999, platformFee: 400, suggestedMax: 8000, active: true },
                    { name: 'Tenant Verification', minPrice: 499, platformFee: 100, suggestedMax: 1500, active: true },
                    { name: 'Rental Assistance', minPrice: 999, platformFee: 200, suggestedMax: 3000, active: true },
                ]
            }
        ];
        await Category.deleteMany({});
        await Category.create(categories);
        logger.info('Categories seeded: ' + categories.length + ' categories with ' + categories.reduce((sum, c) => sum + c.subcategories.length, 0) + ' subcategories.');

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


        // Support Tickets feature has been removed from this layer

        // 13. Seed Worker Suggestions
        const gardeningCat = await Category.findOne({ name: 'Gardening Services' });
        const suggestions = [
            {
                workerId: createdWorkers[1]._id, workerName: 'Rajan Verma', workerCity: 'Delhi',
                type: 'new_subcategory', status: 'PENDING',
                payload: {
                    parentCategory: 'Gardening Services',
                    parentCategoryId: gardeningCat?._id,
                    name: 'Plant Pruning',
                    description: 'Professional plant pruning and trimming services.'
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
