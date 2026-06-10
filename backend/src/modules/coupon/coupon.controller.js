const Coupon = require('./coupon.model');
const asyncHandler = require('../../helpers/async.helper');
const { successResponse } = require('../../helpers/response.helper');

// Get all coupons (Admin)
exports.getAllCoupons = asyncHandler(async (req, res) => {
    const coupons = await Coupon.find().sort('-createdAt');
    successResponse(res, coupons);
});

// Validate coupon (Public/Mobile App)
exports.validateCoupon = asyncHandler(async (req, res) => {
    const { code, cartValue, role } = req.body;

    if (!code) {
        return res.status(400).json({ status: 'error', message: 'Coupon code is required' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
        return res.status(404).json({ status: 'error', message: 'Invalid coupon code' });
    }

    if (!coupon.isActive) {
        return res.status(400).json({ status: 'error', message: 'This coupon is no longer active' });
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
        return res.status(400).json({ status: 'error', message: 'This coupon is expired or not yet valid' });
    }

    if (coupon.targetAudience !== 'ALL' && coupon.targetAudience !== role) {
        return res.status(400).json({ status: 'error', message: 'This coupon is not valid for your account type' });
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
        return res.status(400).json({ status: 'error', message: 'Coupon usage limit reached' });
    }

    if (cartValue && cartValue < coupon.minOrderValue) {
        return res.status(400).json({ status: 'error', message: `Minimum order value of ${coupon.minOrderValue} required` });
    }

    // Calculate discount amount for preview
    let discountAmount = 0;
    if (cartValue) {
        if (coupon.discountType === 'FLAT') {
            discountAmount = coupon.discountValue;
        } else if (coupon.discountType === 'PERCENTAGE') {
            discountAmount = (cartValue * coupon.discountValue) / 100;
            if (coupon.maxDiscount) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscount);
            }
        }
    }

    successResponse(res, { coupon, discountAmount }, 'Coupon is valid');
});

// Create a new coupon
exports.createCoupon = asyncHandler(async (req, res) => {
    const coupon = await Coupon.create(req.body);
    successResponse(res, coupon, 'Coupon created successfully', 201);
});

// Update a coupon
exports.updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!coupon) {
        return res.status(404).json({ status: 'error', message: 'Coupon not found' });
    }

    successResponse(res, coupon, 'Coupon updated successfully');
});

// Delete a coupon
exports.deleteCoupon = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
        return res.status(404).json({ status: 'error', message: 'Coupon not found' });
    }

    successResponse(res, null, 'Coupon deleted successfully');
});

// Generate demo coupons
exports.generateDemoCoupons = asyncHandler(async (req, res) => {
    await Coupon.deleteMany({});

    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);

    const demoCoupons = [
        {
            code: 'WELCOME50',
            discountType: 'FLAT',
            discountValue: 50,
            minOrderValue: 200,
            targetAudience: 'CUSTOMER',
            startDate: now,
            endDate: nextMonth,
            usageLimit: 1000,
            isActive: true
        },
        {
            code: 'SUMMER20',
            discountType: 'PERCENTAGE',
            discountValue: 20,
            minOrderValue: 500,
            maxDiscount: 200,
            targetAudience: 'CUSTOMER',
            startDate: now,
            endDate: nextMonth,
            usageLimit: 500,
            isActive: true
        },
        {
            code: 'PROBONUS',
            discountType: 'FLAT',
            discountValue: 100,
            minOrderValue: 0,
            targetAudience: 'WORKER',
            startDate: now,
            endDate: nextMonth,
            usageLimit: 100,
            isActive: true
        }
    ];

    const createdCoupons = await Coupon.insertMany(demoCoupons);
    successResponse(res, createdCoupons, 'Demo coupons generated successfully', 201);
});
