const { StatusCodes } = require('http-status-codes');
const mongoose      = require('mongoose');
const Shop       = require('./shop.model');
const Payout     = require('../payout/payout.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { uploadImage, uploadBase64, cleanupImage } = require('../../services/cloudinary.service');
const { emitToAll } = require('../../helpers/socket.helper');
const { setCache, getCache, delCache, delCacheByPattern } = require('../../helpers/redis.helper');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const { supportsTransactions } = require('../../helpers/transaction.helper');

const SHOP_CACHE_PREFIX = 'shops_list';

/**
 * POST /api/v1/shops
 * Create / register a shop for the logged-in owner
 */
exports.createShop = catchAsync(async (req, res) => {
    const { name, category, description, address, location, delivery } = req.body;
    let logoUrl = null;

    if (req.body.logoBase64) {
        const { url } = await uploadBase64(req.body.logoBase64, 'kwickly/shops');
        logoUrl = url;
    } else if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/shops');
        logoUrl = url;
    }

    let parsedLocation = { type: 'Point', coordinates: [77.2090, 28.6139] };
    if (location) {
        if (typeof location === 'string') {
            try { parsedLocation = JSON.parse(location); } catch (e) {}
        } else if (typeof location === 'object') {
            parsedLocation = location;
        }
    }

    const AppSettings = require('../settings/settings.model');
    const appSettings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    const freeTrialDays = appSettings?.subscription?.freeTrialDays || 14;
    const defaultTrialEndDate = new Date();
    defaultTrialEndDate.setDate(defaultTrialEndDate.getDate() + freeTrialDays);

    const shop = await Shop.create({
        ownerId: req.user._id,
        name,
        category: category || 'General',
        description,
        address,
        location: parsedLocation,
        deliveryConfig: delivery || {},
        logoUrl,
        subscription: {
            status: 'TRIAL',
            isTrial: true,
            planId: 'shop_trial',
            trialEndDate: defaultTrialEndDate,
            expiryDate: defaultTrialEndDate
        }
    });

    await delCacheByPattern(`*${SHOP_CACHE_PREFIX}*`);
    return successResponse(res, shop, 'Shop created successfully', StatusCodes.CREATED);
});

/**
 * GET /api/v1/shops/my
 * Shop owner fetches their own shop
 */
exports.getMyShop = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id }).populate('ownerId', 'name phone').select('-payoutMethods');
    if (!shop) return errorResponse(res, 'No shop found for this account', StatusCodes.NOT_FOUND);
    return successResponse(res, shop, 'Shop fetched');
});

/**
 * PATCH /api/v1/shops/my
 * Shop owner updates their shop details
 */
exports.updateMyShop = catchAsync(async (req, res) => {
    const updateData = { ...req.body };

    // Strip fields that shop owners must not modify (admin-only)
    delete updateData.kyc;
    delete updateData.ownerId;
    delete updateData.subscription;
    delete updateData.wallet;

    if (updateData.logoBase64) {
        const existing = await Shop.findOne({ ownerId: req.user._id }).select('logoUrl');
        const { url } = await uploadBase64(updateData.logoBase64, 'kwickly/shops');
        updateData.logoUrl = url;
        delete updateData.logoBase64;
        if (existing?.logoUrl && existing.logoUrl !== url) {
            cleanupImage(existing.logoUrl);
        }
    } else if (req.file) {
        const existing = await Shop.findOne({ ownerId: req.user._id }).select('logoUrl');
        const { url } = await uploadImage(req.file.buffer, 'kwickly/shops');
        updateData.logoUrl = url;
        if (existing?.logoUrl && existing.logoUrl !== url) {
            cleanupImage(existing.logoUrl);
        }
    }

    if (updateData.location && typeof updateData.location === 'string') {
        try {
            updateData.location = JSON.parse(updateData.location);
        } catch (e) {
            delete updateData.location;
        }
    }

    const shop = await Shop.findOneAndUpdate(
        { ownerId: req.user._id },
        { $set: updateData },
        { returnDocument: 'after', runValidators: true }
    );
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    // Invalidate shop caches
    await delCacheByPattern(`*${SHOP_CACHE_PREFIX}*`);

    notifyUser({
        userId: shop.ownerId,
        title: 'Shop Settings Updated',
        message: 'Your shop details and settings have been successfully updated.',
        action: 'UPDATE',
        entityType: 'SHOP',
        entityId: shop._id,
        targetRole: 'SHOP_OWNER'
    });

    return successResponse(res, shop, 'Shop updated');
});

