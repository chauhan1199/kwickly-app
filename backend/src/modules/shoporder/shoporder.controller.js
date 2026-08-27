const crypto = require('crypto');
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
const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
const catchAsync = require('../../helpers/async.helper');
const logger = require('../../helpers/logger.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { delCache } = require('../../helpers/redis.helper');
const { collectCommission } = require('../adminWallet/adminWallet.service');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { OTP_MIN, OTP_MAX, OTP_TTL } = require('../../constants/business');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * POST /api/v1/shoporders
 * Customer places a shop order with ATOMIC stock reservation
 */
exports.placeOrder = catchAsync(async (req, res) => {
    const { shopId, items, deliveryAddress, deliveryLocation, paymentMethod, promoCode, deliverySlot } = req.body;

    if (!items || items.length === 0) {
        return errorResponse(res, 'Order must contain at least one item', StatusCodes.BAD_REQUEST);
    }

    const shop = await Shop.findById(shopId);
    if (!shop || !shop.isOnline) return errorResponse(res, 'Shop is not available', StatusCodes.BAD_REQUEST);
    if (shop.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'Shop is not approved to receive orders.', StatusCodes.FORBIDDEN);
    }

    // P0 FIX: Validate stock and atomically reserve it BEFORE creating the order
    let session = null, useTransaction = false;
    if (supportsTransactions()) { try { session = await mongoose.startSession(); session.startTransaction(); useTransaction = true; } catch (e) { session = null; useTransaction = false; } }

    try {
        const sessOpts = useTransaction ? { session } : {};

        // P0 FIX: Fetch actual products from DB to use verified prices instead of client-supplied prices
        const productIds = items.filter(i => i.productId).map(i => i.productId);
        const dbProducts = await Product.find({ _id: { $in: productIds }, shopId, isActive: true }).lean();
        const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));

        // Validate all products exist and have sufficient stock, using DB prices
        for (const item of items) {
            if (!item.productId) continue;
            const dbProduct = productMap.get(item.productId.toString());
            if (!dbProduct || dbProduct.stock < item.qty) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(
                    res,
                    `Product "${item.name}" is out of stock or unavailable. Please update your cart.`,
                    StatusCodes.CONFLICT
                );
            }
            // Replace client-supplied price with verified database price
            item.price = dbProduct.price;
        }

        // Atomically decrement stock for each item â€” if any item has insufficient stock, the whole operation fails
        for (const item of items) {
            if (!item.productId) continue;

            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, shopId, stock: { $gte: item.qty }, isActive: true },
                { $inc: { stock: -item.qty } },
                { returnDocument: 'after', ...sessOpts }
            );

            if (!updated) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(
                    res,
                    `Product "${item.name}" is out of stock or unavailable. Please update your cart.`,
                    StatusCodes.CONFLICT
                );
            }
        }

        // Calculate totals using verified database prices
        const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
        const cfg = shop.deliveryConfig || shop.delivery || {};
        const freeAbove = Number(cfg.freeDeliveryAbove ?? cfg.freeAbove ?? 1000);
        const charge = Number(cfg.deliveryCharge ?? cfg.fee ?? 40);
        const deliveryFee = subtotal >= freeAbove ? 0 : charge;

        // Minimum order amount validation
        const minOrder = Number(cfg.minOrderAmount ?? cfg.minOrder ?? 0);
        if (minOrder > 0 && subtotal < minOrder) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(
                res,
                `Minimum order amount for ${shop.name} is ₹${minOrder}. Please add items worth ₹${minOrder - subtotal} more.`,
                StatusCodes.BAD_REQUEST
            );
        }

        // Apply promo code discount if provided
        let discount = 0;
        let promoDetails = null;
        if (promoCode) {
            const promo = await Promotion.findOne({ code: promoCode.toUpperCase(), isActive: true });
            if (!promo) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Invalid promo code', StatusCodes.BAD_REQUEST);
            }
            if (promo.endAt && promo.endAt < new Date()) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Promo code expired', StatusCodes.BAD_REQUEST);
            }
            if (promo.maxUsesTotal && promo.usesCount >= promo.maxUsesTotal) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Promo code usage limit reached', StatusCodes.BAD_REQUEST);
            }
            if (subtotal < promo.minOrderAmount) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, `Minimum order ₹${promo.minOrderAmount} required for this promo`, StatusCodes.BAD_REQUEST);
            }

            if (promo.type === 'FLAT_DISCOUNT') {
                discount = promo.value;
            } else if (promo.type === 'PERCENTAGE_DISCOUNT') {
                discount = Math.round((subtotal * promo.value) / 100);
                if (promo.maxDiscountCap) discount = Math.min(discount, promo.maxDiscountCap);
            }
            discount = Math.min(discount, subtotal); // Discount cannot exceed subtotal

            // Increment promo usage
            await Promotion.findByIdAndUpdate(promo._id, { $inc: { usesCount: 1 } });
            promoDetails = { code: promo.code, discount, type: promo.type, title: promo.title };
        } else if (cfg.discountEnabled && subtotal >= (cfg.discountAbove || 500)) {
            // Auto shop discount
            if (cfg.discountType === 'percent') {
                const pct = Number(cfg.discountPct || 10);
                const cap = Number(cfg.maxDiscountCap || 200);
                discount = Math.min(Math.round((subtotal * pct) / 100), cap);
            } else {
                discount = Number(cfg.discountValue || 50);
            }
            discount = Math.min(discount, subtotal);
            if (discount > 0) {
                promoDetails = { code: 'SHOP_OFFER', discount, type: cfg.discountType === 'percent' ? 'PERCENTAGE_DISCOUNT' : 'FLAT_DISCOUNT', title: `${cfg.discountPct || 10}% Shop Discount` };
            }
        }

        const total = Math.max(0, subtotal + deliveryFee - discount);

        // Handle wallet payment atomically
        let paymentStatus = 'PENDING';
        if (paymentMethod === 'WALLET') {
            const customer = await Customer.findOneAndUpdate(
                { _id: req.user._id, 'wallet.balance': { $gte: total } },
                { $inc: { 'wallet.balance': -total } },
                { returnDocument: 'after', ...sessOpts }
            );

            if (!customer) {
                if (useTransaction && session) await session.abortTransaction();
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
            }], sessOpts);

            paymentStatus = 'PAID';
            await delCache(`session:${req.user._id}`);
        }

        const deliveryOtp = crypto.randomInt(OTP_MIN, OTP_MAX).toString();
        // Use timestamp + random to avoid collisions from countDocuments() race conditions
        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const orderNumber = `ORD-${ts}-${rand}`;

        // Format deliverySlot
        let slotData = { time: 'Standard Delivery', date: new Date().toISOString().split('T')[0], notes: '' };
        if (typeof deliverySlot === 'string' && deliverySlot.trim()) {
            slotData.time = deliverySlot.trim();
        } else if (deliverySlot && typeof deliverySlot === 'object') {
            slotData = {
                time: deliverySlot.time || deliverySlot.label || deliverySlot.value || 'Standard Delivery',
                date: deliverySlot.date || new Date().toISOString().split('T')[0],
                notes: deliverySlot.notes || ''
            };
        }

        // Validate that chosen slot for today is not in the past
        const todayStr = new Date().toISOString().split('T')[0];
        if (slotData.date === todayStr && slotData.time) {
            const timeMatch = slotData.time.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const endHour = parseInt(timeMatch[3], 10);
                const endMin = parseInt(timeMatch[4], 10);
                const now = new Date();
                const istOffset = 5.5 * 60 * 60 * 1000;
                const istTime = new Date(now.getTime() + (now.getTimezoneOffset() === 0 ? istOffset : 0));
                const currentMinutes = istTime.getHours() * 60 + istTime.getMinutes();
                const slotEndMinutes = endHour * 60 + endMin;

                if (currentMinutes >= slotEndMinutes) {
                    if (useTransaction && session) await session.abortTransaction();
                    if (session) session.endSession();
                    return errorResponse(res, `Selected delivery slot "${slotData.time}" has already passed for today. Please select an upcoming slot or choose tomorrow.`, StatusCodes.BAD_REQUEST);
                }
            }
        }

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
            deliverySlot: slotData,
            deliveryOtp,
            deliveryOtpGeneratedAt: new Date(),
            payment: { amount: total, status: paymentStatus, method: paymentMethod || 'WALLET' },
            promoCode: promoDetails?.code || undefined,
            promoDiscount: discount > 0 ? discount : undefined,
            statusHistory: [{ status: 'NEW', timestamp: new Date(), note: 'Order placed' }]
        }], sessOpts);

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();

        // Notify shop owner
        emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: order._id, total });
        emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP_ORDER', id: order._id });

        // Notify customer: order placed
        notifyUser({
            userId: req.user._id,
            title: 'Order Placed Successfully',
            message: `Your order has been placed with ${shop.name}. Total: ₹${total}. Order ID: #${String(order._id).slice(-6).toUpperCase()}`,
            action: 'ORDER_PLACED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'CUSTOMER'
        });

        return successResponse(res, order, 'Order placed successfully', StatusCodes.CREATED);

    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
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

    // RBAC Security Check — Shop owners are identified by ownerId, not shopId on user
    const orderCustomerId = order.customerId?._id?.toString() || order.customerId?.toString();
    const orderShopId = order.shopId?._id?.toString() || order.shopId?.toString();
    
    let isShopOwner = false;
    if (req.user.role === 'SHOP' && orderShopId) {
        const Shop = require('../shop/shop.model');
        const shop = await Shop.findById(orderShopId).select('ownerId').lean();
        isShopOwner = shop && shop.ownerId?.toString() === req.user._id.toString();
    }

    if (req.user.role !== 'ADMIN' && 
        orderCustomerId !== req.user._id.toString() && 
        !isShopOwner) {
        return errorResponse(res, 'Unauthorized access to this order', StatusCodes.FORBIDDEN);
    }
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

    // RBAC Security Check — Shop owners are identified by ownerId, not shopId on user
    const invoiceCustomerId = order.customerId?._id?.toString() || order.customerId?.toString();
    const invoiceShopId = order.shopId?._id?.toString() || order.shopId?.toString();

    let isInvoiceShopOwner = false;
    if (req.user.role === 'SHOP' && invoiceShopId) {
        const Shop = require('../shop/shop.model');
        const shop = await Shop.findById(invoiceShopId).select('ownerId').lean();
        isInvoiceShopOwner = shop && shop.ownerId?.toString() === req.user._id.toString();
    }

    if (req.user.role !== 'ADMIN' && 
        invoiceCustomerId !== req.user._id.toString() && 
        !isInvoiceShopOwner) {
        return errorResponse(res, 'Unauthorized access to this invoice', StatusCodes.FORBIDDEN);
    }

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
            <p>Order #${order._id.toString().slice(-6).toUpperCase()} · ${orderDate} · <span class="status-badge" style="background:rgba(255,255,255,0.2);color:#fff;">${escapeHtml(order.status)}</span></p>
        </div>
        <div class="body">
            <div class="meta-grid">
                <div class="meta-box">
                    <h4>From (Shop)</h4>
                    <p class="name">${escapeHtml(order.shopId?.name || 'Shop')}</p>
                    <p>${escapeHtml(order.shopId?.address || '')}</p>
                    <p>${escapeHtml(order.shopId?.phone || '')}</p>
                </div>
                <div class="meta-box" style="text-align:right">
                    <h4>To (Customer)</h4>
                    <p class="name">${escapeHtml(order.customerId?.name || 'Customer')}</p>
                    <p>${escapeHtml(order.deliveryAddress || '')}</p>
                    <p>${escapeHtml(order.customerId?.phone || '')}</p>
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
                        <td>${escapeHtml(item.name)}</td>
                        <td>${item.qty}</td>
                        <td>₹${escapeHtml(item.price.toFixed(2))}</td>
                        <td style="text-align:right;font-weight:600">₹${escapeHtml((item.price * item.qty).toFixed(2))}</td>
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
            <p>Thank you for shopping with Kwickly! 😊</p>
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
    // Atomic status check: only cancel if order is in NEW or CONFIRMED state
    const order = await ShopOrder.findOneAndUpdate(
        { _id: req.params.id, customerId: req.user._id, status: { $in: ['NEW', 'CONFIRMED'] } },
        { status: 'CANCELLED', $push: { statusHistory: { status: 'CANCELLED', timestamp: new Date(), note: 'Cancelled by customer' } } },
        { returnDocument: 'after' }
    );
    if (!order) {
        const existing = await ShopOrder.findOne({ _id: req.params.id, customerId: req.user._id });
        if (!existing) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
        return errorResponse(res, 'Order cannot be cancelled in its current status', StatusCodes.BAD_REQUEST);
    }

    // Restore stock (partial restoration is acceptable)
    for (const item of order.items) {
        if (item.productId) {
            try {
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
            } catch (stockErr) {
                logger.error(`[cancelOrder] Failed to restore stock for product ${item.productId}:`, stockErr);
            }
        }
    }

    // Refund if paid
    if (order.payment.status === 'PAID') {
        const refundedCustomer = await Customer.findByIdAndUpdate(order.customerId, {
            $inc: { 'wallet.balance': order.total }
        }, { returnDocument: 'after' });
        await WalletTxn.create({
            userId: order.customerId,
            type: 'REFUND',
            amount: order.total,
            balance: refundedCustomer?.wallet?.balance ?? 0,
            refId: String(order._id),
            status: 'COMPLETED',
            description: `Refund for cancelled order #${String(order._id).slice(-6)}`
        });
        await delCache(`session:${order.customerId}`);
    }

    // Notify shop
    emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', { orderId: order._id, status: 'CANCELLED' });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

    const Shop = require('../shop/shop.model');
    const shop = await Shop.findById(order.shopId);
    if (shop) {
        notifyUser({
            userId: shop.ownerId,
            title: '❌ Order Cancelled',
            message: `Order #${String(order._id).slice(-6).toUpperCase()} was cancelled by the customer.`,
            action: 'ORDER_CANCELLED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'WORKER'
        });
    }

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

    // Status transition validation
    const validTransitions = {
        NEW:                ['CONFIRMED', 'CANCELLED'],
        CONFIRMED:          ['PACKING', 'CANCELLED'],
        PACKING:            ['OUT_FOR_DELIVERY', 'CANCELLED'],
        OUT_FOR_DELIVERY:   ['DELIVERED', 'CANCELLED'],
        DELIVERED:          ['CANCELLED'],
        CANCELLED:          [],
    };
    const allowedNext = validTransitions[order.status];
    if (!allowedNext) {
        return errorResponse(res, `Cannot transition from status "${order.status}"`, StatusCodes.BAD_REQUEST);
    }
    if (!allowedNext.includes(status)) {
        return errorResponse(res, `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowedNext.join(', ') || 'none'}`, StatusCodes.BAD_REQUEST);
    }

    order.statusHistory.push({ status, timestamp: new Date(), note: note || `Status changed to ${status}` });

    if (status === 'DELIVERED') {
        if (!otp) {
            return errorResponse(res, 'Delivery OTP is required', StatusCodes.BAD_REQUEST);
        }

        // H15: Check OTP expiry (OTP_TTL seconds from generation)
        const otpAge = (Date.now() - new Date(order.deliveryOtpGeneratedAt || order.createdAt).getTime()) / 1000;
        if (otpAge > OTP_TTL) {
            return errorResponse(res, 'Delivery OTP has expired. Please request a new one.', StatusCodes.BAD_REQUEST);
        }

        // H15: Check attempt limit (max 5 attempts per OTP)
        if ((order.deliveryOtpAttempts || 0) >= 5) {
            return errorResponse(res, 'Too many OTP attempts. Please request a new OTP.', StatusCodes.BAD_REQUEST);
        }

        if (String(otp) !== String(order.deliveryOtp)) {
            await ShopOrder.findByIdAndUpdate(order._id, { $inc: { deliveryOtpAttempts: 1 } });
            return errorResponse(res, 'Invalid delivery OTP. Please ask the customer for the correct OTP.', StatusCodes.BAD_REQUEST);
        }

        // Settle Shop Order via Centralized Idempotent Settlement Engine (100% to shop, 0% commission)
        const { settleShopOrderDelivery } = require('../../helpers/settlementEngine.helper');
        await settleShopOrderDelivery({ order });

        order.status = 'DELIVERED';
        if (!order.payment) order.payment = {};
        if (order.payment?.method !== 'CASH') {
            order.payment.status = 'PAID';
        }
        order.payment.escrowStatus = 'SETTLED';
        await order.save();
    } else if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        let session = null, useTransaction = false;
        if (supportsTransactions()) { try { session = await mongoose.startSession(); session.startTransaction(); useTransaction = true; } catch (e) { session = null; useTransaction = false; } }

        try {
            const sessOpts = useTransaction ? { session } : {};
            // Restore stock for all items
            for (const item of order.items) {
                if (item.productId) {
                    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } }, sessOpts);
                }
            }

            // Refund to customer wallet if payment was already made
            if (order.payment.status === 'PAID') {
                const refundedCustomer = await Customer.findByIdAndUpdate(order.customerId, {
                    $inc: { 'wallet.balance': order.total }
                }, { returnDocument: 'after', ...sessOpts });

                await WalletTxn.create([{
                    userId: order.customerId,
                    type: 'REFUND',
                    amount: order.total,
                    balance: refundedCustomer?.wallet?.balance || 0,
                    refId: String(order._id),
                    status: 'COMPLETED',
                    description: `Refund for cancelled order #${String(order._id).slice(-6)}`
                }], sessOpts);
                await delCache(`session:${order.customerId}`);
            }

            // H16: If order was delivered, cancel the associated settlement
            if (order.status === 'DELIVERED') {
                const settlement = await Settlement.findOne({ orderId: order._id, status: { $in: ['PENDING', 'PARTIAL'] } });
                if (settlement) {
                    settlement.status = 'CANCELLED';
                    settlement.note = (settlement.note ? settlement.note + ' | ' : '') + 'Cancelled: order was cancelled after delivery';
                    await settlement.save(sessOpts);
                }
            }

            order.status = status;
            await order.save(sessOpts);

            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();
        } catch (error) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            throw error;
        }
    } else {
        order.status = status;
        await order.save();
    }

    // Notify customer in real-time
    emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', { orderId: order._id, status });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

    // Notify customer via notification
    const statusMessages = {
        CONFIRMED:        { emoji: '✓', msg: 'Your order has been confirmed by the shop and is being prepared.' },
        PACKING:          { emoji: '📦', msg: 'Your order is being packed and will be dispatched soon.' },
        OUT_FOR_DELIVERY: { emoji: '🚚', msg: 'Your order is out for delivery! Prepare your OTP for handover.' },
        DELIVERED:        { emoji: '🎉', msg: 'Your order has been delivered successfully. Enjoy!' },
        CANCELLED:        { emoji: '❌', msg: 'Your order has been cancelled. A refund will be processed if applicable.' },
    };
    const sm = statusMessages[status];
    if (sm) {
        notifyUser({
            userId: order.customerId,
            title: `Order ${status.charAt(0) + status.slice(1).toLowerCase()}`,
            message: sm.msg,
            action: status === 'DELIVERED' ? 'ORDER_DELIVERED' : status === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_UPDATED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'CUSTOMER'
        });
    }

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

