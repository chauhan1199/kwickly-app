const { StatusCodes } = require('http-status-codes');
const Shop       = require('./shop.model');
const Payout     = require('../payout/payout.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { uploadImage, uploadBase64, cleanupImage } = require('../../services/cloudinary.service');
const { emitToAll } = require('../../helpers/socket.helper');
const { setCache, getCache, delCacheByPattern } = require('../../helpers/redis.helper');
const { notifyUser } = require('../../helpers/notifyUser.helper');

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
    const appSettings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
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
    const shop = await Shop.findOne({ ownerId: req.user._id }).populate('ownerId', 'name phone').lean();
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
    if (updateData.kyc) {
        // Owners may submit KYC documents for review, but status is admin-controlled.
        const nextDocs = Array.isArray(updateData.kyc.documents)
            ? updateData.kyc.documents
                .filter(doc => doc && typeof doc === 'object' && String(doc.url || '').trim())
                .map(doc => ({
                    name: String(doc.name || '').trim(),
                    url: String(doc.url).trim(),
                    public_id: doc.public_id ? String(doc.public_id).trim() : undefined,
                    docType: String(doc.docType || doc.type || 'OTHER').trim() || 'OTHER'
                }))
            : undefined;
        updateData.kyc = { documents: nextDocs, status: 'PENDING' };
    }
    delete updateData.ownerId;
    delete updateData.subscription;
    delete updateData.wallet;

    if (updateData.logoBase64) {
        const existing = await Shop.findOne({ ownerId: req.user._id }).select('logoUrl').lean();
        const { url } = await uploadBase64(updateData.logoBase64, 'kwickly/shops');
        updateData.logoUrl = url;
        delete updateData.logoBase64;
        if (existing?.logoUrl && existing.logoUrl !== url) {
            cleanupImage(existing.logoUrl);
        }
    } else if (req.file) {
        const existing = await Shop.findOne({ ownerId: req.user._id }).select('logoUrl').lean();
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
        // Unknown until we can measure it — never send a made-up distance/ETA
        let distanceFormatted = null;
        let deliveryEstimate = null;

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
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone').lean();
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const ownerIdStr = shop.ownerId?._id ? String(shop.ownerId._id) : (shop.ownerId ? String(shop.ownerId) : null);
    const isOwner = req.user && ownerIdStr && ownerIdStr === String(req.user._id);
    const isAdmin = req.user && req.user.role === 'ADMIN';

    const shopObj = shop.toObject ? shop.toObject() : { ...shop };
    if (!isOwner && !isAdmin) {
        delete shopObj.wallet;
        delete shopObj.payoutMethods;
        delete shopObj.subscription;
    }

    return successResponse(res, shopObj, 'Shop fetched');
});

/**
 * PATCH /api/v1/shops/:id/kyc
 * Admin approves or rejects a shop's KYC
 */


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
    const shop = await Shop.findOne({ ownerId: req.user._id }).lean();
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
    const shop = await Shop.findById(req.params.id).lean();
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
    const shop = await Shop.findById(req.params.id).select('delivery delivery deliveryConfig').lean();
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

/**
 * POST /api/v1/shops/my/payout-methods
 */
exports.addPayoutMethod = catchAsync(async (req, res) => {
    const { type, label, detail, bankName } = req.body;
    if (!type || !['BANK', 'UPI'].includes(type.toUpperCase())) {
        return errorResponse(res, 'Type must be BANK or UPI', StatusCodes.BAD_REQUEST);
    }
    if (!detail || !detail.trim()) {
        return errorResponse(res, 'Account / UPI detail is required', StatusCodes.BAD_REQUEST);
    }

    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    if (shop.payoutMethods && shop.payoutMethods.length >= 5) {
        return errorResponse(res, 'Maximum 5 payout methods allowed', StatusCodes.BAD_REQUEST);
    }

    const isPrimary = !shop.payoutMethods || shop.payoutMethods.length === 0;
    const newMethod = {
        type: type.toUpperCase(),
        label: label || (type.toUpperCase() === 'BANK' ? (bankName || 'Bank Account') : 'UPI ID'),
        detail: detail.trim(),
        isPrimary
    };

    shop.payoutMethods.push(newMethod);
    await shop.save();

    return successResponse(res, shop.payoutMethods, 'Payout method added successfully', StatusCodes.CREATED);
});