/**
 * GET /api/v1/shops
 * List all shops — Admin sees all with filters, customers see only APPROVED KYC shops sorted by distance
 */
exports.getAllShops = catchAsync(async (req, res) => {
    const { kycStatus, search, category, page = 1, limit = 50, isOnline, lat, lng } = req.query;
    const isAdmin = req.user?.role === 'ADMIN';

    const cacheKey = `${SHOP_CACHE_PREFIX}_${isAdmin ? 'admin' : 'customer'}_${kycStatus || 'all'}_${category || 'all'}_${search || ''}_${lat || ''}_${lng || ''}_${page}_${limit}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) return successResponse(res, cachedData, 'Shops fetched from cache');

    const query = { isDeleted: { $ne: true } };

    if (isAdmin) {
        // Admin can filter by KYC status
        if (kycStatus) query['kyc.status'] = kycStatus.toUpperCase();
        if (isOnline !== undefined) query.isOnline = isOnline === 'true';
    } else {
        // Customers MUST ONLY see shops with APPROVED KYC and active online status
        query['kyc.status'] = 'APPROVED';
        query.isOnline = true;
    }

    if (category && category !== 'All' && category !== 'all') {
        const catEscaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
            { category: { $regex: new RegExp(catEscaped, 'i') } },
            { description: { $regex: new RegExp(catEscaped, 'i') } }
        ];
    }

    if (search && search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = { $regex: escaped, $options: 'i' };
        const searchCondition = [
            { name: searchRegex },
            { category: searchRegex },
            { description: searchRegex },
            { address: searchRegex }
        ];

        if (query.$or) {
            query.$and = [
                { $or: query.$or },
                { $or: searchCondition }
            ];
            delete query.$or;
        } else {
            query.$or = searchCondition;
        }
    }

    const total = await Shop.countDocuments(query);
    let shops = await Shop.find(query)
        .populate('ownerId', 'name phone email')
        .lean();

    // Distance calculation & Sorting from near to high
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const hasUserLocation = !isNaN(userLat) && !isNaN(userLng);

    const { haversineDistance } = require('../../helpers/geo.helper');

    shops = shops.map(shop => {
        let distanceKm = null;
        let distanceFormatted = '1.5 km';
        let deliveryEstimate = '25-35 min';

        if (hasUserLocation && shop.location?.coordinates && shop.location.coordinates.length === 2) {
            const [shopLng, shopLat] = shop.location.coordinates;
            if (typeof shopLng === 'number' && typeof shopLat === 'number') {
                const rawDist = haversineDistance([userLng, userLat], [shopLng, shopLat]);
                distanceKm = Math.round(rawDist * 10) / 10; // Round to 1 decimal place

                if (distanceKm < 1) {
                    distanceFormatted = `${Math.round(distanceKm * 1000)} m`;
                    deliveryEstimate = '15-25 min';
                } else {
                    distanceFormatted = `${distanceKm.toFixed(1)} km`;
                    deliveryEstimate = distanceKm <= 3 ? '20-35 min' : distanceKm <= 6 ? '35-45 min' : '45-60 min';
                }
            }
        }

        return {
            ...shop,
            distanceKm: distanceKm !== null ? distanceKm : 999,
            distanceFormatted,
            deliveryEstimate
        };
    });

    if (hasUserLocation) {
        // Sort from near to high (nearest first)
        shops.sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
        // Sort by rating & total orders
        shops.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    // Apply pagination
    const paginatedShops = shops.slice((page - 1) * limit, page * limit);

    const result = isAdmin
        ? { shops: paginatedShops, total, page, totalPages: Math.ceil(total / limit) }
        : paginatedShops;

    await setCache(cacheKey, result, 120);

    return successResponse(res, result, 'Shops fetched');
});


/**
 * GET /api/v1/shops/:id
 * Fetch a single shop by id (admin or customer browsing)
 */
exports.getShopById = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const isOwner = req.user && String(shop.ownerId._id) === String(req.user._id);
    const isAdmin = req.user && req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
        shop.wallet = undefined;
        shop.payoutMethods = undefined;
        shop.subscription = undefined;
    }

    return successResponse(res, shop, 'Shop fetched');
});

/**
 * PATCH /api/v1/shops/:id/kyc
 * Admin approves or rejects a shop's KYC
 */
exports.reviewShopKyc = catchAsync(async (req, res) => {
    const { status } = req.body; // 'APPROVED' | 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return errorResponse(res, 'Invalid status', StatusCodes.BAD_REQUEST);
    }

    const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        { 'kyc.status': status },
        { returnDocument: 'after' }
    );
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    emitToAll('DASHBOARD_UPDATE', { type: 'SHOP_KYC', id: shop._id, status });

    notifyUser({
        userId: shop.ownerId,
        title: `Shop KYC ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: status === 'APPROVED' 
            ? 'Your shop KYC has been approved. You can now accept orders.'
            : 'Your shop KYC was rejected. Please contact support.',
        action: 'KYC',
        entityType: 'SHOP',
        entityId: shop._id,
        targetRole: 'SHOP'
    });

    return successResponse(res, shop, `Shop KYC ${status.toLowerCase()}`);
});