/**
 * POST /api/v1/shoporders/:id/verify-payment (Admin / Shop)
 * Confirms that direct UPI payment (UTR) has arrived in the bank account.
 */
exports.verifyShopOrderPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { action = 'approve', reason = 'Fake / Invalid UTR' } = req.body;

    const order = await ShopOrder.findById(id).populate('customerId', 'name phone');
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);

    if (action === 'approve') {
        order.payment.status = 'PAID';
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            note: `Payment verified & confirmed by Admin (UTR: ${order.payment?.utrNumber || 'UPI'})`
        });
        await order.save();

        // Credit Admin Treasury Escrow
        const orderAmount = order.total || 0;
        if (orderAmount > 0) {
            const adminW = await AdminWallet.findOneAndUpdate(
                {},
                { $inc: { balance: orderAmount, totalCollected: orderAmount } },
                { returnDocument: 'after', upsert: true }
            );
            if (adminW) {
                await AdminWalletTxn.create([{
                    type: 'TOPUP',
                    amount: orderAmount,
                    balanceAfter: adminW.balance,
                    description: `Shop Order #${order.orderNumber || order._id} UPI payment verified (UTR: ${order.payment?.utrNumber})`,
                    referenceId: order._id,
                    referenceModel: 'ShopOrder',
                    meta: { userId: order.customerId?._id, orderId: order._id, utr: order.payment?.utrNumber }
                }]);
            }
        }

        // Notify customer
        notifyUser({
            userId: order.customerId?._id || order.customerId,
            title: 'Payment Verified! 🎉',
            message: `Your payment of ₹${order.total} for Order #${order.orderNumber} has been verified and confirmed.`,
            action: 'ORDER_PAYMENT_CONFIRMED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'CUSTOMER'
        });

        emitToRoom(`customer_${order.customerId?._id || order.customerId}`, 'ORDER_STATUS', {
            orderId: order._id,
            status: order.status,
            paymentStatus: 'PAID'
        });
        emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
            orderId: order._id,
            status: order.status,
            paymentStatus: 'PAID'
        });
        emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_PAYMENT_CONFIRMED', id: order._id });

        return successResponse(res, order, 'Payment approved and confirmed successfully');
    } else {
        // Reject fake UTR -> cancel order and restore stock
        for (const item of order.items) {
            if (item.productId) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
            }
        }
        order.status = 'CANCELLED';
        order.payment.status = 'FAILED';
        order.statusHistory.push({
            status: 'CANCELLED',
            timestamp: new Date(),
            note: `Payment rejected: ${reason}`
        });
        await order.save();

        notifyUser({
            userId: order.customerId?._id || order.customerId,
            title: 'Payment Verification Failed ❌',
            message: `Your payment for Order #${order.orderNumber} could not be verified (${reason}). The order has been cancelled.`,
            action: 'ORDER_CANCELLED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'CUSTOMER'
        });

        emitToRoom(`customer_${order.customerId?._id || order.customerId}`, 'ORDER_STATUS', {
            orderId: order._id,
            status: 'CANCELLED',
            paymentStatus: 'FAILED'
        });
        emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
            orderId: order._id,
            status: 'CANCELLED',
            paymentStatus: 'FAILED'
        });
        emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

        return successResponse(res, order, `Payment rejected and order cancelled (${reason})`);
    }
});

