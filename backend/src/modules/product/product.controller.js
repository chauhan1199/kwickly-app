const { StatusCodes } = require('http-status-codes');
const Product    = require('./product.model');
const Shop       = require('../shop/shop.model');
const { uploadImage, cleanupImage } = require('../../services/cloudinary.service');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { setCache, getCache, delCache, delCacheByPattern } = require('../../helpers/redis.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const Notification = require('../notification/notification.model');
const logger = require('../../helpers/logger.helper');

const PRODUCT_CACHE_PREFIX = 'products_list';

const logProductActivity = async (action, product, shop, adminId) => {
    try {
        const title = action === 'CREATE' ? 'Product Added' : action === 'UPDATE' ? 'Product Updated' : 'Product Deleted';
        const msg = `"${product.name}" ${action === 'CREATE' ? 'added to' : action === 'UPDATE' ? 'updated in' : 'removed from'} "${shop.name}" (â‚¹${product.price}/${product.unit})`;

        const adminNotification = await Notification.create({
            title,
            message: msg,
            type: 'ADMIN_ACTIVITY',
            action,
            entityType: 'PRODUCT',
            entityId: product._id,
            performedBy: adminId,
            targetRole: 'ADMIN'
        });
        
        const shopNotification = await Notification.create({
            title,
            message: msg,
            type: 'DIRECT',
            action,
            entityType: 'PRODUCT',
            entityId: product._id,
            performedBy: adminId,
            targetRole: 'SHOP',
            userId: shop.ownerId
        });
        
        try { emitToAll('NEW_NOTIFICATION', adminNotification); } catch (_) {}
        
        // Use emitToUser if available, else emitToAll
        const { emitToUser } = require('../../helpers/socket.helper');
        try { emitToUser(shop.ownerId.toString(), 'NEW_NOTIFICATION', shopNotification); } catch (_) {}
    } catch (e) { logger.error('[logProductActivity] Failed:', e.message); }
};

/**
 * GET /api/v1/products?shopId=xxx
 */
exports.getProducts = catchAsync(async (req, res) => {
    const { shopId, search, isActive } = req.query;

    // Attempt cache fetch if simple fetch
    const cacheKey = `${PRODUCT_CACHE_PREFIX}_${shopId || 'all'}_${search || ''}_${isActive !== undefined ? isActive : 'all'}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
        return successResponse(res, cachedData, 'Products fetched from cache');
    }

    const query = {};
    if (shopId)   query.shopId = shopId;
    if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.name = { $regex: escaped, $options: 'i' };
    }
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const products = await Product.find(query).sort('-createdAt');
    await setCache(cacheKey, products, 300); // cache for 5 min
    return successResponse(res, products, 'Products fetched');
});

/**
 * GET /api/v1/products/shop
 * Get all products for the currently logged-in shop owner
 */
exports.getShopProducts = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const products = await Product.find({ shopId: shop._id }).sort('-createdAt');
    return successResponse(res, products, 'Shop products fetched');
});

/**
 * GET /api/v1/products/:id
 */
exports.getProductById = catchAsync(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', StatusCodes.NOT_FOUND);
    return successResponse(res, product, 'Product fetched');
});

/**
 * POST /api/v1/products
 * Shop owner creates a product
 */
exports.createProduct = catchAsync(async (req, res) => {
    let targetShopId = req.body.shopId;
    if (req.user.role !== 'ADMIN') {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return errorResponse(res, 'Shop not found. Register your shop first.', StatusCodes.NOT_FOUND);
        targetShopId = shop._id;
    }
    if (!targetShopId) return errorResponse(res, 'shopId is required', StatusCodes.BAD_REQUEST);

    const productData = { ...req.body };
    if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/products');
        productData.imageUrl = url;
    } else if (req.body.imageBase64) {
        try {
            const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const { url } = await uploadImage(buffer, 'kwickly/products');
            productData.imageUrl = url;
        } catch (e) {
            logger.error('Error saving base64 image:', e.message);
        }
    }
    
    // Parse attributes if sent as a JSON string from FormData
    if (productData.attributes && typeof productData.attributes === 'string') {
        try {
            productData.attributes = JSON.parse(productData.attributes);
        } catch (e) {
            logger.warn('Error parsing attributes:', e.message);
            productData.attributes = [];
        }
    }

    const product = await Product.create({ shopId: targetShopId, ...productData });

    // Log admin activity notification
    try {
        const shop = await Shop.findById(targetShopId);
        if (shop) await logProductActivity('CREATE', product, shop, req.user?._id);
    } catch (_) {}

    // Invalidate product caches
    await delCacheByPattern(`*${PRODUCT_CACHE_PREFIX}*`);

    return successResponse(res, product, 'Product created', StatusCodes.CREATED);
});

/**
 * PATCH /api/v1/products/:id
 */
exports.updateProduct = catchAsync(async (req, res) => {
    const query = { _id: req.params.id };
    if (req.user.role !== 'ADMIN') {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
        query.shopId = shop._id;
    }

    const existing = await Product.findOne(query).select('imageUrl');
    const updateData = { ...req.body };
    if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/products');
        updateData.imageUrl = url;
        if (existing?.imageUrl && existing.imageUrl !== url) {
            cleanupImage(existing.imageUrl);
        }
    } else if (req.body.imageBase64) {
        try {
            const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const { url } = await uploadImage(buffer, 'kwickly/products');
            updateData.imageUrl = url;
            if (existing?.imageUrl && existing.imageUrl !== url) {
                cleanupImage(existing.imageUrl);
            }
        } catch (e) {
            logger.error('Error saving base64 image:', e.message);
        }
    }

    // Parse attributes if sent as a JSON string from FormData
    if (updateData.attributes && typeof updateData.attributes === 'string') {
        try {
            updateData.attributes = JSON.parse(updateData.attributes);
        } catch (e) {
            logger.warn('Error parsing attributes:', e.message);
            updateData.attributes = [];
        }
    }

    const product = await Product.findOneAndUpdate(
        query,
        { $set: updateData },
        { returnDocument: 'after', runValidators: true }
    );
    if (!product) return errorResponse(res, 'Product not found or not yours', StatusCodes.NOT_FOUND);

    // Log admin activity notification
    try {
        const shop = await Shop.findById(product.shopId);
        if (shop) await logProductActivity('UPDATE', product, shop, req.user?._id);
    } catch (_) {}

    // Invalidate product caches
    await delCacheByPattern(`*${PRODUCT_CACHE_PREFIX}*`);

    return successResponse(res, product, 'Product updated');
});

/**
 * DELETE /api/v1/products/:id
 */
exports.deleteProduct = catchAsync(async (req, res) => {
    const query = { _id: req.params.id };
    if (req.user.role !== 'ADMIN') {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
        query.shopId = shop._id;
    }

    const product = await Product.findOneAndDelete(query);
    if (!product) return errorResponse(res, 'Product not found', StatusCodes.NOT_FOUND);

    if (product.imageUrl) {
        cleanupImage(product.imageUrl);
    }

    // Log admin activity notification
    try {
        const shop = await Shop.findById(product.shopId);
        if (shop) await logProductActivity('DELETE', product, shop, req.user?._id);
    } catch (_) {}

    // Invalidate product caches
    await delCacheByPattern(`*${PRODUCT_CACHE_PREFIX}*`);

    return successResponse(res, null, 'Product deleted');
});
