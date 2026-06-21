const { StatusCodes } = require('http-status-codes');
const Shop       = require('./shop.model');
const Payout     = require('../payout/payout.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const { setCache, getCache, delCache } = require('../../helpers/redis.helper');

const SHOP_CACHE_PREFIX = 'shops_list';

/**
 * POST /api/v1/shops
 * Create / register a shop for the logged-in owner
 */
exports.createShop = catchAsync(async (req, res) => {
    const ownerId = req.user._id;
    const existing = await Shop.findOne({ ownerId });
    if (existing) return errorResponse(res, 'You already have a registered shop', StatusCodes.CONFLICT);

    const shop = await Shop.create({ ownerId, ...req.body });

    // Invalidate shop caches
    const { getRedis } = require('../../helpers/redis.helper');
    const redisClient = getRedis();
    if (redisClient) {
        const keys = await redisClient.keys(`*${SHOP_CACHE_PREFIX}*`);
        if (keys.length > 0) await redisClient.del(keys);
    }

    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP', id: shop._id });
    return successResponse(res, shop, 'Shop created', StatusCodes.CREATED);
});

/**
 * GET /api/v1/shops/my
 * Shop owner fetches their own shop
 */
exports.getMyShop = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id }).populate('ownerId', 'name phone');
    if (!shop) return errorResponse(res, 'No shop found for this account', StatusCodes.NOT_FOUND);
    return successResponse(res, shop, 'Shop fetched');
});

/**
 * PATCH /api/v1/shops/my
 * Shop owner updates their shop details
 */
exports.updateMyShop = catchAsync(async (req, res) => {
    const updateData = { ...req.body };

    if (req.file) {
        updateData.logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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
        { new: true, runValidators: true }
    );
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    // Invalidate shop caches
    const { getRedis } = require('../../helpers/redis.helper');
    const redisClient = getRedis();
    if (redisClient) {
        const keys = await redisClient.keys(`*${SHOP_CACHE_PREFIX}*`);
        if (keys.length > 0) await redisClient.del(keys);
    }

    return successResponse(res, shop, 'Shop updated');
});

/**
 * GET /api/v1/shops
 * List all shops — Admin sees all with filters, customers see active shops
 */
exports.getAllShops = catchAsync(async (req, res) => {
    const { kycStatus, search, page = 1, limit = 20, isOnline } = req.query;
    const isAdmin = req.user?.role === 'ADMIN';

    const cacheKey = `${SHOP_CACHE_PREFIX}_${isAdmin ? 'admin' : 'customer'}_${kycStatus || 'all'}_${search || ''}_${page}_${limit}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) return successResponse(res, cachedData, 'Shops fetched from cache');

    const query = {};

    if (isAdmin) {
        // Admin can filter by KYC status
        if (kycStatus) query['kyc.status'] = kycStatus.toUpperCase();
    } else {
        // Customers see all shops that aren't explicitly rejected
        query['kyc.status'] = { $in: ['APPROVED', 'PENDING'] };
    }

    if (search) query.name = { $regex: search, $options: 'i' };
    if (isOnline !== undefined) query.isOnline = isOnline === 'true';

    const total = await Shop.countDocuments(query);
    const shops = await Shop.find(query)
        .populate('ownerId', 'name phone email')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    // Admins get paginated result, customers get flat array for easy mobile consumption
    const result = isAdmin
        ? { shops, total, page, totalPages: Math.ceil(total / limit) }
        : shops;

    await setCache(cacheKey, result, 300);

    return successResponse(res, result, 'Shops fetched');
});


/**
 * GET /api/v1/shops/:id
 * Fetch a single shop by id (admin or customer browsing)
 */
exports.getShopById = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
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
        { new: true }
    );
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    emitToAll('DASHBOARD_UPDATE', { type: 'SHOP_KYC', id: shop._id, status });
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

    shop.payoutMethods = shop.payoutMethods.filter(m => String(m._id) !== String(req.params.methodId));
    await shop.save();

    return successResponse(res, shop.payoutMethods, 'Payout method deleted');
});

/**
 * POST /api/v1/shops/my/withdraw
 * Shop owner requests a payout withdrawal
 */
exports.requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body; // payoutMethod is label/details string

    const mongoose = require('mongoose');
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id }).session(session);
        if (!shop) {
            if (session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
        }
        if (shop.wallet.balance < amount) {
            if (session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
        }

        // Deduct from wallet
        shop.wallet.balance -= amount;
        await shop.save({ session });

        const [txn] = await WalletTxn.create([{
            userId:      req.user._id,
            type:        'WITHDRAWAL',
            amount,
            balance:     shop.wallet.balance,
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

        if (session) await session.commitTransaction();
        if (session) session.endSession();
        return successResponse(res, txn, 'Withdrawal initiated');
    } catch (error) {
        if (session) await session.abortTransaction();
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
    const user = await Customer.findByIdAndUpdate(req.user._id, { name }, { new: true });
    
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
    await shop.save();

    return successResponse(res, shop, 'Shop updated successfully');
});

exports.deleteMyShop = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const Product = require('../product/product.model');
    await Product.deleteMany({ shopId: shop._id });
    await Shop.findByIdAndDelete(shop._id);

    const { getRedis } = require('../../helpers/redis.helper');
    const redisClient = getRedis();
    if (redisClient) {
        const keys = await redisClient.keys(`*${SHOP_CACHE_PREFIX}*`);
        if (keys.length > 0) await redisClient.del(keys);
    }

    return successResponse(res, null, 'Shop deleted successfully');
});

exports.deleteShop = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

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
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const {
        deliveryRadiusKm, minOrderAmount, freeDeliveryAbove, deliveryCharge,
        discountEnabled, discountAbove, discountType, discountValue, discountPct, maxDiscountCap,
        sameDayDelivery, deliverySlots
    } = req.body;

    if (shop.delivery) {
        shop.delivery = {
            ...shop.delivery,
            radiusKm: deliveryRadiusKm ?? shop.delivery.radiusKm,
            fee: deliveryCharge ?? shop.delivery.fee,
            freeAbove: freeDeliveryAbove ?? shop.delivery.freeAbove,
        };
    }

    if (!shop.delivery) {
        shop.delivery = {
            radiusKm: deliveryRadiusKm || 5,
            fee: deliveryCharge || 0,
            freeAbove: freeDeliveryAbove || 0
        };
    }

    shop.markModified('delivery');
    await shop.save();

    return successResponse(res, shop, 'Delivery config updated');
});