/**
 * PATCH /api/v1/shops/:id/toggle
 * Admin blocks/unblocks a shop
 */
exports.toggleShop = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    shop.isOnline = !shop.isOnline;
    await shop.save();

    notifyUser({
        userId: shop.ownerId,
        title: shop.isOnline ? 'Shop Activated' : 'Shop Blocked',
        message: shop.isOnline 
            ? 'Your shop is now online and visible to customers.'
            : 'Your shop has been blocked by the admin.',
        action: 'UPDATE',
        entityType: 'SHOP',
        entityId: shop._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, shop, `Shop ${shop.isOnline ? 'activated' : 'blocked'}`);
});

/**
 * POST /api/v1/shops/my/payout-methods
 * Shop owner adds a bank/UPI payout method
 */
exports.addPayoutMethod = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    // If first method, make it primary
    if (shop.payoutMethods.length === 0) req.body.isPrimary = true;
    shop.payoutMethods.push(req.body);
    await shop.save();

    return successResponse(res, shop.payoutMethods, 'Payout method added');
});

/**
 * PATCH /api/v1/shops/my/payout-methods/:methodId/primary
 * Set a payout method as primary
 */
exports.setPrimaryPayout = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    shop.payoutMethods.forEach(m => { m.isPrimary = String(m._id) === String(req.params.methodId); });
    await shop.save();

    return successResponse(res, shop.payoutMethods, 'Primary payout method updated');
});

/**
 * DELETE /api/v1/shops/my/payout-methods/:methodId
 */
exports.deletePayoutMethod = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const deletedMethod = shop.payoutMethods.find(m => String(m._id) === String(req.params.methodId));
    shop.payoutMethods = shop.payoutMethods.filter(m => String(m._id) !== String(req.params.methodId));

    // If deleted method was primary and other methods remain, auto-assign primary
    if (deletedMethod?.isPrimary && shop.payoutMethods.length > 0) {
        shop.payoutMethods[0].isPrimary = true;
    }

    await shop.save();

    return successResponse(res, shop.payoutMethods, 'Payout method deleted');
});

/**
 * POST /api/v1/shops/my/withdraw
 * Shop owner requests a payout withdrawal
 */
exports.requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body; // payoutMethod is label/details string

    let session = null;
    let useTransaction = false;
    if (supportsTransactions()) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) {
            session = null;
            useTransaction = false;
        }
    }
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id }).session(session);
        if (!shop) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
        }
        // Atomic: deduct from wallet with $gte guard
        const updatedShop = await Shop.findOneAndUpdate(
            { _id: shop._id, 'wallet.balance': { $gte: amount } },
            { $inc: { 'wallet.balance': -amount } },
            { returnDocument: 'after', session }
        );
        if (!updatedShop) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
        }

        const [txn] = await WalletTxn.create([{
            userId:      req.user._id,
            type:        'WITHDRAWAL',
            amount,
            balance:     updatedShop.wallet.balance,
            status:      'PENDING',
            description: `Shop Withdrawal to ${payoutMethod || 'bank'}`
        }], { session });

        const paymentMethodType = (payoutMethod || '').toLowerCase().includes('upi') ? 'UPI' : 'BANK';
        await Payout.create([{
            shopId: shop._id,
            amount,
            paymentMethod: paymentMethodType,
            paymentDetails: payoutMethod || 'bank',
            walletTxnId: txn._id
        }], { session });

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();
        return successResponse(res, txn, 'Withdrawal initiated');
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

