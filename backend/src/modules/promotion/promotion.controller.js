const { StatusCodes } = require('http-status-codes');
const { Banner, Promotion, UserPromoUsage } = require('./promotion.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const { getCache, setCache, delCacheByPattern } = require('../../helpers/redis.helper');

// ─── Public: mobile app fetches only active, in-range banners ────────────────
exports.getBanners = catchAsync(async (req, res) => {
    const { position } = req.query;
    const cacheKey = `banners_public_${position || 'all'}`;
    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, 'Banners fetched from cache');

    const filter = { isActive: true };
    if (position) filter.position = position;
    filter.$or = [{ startAt: null }, { startAt: { $lte: new Date() } }];
    filter.$and = [{ $or: [{ endAt: null }, { endAt: { $gte: new Date() } }] }];
    const banners = await Banner.find(filter).sort({ priority: -1, createdAt: -1 });

    await setCache(cacheKey, banners, 600); // 10 mins TTL
    return successResponse(res, banners, 'Banners fetched');
});

// ─── Admin: all banners (including inactive) ──────────────────────────────────
exports.getAllBanners = catchAsync(async (req, res) => {
    const banners = await Banner.find({}).sort({ priority: -1 });
    return successResponse(res, banners, 'All banners');
});

// ─── Admin: create banner ──────────────────────────────────────────────────────
exports.createBanner = catchAsync(async (req, res) => {
    const banner = await Banner.create({ ...req.body, createdBy: req.user._id });
    await delCacheByPattern('*banners_public*');
    logAdminActivity(
        'CREATE', 'BANNER', banner._id,
        'Banner Created',
        `Admin created banner "${banner.title}" for position ${banner.position}`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'BANNER_CREATED', id: banner._id });
    return successResponse(res, banner, 'Banner created', StatusCodes.CREATED);
});

// ─── Admin: update banner ──────────────────────────────────────────────────────
exports.updateBanner = catchAsync(async (req, res) => {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!banner) return errorResponse(res, 'Banner not found', StatusCodes.NOT_FOUND);
    await delCacheByPattern('*banners_public*');
    logAdminActivity(
        'UPDATE', 'BANNER', banner._id,
        'Banner Updated',
        `Admin updated banner "${banner.title}" (position: ${banner.position}, active: ${banner.isActive})`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'BANNER_UPDATED', id: banner._id });
    return successResponse(res, banner, 'Banner updated');
});

// ─── Admin: delete banner ──────────────────────────────────────────────────────
exports.deleteBanner = catchAsync(async (req, res) => {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return errorResponse(res, 'Banner not found', StatusCodes.NOT_FOUND);
    await delCacheByPattern('*banners_public*');
    logAdminActivity(
        'DELETE', 'BANNER', banner._id,
        'Banner Deleted',
        `Admin deleted banner "${banner.title}"`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'BANNER_DELETED', id: banner._id });
    return successResponse(res, null, 'Banner deleted');
});

// â”€â”€â”€ Public: validate promo code at checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.validatePromoCode = catchAsync(async (req, res) => {
    const { code, orderAmount, userId, userRole } = req.body;
    const promo = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) return errorResponse(res, 'Invalid promo code', StatusCodes.NOT_FOUND);
    if (promo.endAt && promo.endAt < new Date()) return errorResponse(res, 'Promo code expired', StatusCodes.BAD_REQUEST);
    if (promo.maxUsesTotal && promo.usesCount >= promo.maxUsesTotal) return errorResponse(res, 'Promo code usage limit reached', StatusCodes.BAD_REQUEST);
    if (orderAmount < promo.minOrderAmount) return errorResponse(res, `Minimum order â‚¹${promo.minOrderAmount} required`, StatusCodes.BAD_REQUEST);

    // Enforce applicableRoles â€” check if user's role is allowed
    if (promo.applicableRoles && promo.applicableRoles.length > 0 && userRole) {
        if (!promo.applicableRoles.includes(userRole)) {
            return errorResponse(res, 'This promo code is not available for your account type', StatusCodes.BAD_REQUEST);
        }
    }

    // Enforce maxUsesPerUser â€” check if this user already used this promo
    if (promo.maxUsesPerUser && userId) {
        const usageCount = await UserPromoUsage.countDocuments({ promoId: promo._id, userId });
        if (usageCount >= promo.maxUsesPerUser) {
            return errorResponse(res, 'You have reached the usage limit for this promo code', StatusCodes.BAD_REQUEST);
        }
    }

    let discount = 0;
    if (promo.type === 'FLAT_DISCOUNT') {
        discount = promo.value;
    } else if (promo.type === 'PERCENTAGE_DISCOUNT') {
        discount = (orderAmount * promo.value) / 100;
        if (promo.maxDiscountCap) discount = Math.min(discount, promo.maxDiscountCap);
    }

    // Track per-user usage — moved to actual order placement (shoporder controller)
    // to prevent consuming usage when user validates but doesn't complete order.
    // NOTE: The UserPromoUsage record is created by shoporder.controller.js placeOrder.
    // if (userId) {
    //     await UserPromoUsage.create({ promoId: promo._id, userId });
    // }
    // Instead, only do atomic count check here, leave record creation to order placement.

    return successResponse(res, { code: promo.code, discount, type: promo.type, title: promo.title, description: promo.description }, 'Promo code valid');
});

// â”€â”€â”€ Admin: list all promotions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getAllPromotions = catchAsync(async (req, res) => {
    const promos = await Promotion.find({}).sort({ createdAt: -1 });
    return successResponse(res, promos, 'All promotions');
});

// â”€â”€â”€ Admin: create promotion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.createPromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.create({ ...req.body, createdBy: req.user._id });
    logAdminActivity(
        'CREATE', 'PROMO', promo._id,
        'Promo Code Created',
        `Admin created promo code "${promo.code}" â€” ${promo.title} (${promo.type}, value: ${promo.value})`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'PROMO_CREATED', id: promo._id });
    return successResponse(res, promo, 'Promotion created', StatusCodes.CREATED);
});

// â”€â”€â”€ Admin: update promotion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.updatePromotion = catchAsync(async (req, res) => {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!promo) return errorResponse(res, 'Promotion not found', StatusCodes.NOT_FOUND);
    logAdminActivity(
        'UPDATE', 'PROMO', promo._id,
        'Promo Code Updated',
        `Admin updated promo code "${promo.code}" â€” active: ${promo.isActive}, value: ${promo.value}`,
        req.user._id
    );
    emitToAll('DASHBOARD_UPDATE', { type: 'PROMO_UPDATED', id: promo._id });
    return successResponse(res, promo, 'Promotion updated');
});

// â”€â”€â”€ Admin: delete promotion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
