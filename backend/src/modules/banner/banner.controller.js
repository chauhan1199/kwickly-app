const Banner = require('./banner.model');
const asyncHandler = require('../../helpers/async.helper');
const { successResponse } = require('../../helpers/response.helper');

// Get all banners (Admin)
exports.getAllBanners = asyncHandler(async (req, res) => {
    const banners = await Banner.find().sort('-createdAt');
    successResponse(res, banners);
});

// Get active banners based on target audience (Public/Mobile App)
exports.getActiveBanners = asyncHandler(async (req, res) => {
    const { role } = req.query; // CUSTOMER, WORKER, SHOP, or blank for ALL
    const now = new Date();

    const query = {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    };

    if (role) {
        query.targetAudience = { $in: [role, 'ALL'] };
    }

    const banners = await Banner.find(query).sort('-createdAt');
    successResponse(res, banners);
});

// Create a new banner
exports.createBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.create(req.body);
    successResponse(res, banner, 'Banner created successfully', 201);
});

// Update a banner
exports.updateBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!banner) {
        return res.status(404).json({ status: 'error', message: 'Banner not found' });
    }

    successResponse(res, banner, 'Banner updated successfully');
});

// Delete a banner
exports.deleteBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
        return res.status(404).json({ status: 'error', message: 'Banner not found' });
    }

    successResponse(res, null, 'Banner deleted successfully');
});

// Generate demo data
exports.generateDemoBanners = asyncHandler(async (req, res) => {
    await Banner.deleteMany({}); // Clear existing banners before generating

    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);

    const demoBanners = [
        {
            title: "Summer Sale - 20% Off AC Services",
            imageUrl: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&q=80",
            targetAudience: "CUSTOMER",
            startDate: now,
            endDate: nextMonth,
            isActive: true,
            link: "/category/ac-repair"
        },
        {
            title: "Join as a Pro - Rs. 500 Bonus",
            imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
            targetAudience: "WORKER",
            startDate: now,
            endDate: nextMonth,
            isActive: true,
            link: "/worker-onboarding"
        },
        {
            title: "Boost Your Shop Visibility",
            imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
            targetAudience: "SHOP",
            startDate: now,
            endDate: nextMonth,
            isActive: true,
            link: "/shop-promotions"
        },
         {
            title: "Diwali Special Offer - Free Cleaning Kit",
            imageUrl: "https://images.unsplash.com/photo-1585933646706-7977baebc208?w=800&q=80",
            targetAudience: "ALL",
            startDate: now,
            endDate: nextMonth,
            isActive: true,
            link: "/offers"
        }
    ];

    const createdBanners = await Banner.insertMany(demoBanners);
    successResponse(res, createdBanners, 'Demo banners generated successfully', 201);
});