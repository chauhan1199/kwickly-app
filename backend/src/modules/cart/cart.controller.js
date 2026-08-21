const { StatusCodes } = require('http-status-codes');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const Shop = require('../shop/shop.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

const calculateCart = (cart, shop) => {
    if (!cart || !cart.items || cart.items.length === 0) {
        cart.subtotal = 0;
        cart.deliveryCharge = 0;
        cart.discount = 0;
        cart.totalAmount = 0;
        return cart;
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + (i.price * i.qty), 0);

    const cfg = shop?.deliveryConfig || shop?.delivery || {};
    const freeAbove = Number(cfg.freeDeliveryAbove ?? cfg.freeAbove ?? 1000);
    const charge = Number(cfg.deliveryCharge ?? cfg.fee ?? 40);

    cart.deliveryCharge = cart.subtotal >= freeAbove ? 0 : charge;

    // Auto shop discount if enabled
    let autoDiscount = 0;
    if (cfg.discountEnabled && cart.subtotal >= (cfg.discountAbove || 500)) {
        if (cfg.discountType === 'percent') {
            const pct = Number(cfg.discountPct || 10);
            const cap = Number(cfg.maxDiscountCap || 200);
            autoDiscount = Math.min(Math.round((cart.subtotal * pct) / 100), cap);
        } else {
            autoDiscount = Number(cfg.discountValue || 50);
        }
    }

    if (!cart.discount || cart.discount < autoDiscount) {
        cart.discount = autoDiscount;
    }

    cart.totalAmount = Math.max(0, cart.subtotal + cart.deliveryCharge - (cart.discount || 0));
    return cart;
};

exports.getCart = catchAsync(async (req, res) => {
    let cart = await Cart.findOne({ customerId: req.user._id })
        .populate('shopId', 'name logoUrl deliveryConfig delivery address location rating')
        .populate('items.productId', 'name price imageUrl stock isActive');

    if (!cart) return successResponse(res, null, 'Cart is empty');
    if (cart.expiresAt < new Date()) {
        await Cart.deleteOne({ _id: cart._id });
        return successResponse(res, null, 'Cart has expired');
    }

    calculateCart(cart, cart.shopId);
    await cart.save();

    return successResponse(res, cart, 'Cart fetched');
});

exports.addToCart = catchAsync(async (req, res) => {
    const { shopId, productId, qty } = req.body;
    const customerId = req.user._id;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
        return errorResponse(res, 'Product not found', StatusCodes.NOT_FOUND);
    }
    if (product.stock < qty) {
        return errorResponse(res, 'Product out of stock', StatusCodes.UNPROCESSABLE_ENTITY);
    }

    const shop = await Shop.findById(shopId);
    if (!shop || shop.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'Shop not approved', StatusCodes.FORBIDDEN);
    }

    let cart = await Cart.findOne({ customerId });
    if (cart && cart.shopId.toString() !== shopId) {
        return errorResponse(
            res,
            `Your cart has items from another shop. Clear cart to order from this shop.`,
            StatusCodes.CONFLICT
        );
    }

    if (!cart) {
        cart = new Cart({
            customerId,
            shopId,
            items: [{ productId, name: product.name, price: product.price, qty, imageUrl: product.imageUrl, stockAtAdd: product.stock }],
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
    } else {
        const existingItem = cart.items.find(i => i.productId.toString() === productId);
        if (existingItem) {
            existingItem.qty += qty;
            existingItem.price = product.price;
            existingItem.stockAtAdd = product.stock;
        } else {
            cart.items.push({ productId, name: product.name, price: product.price, qty, imageUrl: product.imageUrl, stockAtAdd: product.stock });
        }
        cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    calculateCart(cart, shop);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
        .populate('shopId', 'name logoUrl deliveryConfig delivery address location rating')
        .populate('items.productId', 'name price imageUrl stock isActive');

    return successResponse(res, populatedCart, 'Item added to cart', StatusCodes.CREATED);
});

exports.updateCartItem = catchAsync(async (req, res) => {
    const { qty } = req.body;
    if (qty === undefined || qty === null) {
        return errorResponse(res, 'Quantity is required', StatusCodes.BAD_REQUEST);
    }
    const cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart) return errorResponse(res, 'Cart not found', StatusCodes.NOT_FOUND);

    const item = cart.items.id(req.params.itemId);
    if (!item) return errorResponse(res, 'Item not found in cart', StatusCodes.NOT_FOUND);

    if (qty <= 0) {
        cart.items.pull(req.params.itemId);
    } else {
        // Check stock availability
        const Product = require('../product/product.model');
        const product = await Product.findById(item.productId).select('stock');
        if (product && product.stock < qty) {
            return errorResponse(res, `Only ${product.stock} items available in stock`, StatusCodes.BAD_REQUEST);
        }
        item.qty = qty;
    }

    if (cart.items.length === 0) {
        await Cart.deleteOne({ _id: cart._id });
        return successResponse(res, null, 'Cart cleared');
    }

    const shop = await Shop.findById(cart.shopId);
    calculateCart(cart, shop);
    cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
        .populate('shopId', 'name logoUrl deliveryConfig delivery address location rating')
        .populate('items.productId', 'name price imageUrl stock isActive');

    return successResponse(res, populatedCart, 'Cart updated');
});

exports.removeCartItem = catchAsync(async (req, res) => {
    const cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart) return errorResponse(res, 'Cart not found', StatusCodes.NOT_FOUND);

    cart.items.pull(req.params.itemId);
    if (cart.items.length === 0) {
        await Cart.deleteOne({ _id: cart._id });
        return successResponse(res, null, 'Cart cleared');
    }

    const shop = await Shop.findById(cart.shopId);
    calculateCart(cart, shop);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
        .populate('shopId', 'name logoUrl deliveryConfig delivery address location rating')
        .populate('items.productId', 'name price imageUrl stock isActive');

    return successResponse(res, populatedCart, 'Item removed');
});

exports.clearCart = catchAsync(async (req, res) => {
    await Cart.deleteOne({ customerId: req.user._id });
    return successResponse(res, null, 'Cart cleared');
});