/**
 * PATCH /api/v1/shops/my/payout-methods/:methodId/primary
 */
exports.setPrimaryPayout = catchAsync(async (req, res) => {
    const { methodId } = req.params;
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    let found = false;
    shop.payoutMethods.forEach(method => {
        if (method._id.toString() === methodId || method.id === methodId) {
            method.isPrimary = true;
            found = true;
        } else {
            method.isPrimary = false;
        }
    });

    if (!found) return errorResponse(res, 'Payout method not found', StatusCodes.NOT_FOUND);

    await shop.save();
    return successResponse(res, shop.payoutMethods, 'Primary payout method updated');
});

/**
 * DELETE /api/v1/shops/my/payout-methods/:methodId
 */
exports.deletePayoutMethod = catchAsync(async (req, res) => {
    const { methodId } = req.params;
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const initialLength = shop.payoutMethods.length;
    shop.payoutMethods = shop.payoutMethods.filter(m => m._id.toString() !== methodId && m.id !== methodId);

    if (shop.payoutMethods.length === initialLength) {
        return errorResponse(res, 'Payout method not found', StatusCodes.NOT_FOUND);
    }

    // If deleted method was primary, make the first remaining method primary
    if (shop.payoutMethods.length > 0 && !shop.payoutMethods.some(m => m.isPrimary)) {
        shop.payoutMethods[0].isPrimary = true;
    }

    await shop.save();
    return successResponse(res, shop.payoutMethods, 'Payout method removed');
});

/**
 * POST /api/v1/shops/my/withdraw
 */
exports.requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body;
    if (!amount || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid withdrawal amount', StatusCodes.BAD_REQUEST);
    }
    if (!payoutMethod) {
        return errorResponse(res, 'Payout method destination is required', StatusCodes.BAD_REQUEST);
    }

    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const minBalance = Number(settings?.wallet?.minimumBalance !== undefined ? settings.wallet.minimumBalance : 100);

    const shop = await Shop.findOne({ ownerId: req.user._id }).lean();
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const currentBalance = Number(shop.wallet?.balance || 0);
    const maxWithdrawable = Math.max(0, currentBalance - minBalance);

    if (Number(amount) > maxWithdrawable) {
        return errorResponse(res, `Insufficient withdrawable balance. Your total balance is ₹${currentBalance}, but ₹${minBalance} is reserved as safety balance. Max withdrawable amount is ₹${maxWithdrawable}.`, StatusCodes.BAD_REQUEST);
    }

    // Atomic deduct from shop wallet
    const updatedShop = await Shop.findOneAndUpdate(
        { _id: shop._id, 'wallet.balance': { $gte: Number(amount) + minBalance } },
        { $inc: { 'wallet.balance': -Number(amount) } },
        { returnDocument: 'after' }
    );

    if (!updatedShop) {
        return errorResponse(res, 'Insufficient funds for withdrawal', StatusCodes.BAD_REQUEST);
    }

    const txn = await WalletTxn.create({
        userId: req.user._id,
        type: 'WITHDRAWAL',
        amount: Number(amount),
        balance: updatedShop.wallet.balance,
        status: 'PENDING',
        description: `Withdrawal to ${payoutMethod}`
    });

    const isUpi = payoutMethod.toLowerCase().includes('upi') || payoutMethod.includes('@');
    const payout = await Payout.create({
        shopId: shop._id,
        amount: Number(amount),
        paymentMethod: isUpi ? 'UPI' : 'BANK',
        paymentDetails: payoutMethod,
        walletTxnId: txn._id
    });

    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    await delCache('admin_payouts');

    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_PAYOUT', id: payout._id });

    notifyUser({
        userId: req.user._id,
        title: 'Withdrawal Requested',
        message: `Your shop withdrawal request for ₹${amount} has been initiated and is pending admin approval.`,
        action: 'WITHDRAWAL',
        entityType: 'WALLET',
        entityId: txn._id,
        targetRole: 'SHOP'
    });

    return successResponse(res, { txn, payout, newBalance: updatedShop.wallet.balance }, 'Withdrawal requested successfully', StatusCodes.CREATED);
});

