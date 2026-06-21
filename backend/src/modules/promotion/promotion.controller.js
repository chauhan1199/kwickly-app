const { StatusCodes } = require('http-status-codes');
const { Banner, Promotion } = require('./promotion.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

exports.getBanners = catchAsync(async (req, res) => {
    const { position } = req.query;
    const filter = { isActive: true };
    if (position) filter.position = position;
    filter.$or = [
        { startAt: null },
        { startAt: { $lte: new Date() } }
    ];
    filter.$and = [
        { $or: [{ endAt: null }, { endAt: { $gte: new Date() } }] }
    ];

    const banners = await Banner.find(filter).sort({ priority: -1, createdAt: -1 });
    return successResponse(res, banners, 'Banners fetched');
});

exports.createBanner = catchAsync(async (req, res) => {
    const banner = await Banner.create({ ...req.body, createdBy: req.user._id });
    return successResponse(res, banner, 'Banner created', StatusCodes.CREATED);
});

exports.updateBanner = catchAsync(async (req, res) => {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!banner) return errorResponse(res, 'Banner not found', StatusCodes.NOT_FOUND);
    return successResponse(res, banner, 'Banner updated');
});

exports.deleteBanner = catchAsync(async (req, res) => {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return errorResponse(res, 'Banner not found', StatusCodes.NOT_FOUND);
    return successResponse(res, null, 'Banner deleted');
});

exports.getAllBanners = catchAsync(async (req, res) => {
    const banners = await Banner.find({}).sort({ priority: -1 });
    return successResponse(res, banners, 'All banners');
});

exports.validatePromoCode = catchAsync(async (req, res) => {
    const { code, orderAmount } = req.body;
    const promo = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) return errorResponse(res, 'Invalid promo code', StatusCodes.NOT_FOUND);

    if (promo.endAt && promo.endAt < new Date()) {
        return errorResponse(res, 'Promo code expired', StatusCodes.BAD_REQUEST);
    }
    if (promo.maxUsesTotal && promo.usesCount >= promo.maxUsesTotal) {
        return errorResponse(res, 'Promo code usage limit reached', StatusCodes.BAD_REQUEST);
    }
    if (orderAmount < promo.minOrderAmount) {
        return errorResponse(res, `Minimum order ₹${promo.minOrderAmount} required`, StatusCodes.BAD_REQUEST);
    }

    let discount = 0;
    if (promo.type === 'FLAT_DISCOUNT') {
        discount = promo.value;
    } else if (promo.type === 'PERCENTAGE_DISCOUNT') {
        discount = (orderAmount * promo.value) / 100;
        if (promo.maxDiscountCap) discount = Math.min(discount, promo.maxDiscountCap);
    }

    return successResponse(res, { code: promo.code, discount, type: promo.type, title: promo.title, description: promo.description }, 'Promo code valid');
});

exports.createPromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.create({ ...req.body, createdBy: req.user._id });
    return successResponse(res, promo, 'Promotion created', StatusCodes.CREATED);
});

exports.updatePromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promo) return errorResponse(res, 'Promotion not found', StatusCodes.NOT_FOUND);
    return successResponse(res, promo, 'Promotion updated');
});

exports.deletePromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.findByIdAndDelete(req.params.id);
    if (!promo) return errorResponse(res, 'Promotion not found', StatusCodes.NOT_FOUND);
    return successResponse(res, null, 'Promotion deleted');
});

exports.getAllPromotions = catchAsync(async (req, res) => {
    const promos = await Promotion.find({}).sort({ createdAt: -1 });
    return successResponse(res, promos, 'All promotions');
});
