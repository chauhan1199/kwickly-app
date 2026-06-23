const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const BASE_URL = 'http://localhost:5000/api/v1';

async function seedPromotions() {
    console.log('🚀 Seeding All Example Banners & Promo Codes...\n');
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kwickly');
        const Customer = require('../src/modules/customer/customer.model');
        const admin = await Customer.findOne({ role: 'ADMIN' });
        if (!admin) throw new Error('Admin not found');
        const token = jwt.sign({ id: admin._id, role: admin.role, sessionId: 'seed' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const auth = { headers: { Authorization: `Bearer ${token}` } };

        // ─── BANNERS ─────────────────────────────────────────────────────────────
        console.log('🖼️  Creating Example Banners (All 4 Positions × All Link Types)...\n');

        const banners = [
            // HOME_TOP — No Link
            {
                title: 'Welcome to Kwickly!',
                subtitle: 'Your one-stop marketplace',
                imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=400&fit=crop',
                position: 'HOME_TOP', linkType: 'NONE', priority: 100, isActive: true
            },
            // HOME_TOP — External URL
            {
                title: 'Visit Our Blog',
                subtitle: 'Tips, deals and more',
                imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=400&fit=crop',
                position: 'HOME_TOP', linkType: 'EXTERNAL', linkValue: 'https://blog.kwickly.com', priority: 90, isActive: true
            },
            // HOME_MIDDLE — Shop Link
            {
                title: 'Top Rated Shops',
                subtitle: 'Handpicked for quality',
                imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=400&fit=crop',
                position: 'HOME_MIDDLE', linkType: 'NONE', priority: 80, isActive: true
            },
            // HOME_MIDDLE — Category Link
            {
                title: 'AC Service — Just ₹349',
                subtitle: 'Book in 60 seconds, expert at your door',
                imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=400&fit=crop',
                position: 'HOME_MIDDLE', linkType: 'CATEGORY', linkValue: 'AC Service', priority: 70, isActive: true
            },
            // SHOP_PAGE — No Link
            {
                title: 'Shop Local, Save Big',
                subtitle: 'Free delivery on orders above ₹500',
                imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop',
                position: 'SHOP_PAGE', linkType: 'NONE', priority: 60, isActive: true
            },
            // SHOP_PAGE — External URL
            {
                title: 'Become a Shop Partner',
                subtitle: 'Grow your business with Kwickly',
                imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745a872f?w=1200&h=400&fit=crop',
                position: 'SHOP_PAGE', linkType: 'EXTERNAL', linkValue: 'https://partner.kwickly.com', priority: 50, isActive: true
            },
            // CATEGORY_PAGE — Product Link
            {
                title: 'Best Sellers This Week',
                subtitle: 'Products customers love most',
                imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&h=400&fit=crop',
                position: 'CATEGORY_PAGE', linkType: 'NONE', priority: 40, isActive: true
            },
            // CATEGORY_PAGE — External
            {
                title: '🌧️ Monsoon Special Deals',
                subtitle: 'Stay comfy this season',
                imageUrl: 'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1200&h=400&fit=crop',
                position: 'CATEGORY_PAGE', linkType: 'EXTERNAL', linkValue: 'https://kwickly.com/monsoon', priority: 30, isActive: true
            },
        ];

        let bannerCount = 0;
        for (const b of banners) {
            try {
                const res = await axios.post(`${BASE_URL}/admin/promotions/banners`, b, auth);
                console.log(`  ✅ [${b.position}] "${b.title}" → Link: ${b.linkType}`);
                bannerCount++;
            } catch (e) {
                console.log(`  ⚠️  [${b.position}] "${b.title}" → ${e.response?.data?.message || e.message}`);
            }
        }
        console.log(`\n📊 ${bannerCount}/${banners.length} banners created.\n`);

        // ─── PROMO CODES ─────────────────────────────────────────────────────────
        console.log('🎁  Creating Example Promo Codes (All 5 Types)...\n');

        const ts = Date.now().toString().slice(-6);
        const promos = [
            // 1. FLAT DISCOUNT
            {
                code: `FLAT50${ts}`,
                title: 'Flat ₹50 Off',
                description: 'Get ₹50 off on any order above ₹300. One-time use per customer.',
                type: 'FLAT_DISCOUNT',
                value: 50,
                minOrderAmount: 300,
                maxUsesTotal: 500,
                maxUsesPerUser: 1,
                isActive: true
            },
            // 2. PERCENTAGE DISCOUNT
            {
                code: `SAVE20${ts}`,
                title: '20% Off Your Order',
                description: 'Save 20% on orders above ₹500. Max discount ₹150.',
                type: 'PERCENTAGE_DISCOUNT',
                value: 20,
                maxDiscountCap: 150,
                minOrderAmount: 500,
                maxUsesTotal: 1000,
                maxUsesPerUser: 2,
                isActive: true
            },
            // 3. FREE DELIVERY
            {
                code: `FREEDEL${ts}`,
                title: 'Free Delivery Today',
                description: 'Zero delivery charges on any order. No minimum order value!',
                type: 'FREE_DELIVERY',
                value: 1,
                minOrderAmount: 0,
                maxUsesTotal: 200,
                maxUsesPerUser: 1,
                isActive: true
            },
            // 4. FIRST ORDER
            {
                code: `WELCOME${ts}`,
                title: 'New User Special — ₹100 Off',
                description: 'Welcome gift for your very first order on Kwickly. Valid on orders above ₹400.',
                type: 'FIRST_ORDER',
                value: 100,
                minOrderAmount: 400,
                maxUsesTotal: 10000,
                maxUsesPerUser: 1,
                isActive: true
            },
            // 5. CASHBACK
            {
                code: `CASHBK${ts}`,
                title: '10% Cashback to Wallet',
                description: 'Earn 10% cashback (max ₹75) credited to your Kwickly wallet on orders above ₹600.',
                type: 'CASHBACK',
                value: 10,
                maxDiscountCap: 75,
                minOrderAmount: 600,
                maxUsesTotal: 300,
                maxUsesPerUser: 3,
                isActive: true
            }
        ];

        let promoCount = 0;
        for (const p of promos) {
            try {
                const res = await axios.post(`${BASE_URL}/admin/promotions/promotions`, p, auth);
                const typeIcons = { FLAT_DISCOUNT: '₹', PERCENTAGE_DISCOUNT: '%', FREE_DELIVERY: '🚚', FIRST_ORDER: '🎁', CASHBACK: '💰' };
                console.log(`  ✅ [${typeIcons[p.type]} ${p.type}] Code: ${p.code} — "${p.title}"`);
                promoCount++;
            } catch (e) {
                console.log(`  ⚠️  [${p.type}] Code: ${p.code} → ${e.response?.data?.message || e.message}`);
            }
        }
        console.log(`\n📊 ${promoCount}/${promos.length} promo codes created.`);
        console.log('\n🎉 All example data seeded! Refresh your dashboard to see everything.\n');
        console.log('📋 SUMMARY:');
        console.log('   Banners → HOME_TOP (2), HOME_MIDDLE (2), SHOP_PAGE (2), CATEGORY_PAGE (2)');
        console.log('   Link Types → NONE, EXTERNAL, CATEGORY used');
        console.log('   Promos → ₹ Flat, % Percentage, 🚚 Free Delivery, 🎁 First Order, 💰 Cashback\n');
    } catch (err) {
        console.error('\n❌ Seed failed:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    } finally {
        await mongoose.disconnect();
    }
}

seedPromotions();
