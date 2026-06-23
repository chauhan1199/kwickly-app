const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const ShopOrder  = require('./shoporder.model');
const Shop       = require('../shop/shop.model');
const Product    = require('../product/product.model');
const Customer   = require('../customer/customer.model');
const WalletTxn  = require('../wallet/wallet.model');
const Promotion  = require('../promotion/promotion.model');
const Settlement = require('../settlement/settlement.model');
const AppSettings = require('../settings/settings.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { delCache } = require('../../helpers/redis.helper');
const { collectCommission } = require('../adminWallet/adminWallet.controller');

/**
 * POST /api/v1/shoporders
 * Customer places a shop order with ATOMIC stock reservation
 */
exports.placeOrder = catchAsync(async (req, res) => {
    const { shopId, items, deliveryAddress, deliveryLocation, paymentMethod, promoCode } = req.body;

    if (!items || items.length === 0) {
        return errorResponse(res, 'Order must contain at least one item', StatusCodes.BAD_REQUEST);
    }

    const shop = await Shop.findById(shopId);
    if (!shop || !shop.isOnline) return errorResponse(res, 'Shop is not available', StatusCodes.BAD_REQUEST);
    if (shop.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'Shop is not approved to receive orders.', StatusCodes.FORBIDDEN);
    }

    // P0 FIX: Validate stock and atomically reserve it BEFORE creating the order
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
        // Atomically decrement stock for each item — if any item has insufficient stock, the whole operation fails
        for (const item of items) {
            if (!item.productId) continue;

            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, shopId, stock: { $gte: item.qty }, isActive: true },
                { $inc: { stock: -item.qty } },
                { new: true, session }
            );

            if (!updated) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(
                    res,
                    `Product "${item.name}" is out of stock or unavailable. Please update your cart.`,
                    StatusCodes.CONFLICT
                );
            }
        }

        // Calculate totals
        const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
        const deliveryFee = subtotal >= shop.delivery.freeAbove ? 0 : shop.delivery.fee;

        // Apply promo code discount if provided
        let discount = 0;
        let promoDetails = null;
        if (promoCode) {
            const promo = await Promotion.findOne({ code: promoCode.toUpperCase(), isActive: true });
            if (!promo) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Invalid promo code', StatusCodes.BAD_REQUEST);
            }
            if (promo.endAt && promo.endAt < new Date()) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Promo code expired', StatusCodes.BAD_REQUEST);
            }
            if (promo.maxUsesTotal && promo.usesCount >= promo.maxUsesTotal) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Promo code usage limit reached', StatusCodes.BAD_REQUEST);
            }
            if (subtotal < promo.minOrderAmount) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, `Minimum order ₹${promo.minOrderAmount} required for this promo`, StatusCodes.BAD_REQUEST);
            }

            if (promo.type === 'FLAT_DISCOUNT') {
                discount = promo.value;
            } else if (promo.type === 'PERCENTAGE_DISCOUNT') {
                discount = (subtotal * promo.value) / 100;
                if (promo.maxDiscountCap) discount = Math.min(discount, promo.maxDiscountCap);
            }
            discount = Math.min(discount, subtotal); // Discount cannot exceed subtotal

            // Increment promo usage
            await Promotion.findByIdAndUpdate(promo._id, { $inc: { usesCount: 1 } });
            promoDetails = { code: promo.code, discount, type: promo.type, title: promo.title };
        }

        const total = subtotal + deliveryFee - discount;

        // Handle wallet payment atomically
        let paymentStatus = 'PENDING';
        if (paymentMethod === 'WALLET') {
            const customer = await Customer.findOneAndUpdate(
                { _id: req.user._id, 'wallet.balance': { $gte: total } },
                { $inc: { 'wallet.balance': -total } },
                { new: true, session }
            );

            if (!customer) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
            }

            await WalletTxn.create([{
                userId: req.user._id,
                type: 'ORDER_PAYMENT',
                amount: total,
                balance: customer.wallet.balance,
                status: 'COMPLETED',
                description: `Order payment to ${shop.name}`
            }], { session });

            paymentStatus = 'PAID';
            await delCache(`session:${req.user._id}`);
        }

        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const orderCount = await ShopOrder.countDocuments();
        const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

        const [order] = await ShopOrder.create([{
            orderNumber,
            shopId,
            customerId: req.user._id,
            items,
            subtotal,
            deliveryFee,
            discount,
            total,
            deliveryAddress,
            deliveryLocation,
            deliveryOtp,
            payment: { amount: total, status: paymentStatus, method: paymentMethod || 'WALLET' },
            promoCode: promoDetails?.code || undefined,
            promoDiscount: discount > 0 ? discount : undefined,
            statusHistory: [{ status: 'NEW', timestamp: new Date(), note: 'Order placed' }]
        }], { session });

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        // Notify shop owner
        emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: order._id, total });
        emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP_ORDER', id: order._id });

        return successResponse(res, order, 'Order placed successfully', StatusCodes.CREATED);

    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