/**
 * POST /api/v1/shops/my/kyc/documents
 */
exports.uploadKycDocument = catchAsync(async (req, res) => {
    const { documentType, documentName, documentBase64, documentUrl } = req.body;
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    let docUrl = null;
    let publicId = null;

    if (req.file) {
        const { url, public_id } = await uploadImage(req.file.buffer, 'kwickly/shop_kyc');
        docUrl = url;
        publicId = public_id;
    } else if (documentBase64) {
        const base64Data = documentBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const { url, public_id } = await uploadImage(buffer, 'kwickly/shop_kyc');
        docUrl = url;
        publicId = public_id;
    } else if (documentUrl) {
        docUrl = documentUrl;
    }

    if (!docUrl) {
        return errorResponse(res, 'No document file provided', StatusCodes.BAD_REQUEST);
    }

    const docType = documentType || 'OTHER';
    const friendlyName = documentName || `${docType} Document`;

    if (!shop.kyc) shop.kyc = { status: 'PENDING', documents: [] };
    if (!shop.kyc.documents) shop.kyc.documents = [];

    shop.kyc.documents.push({
        name: friendlyName,
        docType: docType,
        url: docUrl,
        public_id: publicId,
        uploadedAt: new Date()
    });

    shop.kyc.status = 'PENDING';
    shop.kyc.rejectReason = null;
    shop.markModified('kyc');
    await shop.save();

    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    await delCache('admin_shops_list');
    await delCache('admin_badge_counts');

    const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
    triggerDashboardUpdate();

    notifyUser({
        userId: req.user._id,
        title: 'KYC Document Uploaded',
        message: `Your "${friendlyName}" document has been submitted for admin verification.`,
        action: 'KYC_UPLOAD',
        entityType: 'SHOP',
        entityId: shop._id,
        targetRole: 'SHOP_OWNER'
    });

    return successResponse(res, shop.kyc, 'KYC document uploaded successfully', StatusCodes.CREATED);
});

/**
 * DELETE /api/v1/shops/my/kyc/documents/:docIndex
 */
exports.removeKycDocument = catchAsync(async (req, res) => {
    const { docIndex } = req.params;
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    if (!shop.kyc?.documents || !shop.kyc.documents[docIndex]) {
        return errorResponse(res, 'Document not found', StatusCodes.NOT_FOUND);
    }

    const doc = shop.kyc.documents[docIndex];
    if (doc.url) cleanupImage(doc.url);

    shop.kyc.documents.splice(Number(docIndex), 1);
    shop.markModified('kyc');
    await shop.save();

    return successResponse(res, shop.kyc, 'Document removed successfully');
});

/**
 * PATCH /api/v1/shops/:id/kyc
 * Admin review shop KYC
 */
exports.reviewShopKyc = catchAsync(async (req, res) => {
    const { status, rejectReason } = req.body;
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
        return errorResponse(res, 'Invalid KYC status', StatusCodes.BAD_REQUEST);
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    shop.kyc.status = status;
    shop.kyc.rejectReason = status === 'REJECTED' ? (rejectReason || 'Document details did not match') : null;
    shop.markModified('kyc');
    await shop.save();

    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${shop.ownerId}`);
    await delCache('admin_shops_list');

    const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
    triggerDashboardUpdate();

    notifyUser({
        userId: shop.ownerId,
        title: status === 'APPROVED' ? 'Shop KYC Approved ✅' : 'Shop KYC Rejected ✕',
        message: status === 'APPROVED'
            ? 'Your shop verification is complete. You can now accept online orders!'
            : `Your KYC verification was rejected: ${shop.kyc.rejectReason}. Please re-upload valid documents.`,
        action: 'KYC_REVIEW',
        entityType: 'SHOP',
        entityId: shop._id,
        targetRole: 'SHOP_OWNER'
    });

    return successResponse(res, shop, 'Shop KYC status updated');
});

/**
 * PATCH /api/v1/shops/:id/toggle
 * Admin toggle shop active / verified status
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

    return successResponse(res, shop, `Shop is now ${shop.isOnline ? 'Online' : 'Offline'}`);
});
