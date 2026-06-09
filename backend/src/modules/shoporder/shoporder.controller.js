const { StatusCodes } = require('http-status-codes');
const ShopOrder  = require('./shoporder.model');
const Shop       = require('../shop/shop.model');
const Customer   = require('../customer/customer.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');

/**
 * POST /api/v1/shoporders
 * Customer places a shop order
 */
exports.placeOrder = catchAsync(async (req, res) => {
    const { shopId, items, deliveryAddress, deliveryLocation } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop || !shop.isOnline) return errorResponse(res, 'Shop is not available', StatusCodes.BAD_REQUEST);

    if (shop.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'Shop is not approved to receive orders.', StatusCodes.FORBIDDEN);
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const deliveryFee = subtotal >= shop.delivery.freeAbove ? 0 : shop.delivery.fee;
    const total = subtotal + deliveryFee;

    // Generate 4-digit delivery OTP
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const order = await ShopOrder.create({
        shopId,
        customerId: req.user._id,
        items,
        subtotal,
        deliveryFee,
        total,
        deliveryAddress,
        deliveryLocation,
        deliveryOtp,
        payment: { amount: total }
    });

    // Notify shop owner
    emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: order._id, total });
    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP_ORDER', id: order._id });

    return successResponse(res, order, 'Order placed successfully', StatusCodes.CREATED);
});

/**
 * GET /api/v1/shoporders/customer
 * Customer order history
 */
exports.getCustomerOrders = catchAsync(async (req, res) => {
    const orders = await ShopOrder.find({ customerId: req.user._id })
        .populate('shopId', 'name logoUrl')
        .sort('-createdAt');
    return successResponse(res, orders, 'Orders fetched');
});

/**
 * GET /api/v1/shoporders/shop
 * Shop dashboard order list
 */
exports.getShopOrders = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const { status } = req.query;
    const query = { shopId: shop._id };
    if (status && status !== 'all') query.status = status.toUpperCase();

    const orders = await ShopOrder.find(query)
        .populate('customerId', 'name phone')
        .sort('-createdAt');
    return successResponse(res, orders, 'Shop orders fetched');
});

/**
 * GET /api/v1/shoporders/:id
 */
exports.getOrderById = catchAsync(async (req, res) => {
    const order = await ShopOrder.findById(req.params.id)
        .populate('shopId', 'name logoUrl address')
        .populate('customerId', 'name phone');
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
    return successResponse(res, order, 'Order fetched');
});

/**
 * PATCH /api/v1/shoporders/:id/status
 * Shop owner advances the order status
 */
exports.updateOrderStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status', StatusCodes.BAD_REQUEST);

    const order = await ShopOrder.findById(req.params.id);
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);

    order.status = status;

    // On delivery, credit shop wallet
    if (status === 'DELIVERED') {
        const mongoose = require('mongoose');
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            order.payment.status = 'PAID';
            const settings = require('../settings/settings.model');
            const cfg = await settings.findOne().session(session) || { commissionPercent: 10 };
            const commission = Math.round(order.total * cfg.commissionPercent / 100);
            const shopPayout = order.total - commission;

            const updatedShop = await Shop.findByIdAndUpdate(
                order.shopId,
                { $inc: { 'wallet.balance': shopPayout, totalOrders: 1 } },
                { new: true, session }
            );

            await WalletTxn.create([{
                userId:      order.shopId, // Will need to be mapped to customerId or keep as shop ID depending on WalletTxn schema
                type:        'ORDER_CREDIT',
                amount:      shopPayout,
                balance:     updatedShop.wallet.balance,
                refId:       String(order._id),
                description: `Order #${String(order._id).slice(-6)} payout`
            }], { session });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();
        } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
            throw error;
        }
    } else {
        await order.save();
    }

    // Notify customer
    emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', { orderId: order._id, status });

    return successResponse(res, order, 'Order status updated');
});

/**
 * GET /api/v1/shoporders (Admin)
 */
exports.getAllOrders = catchAsync(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();

    const total = await ShopOrder.countDocuments(query);
    const orders = await ShopOrder.find(query)
        .populate('shopId', 'name')
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    return successResponse(res, { orders, total, page, totalPages: Math.ceil(total / limit) }, 'All orders fetched');
});