/**
 * GET /api/v1/shoporders/customer
 */
exports.getCustomerOrders = catchAsync(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await ShopOrder.countDocuments({ customerId: req.user._id });
    const orders = await ShopOrder.find({ customerId: req.user._id })
        .populate('shopId', 'name logoUrl address')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { orders, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Orders fetched');
});

/**
 * GET /api/v1/shoporders/shop
 */
exports.getShopOrders = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id }).select('_id');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const { status, page = 1, limit = 20 } = req.query;
    const query = { shopId: shop._id };
    if (status && status !== 'all') query.status = status.toUpperCase();

    const total = await ShopOrder.countDocuments(query);
    const orders = await ShopOrder.find(query)
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { orders, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Shop orders fetched');
});

/**
 * GET /api/v1/shoporders/:id
 */
exports.getOrderById = catchAsync(async (req, res) => {
    const order = await ShopOrder.findById(req.params.id)
        .populate('shopId', 'name logoUrl address phone')
        .populate('customerId', 'name phone')
        .lean();

    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
    return successResponse(res, order, 'Order fetched');
});

/**
 * GET /api/v1/shoporders/:id/invoice
 */
exports.downloadInvoice = catchAsync(async (req, res) => {
    const order = await ShopOrder.findById(req.params.id)
        .populate('shopId', 'name address phone')
        .populate('customerId', 'name phone email')
        .lean();

    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);

    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${order._id.toString().slice(-6).toUpperCase()}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1a1a2e; background: #f8fafc; }
        .page { background: #fff; max-width: 750px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0e9aa7, #43e3eb); padding: 32px 40px; color: white; }
        .header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { opacity: 0.85; font-size: 13px; margin-top: 4px; }
        .body { padding: 32px 40px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
        .meta-box h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
        .meta-box p { font-size: 14px; color: #1a1a2e; line-height: 1.6; }
        .meta-box .name { font-weight: 700; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
        .totals { border-top: 2px solid #e2e8f0; padding-top: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #475569; }
        .total-row.grand { font-size: 18px; font-weight: 800; color: #0e9aa7; padding-top: 12px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: rgba(14,154,167,0.1); color: #0e9aa7; }
        .footer { text-align: center; padding: 24px 40px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        @media print { body { background: #fff; padding: 0; } .page { box-shadow: none; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>⚡ Kwickly Invoice</h1>
            <p>Order #${order._id.toString().slice(-6).toUpperCase()} · ${orderDate} · <span class="status-badge" style="background:rgba(255,255,255,0.2);color:#fff;">${order.status}</span></p>
        </div>
        <div class="body">
            <div class="meta-grid">
                <div class="meta-box">
                    <h4>From (Shop)</h4>
                    <p class="name">${order.shopId?.name || 'Shop'}</p>
                    <p>${order.shopId?.address || ''}</p>
                    <p>${order.shopId?.phone || ''}</p>
                </div>
                <div class="meta-box" style="text-align:right">
                    <h4>To (Customer)</h4>
                    <p class="name">${order.customerId?.name || 'Customer'}</p>
                    <p>${order.deliveryAddress || ''}</p>
                    <p>${order.customerId?.phone || ''}</p>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th style="text-align:right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.qty}</td>
                        <td>₹${item.price.toFixed(2)}</td>
                        <td style="text-align:right;font-weight:600">₹${(item.price * item.qty).toFixed(2)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="totals">
                <div class="total-row"><span>Subtotal</span><span>₹${order.subtotal.toFixed(2)}</span></div>
                <div class="total-row"><span>Delivery Fee</span><span>₹${order.deliveryFee.toFixed(2)}</span></div>
                <div class="total-row grand"><span>Grand Total</span><span>₹${order.total.toFixed(2)}</span></div>
            </div>
        </div>
        <div class="footer">
            <p>Thank you for shopping with Kwickly! 🙏</p>
            <button class="no-print" onclick="window.print()" style="margin-top:12px;padding:10px 24px;background:#0e9aa7;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Print / Save as PDF</button>
        </div>
    </div>
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

/**
 * POST /api/v1/shoporders/:id/cancel
 * Customer cancels their own order (only if NEW status)
 */
exports.cancelOrder = catchAsync(async (req, res) => {
    const order = await ShopOrder.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
    if (order.status !== 'NEW') return errorResponse(res, 'Only new orders can be cancelled', StatusCodes.BAD_REQUEST);

    // Restore stock
    for (const item of order.items) {
        if (item.productId) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
        }
    }

    // Refund if paid
    if (order.payment.status === 'PAID') {
        const refundedCustomer = await Customer.findByIdAndUpdate(order.customerId, {
            $inc: { 'wallet.balance': order.total }
        }, { new: true });
        await WalletTxn.create({
            userId: order.customerId,
            type: 'REFUND',
            amount: order.total,
            balance: refundedCustomer?.wallet?.balance || 0,
            refId: String(order._id),
            status: 'COMPLETED',
            description: `Refund for cancelled order #${String(order._id).slice(-6)}`
        });
        await delCache(`session:${order.customerId}`);
    }

    order.status = 'CANCELLED';
    order.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Cancelled by customer' });
    await order.save();

    // Notify shop
    emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', { orderId: order._id, status: 'CANCELLED' });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

    return successResponse(res, order, 'Order cancelled successfully');
});

/**
 * PATCH /api/v1/shoporders/:id/status
 */
exports.updateOrderStatus = catchAsync(async (req, res) => {
    const { status, otp, note } = req.body;
    const validStatuses = ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status', StatusCodes.BAD_REQUEST);

    let order;
    let shop;
    if (req.user.role === 'ADMIN') {
        order = await ShopOrder.findById(req.params.id);
        if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
        shop = await Shop.findById(order.shopId).select('_id wallet ownerId');
    } else {
        shop = await Shop.findOne({ ownerId: req.user._id }).select('_id wallet ownerId');
        if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
        order = await ShopOrder.findOne({ _id: req.params.id, shopId: shop._id });
        if (!order) return errorResponse(res, 'Order not found or not authorized', StatusCodes.NOT_FOUND);
    }

    order.statusHistory.push({ status, timestamp: new Date(), note: note || `Status changed to ${status}` });

    if (status === 'DELIVERED') {
        if (!otp || String(otp) !== String(order.deliveryOtp)) {
            return errorResponse(res, 'Invalid delivery OTP. Please ask the customer for the correct OTP.', StatusCodes.BAD_REQUEST);
        }

        // Calculate commission and shop earning
        const cfg = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        const commissionPercent = cfg?.fees?.percentage ?? 10;
        const commission = Math.round(order.total * commissionPercent / 100);
        const shopPayout = order.total - commission;

        // Create a PENDING settlement (admin reviews and settles later)
        await Settlement.create({
            type: 'PRODUCT_ORDER',
            orderId: order._id,
            shopId: shop._id,
            customerId: order.customerId,
            totalAmount: order.total,
            platformCommission: commission,
            shopEarning: shopPayout,
            status: 'PENDING'
        });

        // Increment shop total orders count (wallet credited on settlement)
        await Shop.findByIdAndUpdate(shop._id, { $inc: { totalOrders: 1 } });

        order.status = 'DELIVERED';
        order.payment.status = 'PAID';
        await order.save();
    } else if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        // Restore stock for all items
        for (const item of order.items) {
            if (item.productId) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
            }
        }

        // Refund to customer wallet if payment was already made
        if (order.payment.status === 'PAID') {
            const refundedCustomer = await Customer.findByIdAndUpdate(order.customerId, {
                $inc: { 'wallet.balance': order.total }
            }, { new: true });
            await WalletTxn.create({
                userId: order.customerId,
                type: 'REFUND',
                amount: order.total,
                balance: refundedCustomer?.wallet?.balance || 0,
                refId: String(order._id),
                status: 'COMPLETED',
                description: `Refund for cancelled order #${String(order._id).slice(-6)}`
            });
            await delCache(`session:${order.customerId}`);
        }

        order.status = status;
        await order.save();
    } else {
        order.status = status;
        await order.save();
    }

    // Notify customer in real-time
    emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', { orderId: order._id, status });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

    return successResponse(res, order, 'Order status updated');
});

/**
 * GET /api/v1/shoporders (Admin)
 */
exports.getAllOrders = catchAsync(async (req, res) => {
    const { status, page = 1, limit = 20, shopId } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();
    if (shopId) query.shopId = shopId;

    const total = await ShopOrder.countDocuments(query);
    const orders = await ShopOrder.find(query)
        .populate('shopId', 'name')
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { orders, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'All orders fetched');
});
