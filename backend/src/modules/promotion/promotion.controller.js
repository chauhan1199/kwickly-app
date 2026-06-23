const { StatusCodes } = require('http-status-codes');
const { Banner, Promotion } = require('./promotion.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const { emitToAll } = require('../../helpers/socket.helper');

// ─── Public: mobile app fetches only active, in-range banners ────────────────
exports.getBanners = catchAsync(async (req, res) => {
    const { position } = req.query;
    const filter = { isActive: true };
    if (position) filter.position = position;
    filter.$or = [{ startAt: null }, { startAt: { $lte: new Date() } }];
    filter.$and = [{ $or: [{ endAt: null }, { endAt: { $gte: new Date() } }] }];
    const banners = await Banner.find(filter).sort({ priority: -1, createdAt: -1 });
    return successResponse(res, banners, 'Banners fetched');
});

// ─── Admin: all banners (including inactive) ──────────────────────────────────
exports.getAllBanners = catchAsync(async (req, res) => {
    const banners = await Banner.find({}).sort({ priority: -1 });
    return successResponse(res, banners, 'All banners');
});

// ─── Admin: create banner ─────────────────────────────────────────────────────
exports.createBanner = catchAsync(async (req, res) => {
    const banner = await Banner.create({ ...req.body, createdBy: req.user._id });
    logAdminActivity(
        'CREATE', 'BANNER', banner._id,
        'Banner Created',
        `Admin created banner "${banner.title}" for position ${banner.position}`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'BANNER_CREATED', id: banner._id });
    return successResponse(res, banner, 'Banner created', StatusCodes.CREATED);
});

// ─── Admin: update banner ─────────────────────────────────────────────────────
exports.updateBanner = catchAsync(async (req, res) => {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!banner) return errorResponse(res, 'Banner not found', StatusCodes.NOT_FOUND);
    logAdminActivity(
        'UPDATE', 'BANNER', banner._id,
        'Banner Updated',
        `Admin updated banner "${banner.title}" (position: ${banner.position}, active: ${banner.isActive})`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'BANNER_UPDATED', id: banner._id });
    return successResponse(res, banner, 'Banner updated');
});

// ─── Admin: delete banner ─────────────────────────────────────────────────────
exports.deleteBanner = catchAsync(async (req, res) => {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return errorResponse(res, 'Banner not found', StatusCodes.NOT_FOUND);
    logAdminActivity(
        'DELETE', 'BANNER', banner._id,
        'Banner Deleted',
        `Admin deleted banner "${banner.title}"`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'BANNER_DELETED', id: banner._id });
    return successResponse(res, null, 'Banner deleted');
});

// ─── Public: validate promo code at checkout ──────────────────────────────────
exports.validatePromoCode = catchAsync(async (req, res) => {
    const { code, orderAmount } = req.body;
    const promo = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) return errorResponse(res, 'Invalid promo code', StatusCodes.NOT_FOUND);
    if (promo.endAt && promo.endAt < new Date()) return errorResponse(res, 'Promo code expired', StatusCodes.BAD_REQUEST);
    if (promo.maxUsesTotal && promo.usesCount >= promo.maxUsesTotal) return errorResponse(res, 'Promo code usage limit reached', StatusCodes.BAD_REQUEST);
    if (orderAmount < promo.minOrderAmount) return errorResponse(res, `Minimum order ₹${promo.minOrderAmount} required`, StatusCodes.BAD_REQUEST);

    let discount = 0;
    if (promo.type === 'FLAT_DISCOUNT') {
        discount = promo.value;
    } else if (promo.type === 'PERCENTAGE_DISCOUNT') {
        discount = (orderAmount * promo.value) / 100;
        if (promo.maxDiscountCap) discount = Math.min(discount, promo.maxDiscountCap);
    }
    return successResponse(res, { code: promo.code, discount, type: promo.type, title: promo.title, description: promo.description }, 'Promo code valid');
});

// ─── Admin: list all promotions ───────────────────────────────────────────────
exports.getAllPromotions = catchAsync(async (req, res) => {
    const promos = await Promotion.find({}).sort({ createdAt: -1 });
    return successResponse(res, promos, 'All promotions');
});

// ─── Admin: create promotion ──────────────────────────────────────────────────
exports.createPromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.create({ ...req.body, createdBy: req.user._id });
    logAdminActivity(
        'CREATE', 'PROMO', promo._id,
        'Promo Code Created',
        `Admin created promo code "${promo.code}" — ${promo.title} (${promo.type}, value: ${promo.value})`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'PROMO_CREATED', id: promo._id });
    return successResponse(res, promo, 'Promotion created', StatusCodes.CREATED);
});

// ─── Admin: update promotion ──────────────────────────────────────────────────
exports.updatePromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promo) return errorResponse(res, 'Promotion not found', StatusCodes.NOT_FOUND);
    logAdminActivity(
        'UPDATE', 'PROMO', promo._id,
        'Promo Code Updated',
        `Admin updated promo code "${promo.code}" — active: ${promo.isActive}, value: ${promo.value}`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'PROMO_UPDATED', id: promo._id });
    return successResponse(res, promo, 'Promotion updated');
});

// ─── Admin: delete promotion ──────────────────────────────────────────────────
exports.deletePromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.findByIdAndDelete(req.params.id);
    if (!promo) return errorResponse(res, 'Promotion not found', StatusCodes.NOT_FOUND);
    logAdminActivity(
        'DELETE', 'PROMO', promo._id,
        'Promo Code Deleted',
        `Admin deleted promo code "${promo.code}" (was used ${promo.usesCount || 0} times)`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'PROMO_DELETED', id: promo._id });
    return successResponse(res, null, 'Promotion deleted');
});
