const { StatusCodes } = require('http-status-codes');
const Product    = require('./product.model');
const Shop       = require('../shop/shop.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

/**
 * GET /api/v1/products?shopId=xxx
 */
exports.getProducts = catchAsync(async (req, res) => {
    const { shopId, search, isActive } = req.query;
    const query = {};
    if (shopId)   query.shopId = shopId;
    if (search)   query.name   = { $regex: search, $options: 'i' };
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const products = await Product.find(query).sort('-createdAt');
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
        productData.imageUrl = `/uploads/${req.file.filename}`;
    }
    
    // Parse attributes if sent as a JSON string from FormData
    if (productData.attributes && typeof productData.attributes === 'string') {
        try {
            productData.attributes = JSON.parse(productData.attributes);
        } catch (e) {
            console.log('Error parsing attributes', e);
            productData.attributes = [];
        }
    }

    const product = await Product.create({ shopId: targetShopId, ...productData });
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

    const updateData = { ...req.body };
    if (req.file) {
        updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Parse attributes if sent as a JSON string from FormData
    if (updateData.attributes && typeof updateData.attributes === 'string') {
        try {
            updateData.attributes = JSON.parse(updateData.attributes);
        } catch (e) {
            console.log('Error parsing attributes', e);
            updateData.attributes = [];
        }
    }

    const product = await Product.findOneAndUpdate(
        query,
        { $set: updateData },
        { new: true, runValidators: true }
    );
    if (!product) return errorResponse(res, 'Product not found or not yours', StatusCodes.NOT_FOUND);
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
    return successResponse(res, null, 'Product deleted');
});