/**
 * PATCH /api/v1/shops/my/owner
 */
exports.updateOwnerName = catchAsync(async (req, res) => {
    const { name } = req.body;
    if (!name) return errorResponse(res, 'Name is required', StatusCodes.BAD_REQUEST);

    // Update the User/Customer document attached to this ownerId
    const Customer = require('../customer/customer.model');
    const user = await Customer.findByIdAndUpdate(req.user._id, { name }, { returnDocument: 'after' });
    
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    
    return successResponse(res, user, 'Owner name updated');
});



exports.updateShopAdmin = catchAsync(async (req, res) => {
    const { name, category, description, address } = req.body;
    if (!name || !name.trim()) return errorResponse(res, 'Shop name is required', StatusCodes.BAD_REQUEST);
    if (!category || !category.trim()) return errorResponse(res, 'Category is required', StatusCodes.BAD_REQUEST);
    if (!address || !address.trim()) return errorResponse(res, 'Address is required', StatusCodes.BAD_REQUEST);

    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    shop.name = name.trim();
    shop.category = category.trim();
    shop.description = (description || '').trim();
    shop.address = address.trim();

    if (req.body.deliveryConfig) {
        shop.deliveryConfig = { ...shop.deliveryConfig, ...req.body.deliveryConfig };
        shop.markModified('deliveryConfig');
    }
    if (req.body.businessHours) {
        shop.businessHours = { ...shop.businessHours, ...req.body.businessHours };
        shop.markModified('businessHours');
    }
    if (req.body.subscription) {
        shop.subscription = { ...shop.subscription, ...req.body.subscription };
        shop.markModified('subscription');
    }

    await shop.save();

    return successResponse(res, shop, 'Shop updated successfully');
});

exports.deleteMyShop = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    // Clean up shop logo from Cloudinary
    if (shop.logoUrl) {
        cleanupImage(shop.logoUrl);
    }

    const Product = require('../product/product.model');
    await Product.deleteMany({ shopId: shop._id });
    await Shop.findByIdAndDelete(shop._id);

    await delCacheByPattern(`*${SHOP_CACHE_PREFIX}*`);

    return successResponse(res, null, 'Shop deleted successfully');
});

exports.deleteShop = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    // Clean up shop logo from Cloudinary
    if (shop.logoUrl) {
        cleanupImage(shop.logoUrl);
    }

    const Product = require('../product/product.model');
    await Product.deleteMany({ shopId: shop._id });
    await Shop.findByIdAndDelete(req.params.id);

    return successResponse(res, null, 'Shop and all products deleted successfully');
});

exports.getDeliveryConfig = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id).select('delivery delivery deliveryConfig');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    return successResponse(res, shop, 'Delivery config fetched');
});

exports.updateDeliveryConfig = catchAsync(async (req, res) => {
    let query = { _id: req.params.id };
    if (req.user.role !== 'SHOP' && req.user.role !== 'ADMIN') {
        return errorResponse(res, 'Not authorized', StatusCodes.FORBIDDEN);
    }
    if (req.user.role !== 'ADMIN') query.ownerId = req.user._id;

    const shop = await Shop.findOne(query);
    if (!shop) return errorResponse(res, 'Shop not found or unauthorized', StatusCodes.NOT_FOUND);

    const {
        deliveryRadiusKm, minOrderAmount, freeDeliveryAbove, deliveryCharge,
        discountEnabled, discountAbove, discountType, discountValue, discountPct, maxDiscountCap,
        sameDayDelivery, deliverySlots
    } = req.body;

    shop.deliveryConfig = {
        deliveryRadiusKm, minOrderAmount, freeDeliveryAbove, deliveryCharge,
        discountEnabled, discountAbove, discountType, discountValue, discountPct, maxDiscountCap,
        sameDayDelivery, deliverySlots
    };

    shop.markModified('deliveryConfig');
    await shop.save();

    const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
    triggerDashboardUpdate();

    return successResponse(res, shop, 'Delivery config updated');
});
