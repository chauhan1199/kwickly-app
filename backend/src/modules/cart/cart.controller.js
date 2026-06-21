const { StatusCodes } = require('http-status-codes');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const Shop = require('../shop/shop.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

exports.getCart = catchAsync(async (req, res) => {
    const cart = await Cart.findOne({ customerId: req.user._id })
        .populate('shopId', 'name logoUrl')
        .populate('items.productId', 'name price imageUrl stock isActive');

    if (!cart) return successResponse(res, null, 'Cart is empty');
    if (cart.expiresAt < new Date()) {
        await Cart.deleteOne({ _id: cart._id });
        return successResponse(res, null, 'Cart has expired');
    }

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
    if (!shop || shop.status !== 'APPROVED') {
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
        cart = await Cart.create({
            customerId,
            shopId,
            items: [{ productId, name: product.name, price: product.sellingPrice || product.price, qty, imageUrl: product.imageUrl, stockAtAdd: product.stock }],
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
    } else {
        const existingItem = cart.items.find(i => i.productId.toString() === productId);
        if (existingItem) {
            existingItem.qty += qty;
            existingItem.price = product.sellingPrice || product.price;
            existingItem.stockAtAdd = product.stock;
        } else {
            cart.items.push({ productId, name: product.name, price: product.sellingPrice || product.price, qty, imageUrl: product.imageUrl, stockAtAdd: product.stock });
        }
        cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    cart.totalAmount = cart.subtotal + cart.deliveryCharge - cart.discount;
    await cart.save();

    return successResponse(res, cart, 'Item added to cart', StatusCodes.CREATED);
});

exports.updateCartItem = catchAsync(async (req, res) => {
    const { qty } = req.body;
    const cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart) return errorResponse(res, 'Cart not found', StatusCodes.NOT_FOUND);

    const item = cart.items.id(req.params.itemId);
    if (!item) return errorResponse(res, 'Item not found in cart', StatusCodes.NOT_FOUND);

    if (qty <= 0) {
        cart.items.pull(req.params.itemId);
    } else {
        item.qty = qty;
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    cart.totalAmount = cart.subtotal + cart.deliveryCharge - cart.discount;
    cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await cart.save();

    return successResponse(res, cart, 'Cart updated');
});

exports.removeCartItem = catchAsync(async (req, res) => {
    const cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart) return errorResponse(res, 'Cart not found', StatusCodes.NOT_FOUND);

    cart.items.pull(req.params.itemId);
    if (cart.items.length === 0) {
        await Cart.deleteOne({ _id: cart._id });
        return successResponse(res, null, 'Cart cleared');
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    cart.totalAmount = cart.subtotal + cart.deliveryCharge - cart.discount;
    await cart.save();

    return successResponse(res, cart, 'Item removed');
});

exports.clearCart = catchAsync(async (req, res) => {
    await Cart.deleteOne({ customerId: req.user._id });
    return successResponse(res, null, 'Cart cleared');
});
