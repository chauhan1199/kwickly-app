const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const ShopOrder = require('./shoporder.model');
const Shop = require('../shop/shop.model');
const Product = require('../product/product.model');
const Customer = require('../customer/customer.model');
const WalletTxn = require('../wallet/wallet.model');
const { Promotion, UserPromoUsage } = require('../promotion/promotion.model');
const Settlement = require('../settlement/settlement.model');
const AppSettings = require('../settings/settings.model');
const catchAsync = require('../../helpers/async.helper');
const logger = require('../../helpers/logger.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { delCache } = require('../../helpers/redis.helper');
const DeliveryStaff = require('../deliveryStaff/deliveryStaff.model');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { OTP_MIN, OTP_MAX, DELIVERY_OTP_TTL } = require('../../constants/business');
const { registerPaymentIntent } = require('../../services/upiProvider.service');

// Cash and COD are the same thing: the customer pays the shop's rider in cash.
const isCashMethod = (method) => method === 'CASH' || method === 'COD';

// Gives back the promo use a cancelled order consumed (shop auto-offers use none).
const restorePromoUsage = async (order) => {
    if (!order?.promoCode || order.promoCode === 'SHOP_OFFER') return;
    try {
        const promo = await Promotion.findOneAndUpdate(
            { code: order.promoCode, usesCount: { $gt: 0 } },
            { $inc: { usesCount: -1 } },
            { returnDocument: 'after' }
        );
        const promoId = promo?._id || (await Promotion.findOne({ code: order.promoCode }).select('_id').lean())?._id;
        if (promoId) await UserPromoUsage.findOneAndDelete({ promoId, userId: order.customerId?._id || order.customerId });
    } catch (err) {
        logger.error(`[restorePromoUsage] Failed for order ${order._id}: ${err.message}`);
    }
};
exports.restorePromoUsage = restorePromoUsage; // also used when a job's UPI payment is rejected

// A verified direct-UPI shop order payment (bank-SMS match at checkout, admin
// approval, or the UPI webhook) books nothing into the AdminWallet by itself: the
// treasury takes the platform fee as revenue + GST as liability once, at delivery
// settlement, exactly as for wallet and cash orders. This keeps every path booking
// the same amounts and stops the order total being counted on top of the fee.
const recordUpiOrderPayment = (order, how) => {
    logger.info(`[ShopOrder] UPI payment for #${order.orderNumber || order._id} ${how} (UTR: ${order.payment?.utrNumber || 'UPI'})`);
};

// Shop owner's user id, for notifications (notifications are keyed by user, not shop).
const notifyShopOwner = async (shopId, params) => {
    const owner = await Shop.findById(shopId).select('ownerId').lean();
    if (owner?.ownerId) notifyUser({ userId: owner.ownerId, entityType: 'ORDER', targetRole: 'SHOP', ...params });
};

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
// The delivery OTP is the customer's proof of handover: the shop and its delivery
// staff must ask the customer for it, so only the customer (and admin) may read it.
const hideDeliveryOtp = (doc) => {
    const order = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (!order) return order;
    const { deliveryOtp, ...rest } = order;
    return rest;
};

exports.placeOrder = catchAsync(async (req, res) => {
    const { shopId, items, deliveryAddress, deliveryLocation, paymentMethod, promoCode, deliverySlot, utrNumber, paymentOrderId } = req.body;

    if (!items || items.length === 0) {
        return errorResponse(res, 'Order must contain at least one item', StatusCodes.BAD_REQUEST);
    }

    // One bank transaction (UTR) can pay for exactly one thing on the platform.
    if (paymentMethod === 'UPI' && utrNumber) {
        const { findUtrUsage } = require('../../helpers/upi.helper');
        const utr = String(utrNumber).trim();
        const [usage, usedByOrder] = await Promise.all([
            findUtrUsage(utr),
            ShopOrder.exists({ 'payment.utrNumber': utr, 'payment.status': { $ne: 'FAILED' } })
        ]);
        if (usage || usedByOrder) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been redeemed on the platform.', StatusCodes.CONFLICT);
        }
    }

    const shop = await Shop.findById(shopId).lean();
    if (!shop || !shop.isOnline) return errorResponse(res, 'Shop is not available', StatusCodes.BAD_REQUEST);
    if (shop.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'Shop is not approved to receive orders.', StatusCodes.FORBIDDEN);
    }

    // The shop's own riders deliver, so the address must be inside its delivery radius.
    const shopCoords = shop.location?.coordinates;
    const dropCoords = deliveryLocation?.coordinates;
    if (Array.isArray(shopCoords) && shopCoords.length === 2 && (shopCoords[0] || shopCoords[1]) && Array.isArray(dropCoords)) {
        const { haversineDistance } = require('../../helpers/geo.helper');
        const radiusKm = Number(shop.deliveryConfig?.deliveryRadiusKm ?? shop.delivery?.radiusKm ?? 3);
        const distKm = haversineDistance(shopCoords, dropCoords.map(Number));
        if (radiusKm > 0 && distKm > radiusKm) {
            return errorResponse(res, `This address is outside the shop's delivery area (${radiusKm} km). It is ${distKm.toFixed(1)} km away.`, StatusCodes.BAD_REQUEST);
        }
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

        // Atomically decrement stock for each item — if any item has insufficient stock, the whole operation fails
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
            const promo = await Promotion.findOne({ code: promoCode.toUpperCase(), isActive: true }).lean();
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
            if (promo.maxUsesPerUser) {
                const usedByMe = await UserPromoUsage.countDocuments({ promoId: promo._id, userId: req.user._id });
                if (usedByMe >= promo.maxUsesPerUser) {
                    if (useTransaction && session) await session.abortTransaction();
                    if (session) session.endSession();
                    return errorResponse(res, 'You have reached the usage limit for this promo code', StatusCodes.BAD_REQUEST);
                }
            }

            if (promo.type === 'FLAT_DISCOUNT') {
                discount = promo.value;
            } else if (promo.type === 'PERCENTAGE_DISCOUNT') {
                discount = Math.round((subtotal * promo.value) / 100);
                if (promo.maxDiscountCap) discount = Math.min(discount, promo.maxDiscountCap);
            }
            discount = Math.min(discount, subtotal); // Discount cannot exceed subtotal

            // Increment promo usage atomically against the total cap, and record per-user usage
            const incremented = await Promotion.findOneAndUpdate(
                { _id: promo._id, $or: [{ maxUsesTotal: { $in: [null, 0] } }, { $expr: { $lt: ['$usesCount', '$maxUsesTotal'] } }] },
                { $inc: { usesCount: 1 } },
                { returnDocument: 'after', ...(useTransaction ? { session } : {}) }
            );
            if (!incremented) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Promo code usage limit reached', StatusCodes.BAD_REQUEST);
            }
            await UserPromoUsage.create([{ promoId: promo._id, userId: req.user._id }], useTransaction ? { session } : {});
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

        const { calculateShopOrderFee } = require('../../helpers/feeCalculator.helper');
        const appSettings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();

        const netProductSales = Math.max(0, subtotal - discount);
        const feeCalc = calculateShopOrderFee(netProductSales, deliveryFee, appSettings?.shopOrderFee || {});
        const platformFee = feeCalc.platformFee;
        const gstAmount = feeCalc.gstAmount;
        const total = feeCalc.customerTotal;

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
        } else if (paymentMethod === 'UPI') {
            // The client's isPaid flag and UTR are unverified claims. The order is PAID
            // only when the bank-SMS webhook has recorded a matching credit; otherwise
            // it waits in PENDING_VERIFICATION for the shop or an admin to confirm.
            if (utrNumber) {
                const BankCredit = require('../payment/bankCredit.model');
                const bankCredit = await BankCredit.findOneAndUpdate(
                    { utr: String(utrNumber).trim(), isClaimed: false, amount: { $gte: total - 0.5, $lte: total + 0.5 } },
                    { $set: { isClaimed: true, claimedBy: req.user._id, claimedAt: new Date() } },
                    { returnDocument: 'after', ...sessOpts }
                );
                paymentStatus = bankCredit ? 'PAID' : 'PENDING_VERIFICATION';
            } else {
                paymentStatus = 'PENDING';
            }
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

        // Validate that chosen slot for today is not in the past (using timezone-accurate IST)
        const istNow = new Date();
        const istDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayStr = istDateFormatter.format(istNow);

        if (slotData.date === todayStr && slotData.time) {
            const timeMatch = slotData.time.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const endHour = parseInt(timeMatch[3], 10);
                const endMin = parseInt(timeMatch[4], 10);
                const istTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
                const [hStr, mStr] = istTimeFormatter.format(istNow).split(':');
                const currentMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
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
            netProductSales,
            platformFee,
            gstAmount,
            total,
            deliveryAddress,
            deliveryLocation,
            deliverySlot: slotData,
            deliveryOtp,
            deliveryOtpGeneratedAt: new Date(),
            payment: {
                amount: total,
                status: paymentStatus,
                method: paymentMethod || 'WALLET',
                utrNumber: utrNumber || undefined,
                razorpayOrderId: paymentOrderId || undefined
            },
            promoCode: promoDetails?.code || undefined,
            promoDiscount: discount > 0 ? discount : undefined,
            statusHistory: [{ status: 'NEW', timestamp: new Date(), note: 'Order placed' }]
        }], sessOpts);

        let upiIntentUri = null;
        let gatewayOrderId = null;

        // If UPI payment method and not already paid, register payment intent with overlay provider
        if (paymentMethod === 'UPI' && !utrNumber) {
            const intentRes = await registerPaymentIntent({
                amount: total,
                internalId: order._id,
                purpose: 'shop_order',
                userId: req.user._id
            });
            gatewayOrderId = intentRes.gatewayOrderId;
            upiIntentUri = intentRes.upiIntentUri;

            if (gatewayOrderId) {
                order.payment.gatewayOrderId = gatewayOrderId;
                await order.save({ session });
            }
        }

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();

        // A UPI order matched to a bank-SMS credit is booked exactly like an
        // admin-approved or webhook-confirmed one.
        if (paymentMethod === 'UPI' && paymentStatus === 'PAID') {
            recordUpiOrderPayment(order, 'matched to bank credit at checkout');
        }

        // ONLY notify shop owner if payment is successful/confirmed (WALLET, verified UPI, or COD)
        const isOrderConfirmed = paymentStatus === 'PAID' || paymentStatus === 'PENDING_VERIFICATION' || isCashMethod(paymentMethod);

        if (isOrderConfirmed) {
            // Notify shop owner
            emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: order._id, total });
            emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP_ORDER', id: order._id });
            notifyUser({
                userId: shop.ownerId,
                title: '🛒 New Order',
                message: paymentStatus === 'PENDING_VERIFICATION'
                    ? `New order #${orderNumber} for ₹${total}. UPI payment is awaiting confirmation; don't accept it yet.`
                    : `New order #${orderNumber} for ₹${total} (${isCashMethod(paymentMethod) ? 'cash on delivery' : 'paid'}).`,
                action: 'ORDER_PLACED',
                entityType: 'ORDER',
                entityId: order._id,
                targetRole: 'SHOP'
            });

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
        }

        const orderData = order.toObject();
        if (upiIntentUri) {
            orderData.upiIntentUri = upiIntentUri;
            orderData.gatewayOrderId = gatewayOrderId;
        }

        return successResponse(res, orderData, 'Order placed successfully', StatusCodes.CREATED);

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
    const { page = 1, limit = 100 } = req.query;
    const baseQuery = {
        customerId: req.user._id,
        $nor: [{ 'payment.method': 'UPI', 'payment.status': 'PENDING' }]
    };
    const total = await ShopOrder.countDocuments(baseQuery);
    const orders = await ShopOrder.find(baseQuery)
        .populate('shopId', 'name logoUrl address location')
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
    const shop = await Shop.findOne({ ownerId: req.user._id }).select('_id').lean();
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const { status, page = 1, limit = 100 } = req.query;
    const query = {
        shopId: shop._id,
        $nor: [{ 'payment.method': 'UPI', 'payment.status': 'PENDING' }]
    };
    if (status && status !== 'all') query.status = status.toUpperCase();

    const [total, orders] = await Promise.all([
        ShopOrder.countDocuments(query),
        ShopOrder.find(query)
            .populate('customerId', 'name phone')
            .sort('-createdAt')
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .lean()
    ]);

    return successResponse(res, { orders: orders.map(hideDeliveryOtp), total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Shop orders fetched');
});

/**
 * GET /api/v1/shoporders/:id
 */
exports.getOrderById = catchAsync(async (req, res) => {
    const order = await ShopOrder.findById(req.params.id)
        .populate('shopId', 'name logoUrl address phone location')
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
    const isCustomer = orderCustomerId === req.user._id.toString();
    return successResponse(res, req.user.role === 'ADMIN' || isCustomer ? order : hideDeliveryOtp(order), 'Order fetched');
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
                ${(order.discount || 0) > 0 ? `<div class="total-row"><span>Discount${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ''}</span><span>-₹${Number(order.discount).toFixed(2)}</span></div>` : ''}
                <div class="total-row"><span>Delivery Fee</span><span>₹${Number(order.deliveryFee || 0).toFixed(2)}</span></div>
                <div class="total-row"><span>Platform Fee</span><span>₹${Number(order.platformFee || 0).toFixed(2)}</span></div>
                <div class="total-row"><span>GST (18% on platform fee)</span><span>₹${Number(order.gstAmount || 0).toFixed(2)}</span></div>
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
 * Customer cancels their own order (if NEW, CONFIRMED, or PACKING status)
 */
exports.cancelOrder = catchAsync(async (req, res) => {
    // Atomic status check: cancel if order is in NEW, CONFIRMED, or PACKING state
    const order = await ShopOrder.findOneAndUpdate(
        { _id: req.params.id, customerId: req.user._id, status: { $in: ['NEW', 'CONFIRMED', 'PACKING'] } },
        { status: 'CANCELLED', $push: { statusHistory: { status: 'CANCELLED', timestamp: new Date(), note: 'Cancelled by customer' } } },
        { returnDocument: 'after' }
    );
    if (!order) {
        const existing = await ShopOrder.findOne({ _id: req.params.id, customerId: req.user._id }).lean();
        if (!existing) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
        return errorResponse(res, 'Order cannot be cancelled once it is out for delivery or completed', StatusCodes.BAD_REQUEST);
    }

    // Restore stock
    for (const item of order.items) {
        if (item.productId) {
            try {
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
            } catch (stockErr) {
                logger.error(`[cancelOrder] Failed to restore stock for product ${item.productId}:`, stockErr);
            }
        }
    }

    // Refund to Wallet if already paid
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
            description: `Refund for cancelled order #${order.orderNumber || String(order._id).slice(-6).toUpperCase()}`
        });

        order.payment.status = 'REFUNDED';
        await order.save();
        await delCache(`session:${order.customerId}`);

        notifyUser({
            userId: order.customerId,
            title: '💰 Order Refunded',
            message: `₹${order.total} has been refunded to your Kwickly Wallet for Order #${order.orderNumber || String(order._id).slice(-6).toUpperCase()}.`,
            action: 'ORDER_CANCELLED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'CUSTOMER'
        });
    } else {
        // Nothing was collected, so the payment status stays as is (a late UPI
        // credit on a PENDING/PENDING_VERIFICATION order is then refunded by the
        // webhook or admin verification).
        notifyUser({
            userId: order.customerId,
            title: '❌ Order Cancelled',
            message: `Order #${order.orderNumber || String(order._id).slice(-6).toUpperCase()} has been cancelled successfully.`,
            action: 'ORDER_CANCELLED',
            entityType: 'ORDER',
            entityId: order._id,
            targetRole: 'CUSTOMER'
        });
    }

    await restorePromoUsage(order);

    // Notify shop owner
    emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', { orderId: order._id, status: 'CANCELLED' });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

    await notifyShopOwner(order.shopId, {
        title: '❌ Order Cancelled',
        message: `Order #${order.orderNumber || String(order._id).slice(-6).toUpperCase()} was cancelled by the customer.`,
        action: 'ORDER_CANCELLED',
        entityId: order._id
    });

    return successResponse(res, order, 'Order cancelled successfully and refund processed if applicable');
});

/**
 * PATCH /api/v1/shoporders/:id/status
 */
exports.updateOrderStatus = catchAsync(async (req, res) => {
    const { status, otp, note, deliveryStaffId } = req.body;
    const validStatuses = ['CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status', StatusCodes.BAD_REQUEST);

    let order;
    let shop;
    if (req.user.role === 'ADMIN') {
        order = await ShopOrder.findById(req.params.id);
        if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
        shop = await Shop.findById(order.shopId).select('_id wallet ownerId').lean();
    } else {
        shop = await Shop.findOne({ ownerId: req.user._id }).select('_id wallet ownerId').lean();
        if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
        order = await ShopOrder.findOne({ _id: req.params.id, shopId: shop._id });
        if (!order) return errorResponse(res, 'Order not found or not authorized', StatusCodes.NOT_FOUND);
    }

    // Status transition validation
    const validTransitions = {
        NEW: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['PACKING', 'CANCELLED'],
        PACKING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
        OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['CANCELLED'],
        CANCELLED: [],
    };
    const allowedNext = validTransitions[order.status];
    if (!allowedNext) {
        return errorResponse(res, `Cannot transition from status "${order.status}"`, StatusCodes.BAD_REQUEST);
    }
    if (!allowedNext.includes(status)) {
        return errorResponse(res, `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowedNext.join(', ') || 'none'}`, StatusCodes.BAD_REQUEST);
    }
    // A delivered order has been settled; only an admin may cancel (reverse) it.
    if (order.status === 'DELIVERED' && status === 'CANCELLED' && req.user.role !== 'ADMIN') {
        return errorResponse(res, 'A delivered order can only be cancelled by Kwickly support', StatusCodes.FORBIDDEN);
    }

    // A direct-UPI order is paid only once a bank-SMS match or an admin approval
    // marks it PAID; until then the shop must not accept or progress it.
    if (status !== 'CANCELLED' && order.payment?.method === 'UPI' && order.payment?.status !== 'PAID') {
        return errorResponse(res, 'Waiting for payment confirmation', StatusCodes.BAD_REQUEST);
    }

    // Cash orders charge the platform fee + GST to the shop wallet at delivery;
    // a shop already at the -₹500 credit limit must top up before taking more.
    if (status === 'CONFIRMED' && isCashMethod(order.payment?.method) && (shop?.wallet?.balance || 0) <= -500) {
        return errorResponse(res, 'Your wallet has reached the -₹500 credit limit. Please top up to accept cash orders.', StatusCodes.PAYMENT_REQUIRED);
    }

    order.statusHistory.push({ status, timestamp: new Date(), note: note || `Status changed to ${status}` });

    if (status === 'DELIVERED') {
        if (!otp) {
            return errorResponse(res, 'Delivery OTP is required', StatusCodes.BAD_REQUEST);
        }

        // P0 FIX: Atomic claim — exactly ONE concurrent DELIVERED update settles the order.
        // Without this, parallel requests both read OUT_FOR_DELIVERY and both settle (shop paid twice).
        const claimed = await ShopOrder.findOneAndUpdate(
            { _id: order._id, status: 'OUT_FOR_DELIVERY' },
            { status: 'DELIVERED' },
            { returnDocument: 'after' }
        );
        if (!claimed) {
            return errorResponse(res, 'Order is already being delivered or has already been delivered', StatusCodes.CONFLICT);
        }
        const revertClaim = async () => {
            try { await ShopOrder.findByIdAndUpdate(order._id, { status: 'OUT_FOR_DELIVERY' }); } catch (e) { /* best-effort revert */ }
        };

        // The OTP clock starts at dispatch (OUT_FOR_DELIVERY), not at order placement.
        const otpAge = (Date.now() - new Date(order.deliveryOtpGeneratedAt || order.createdAt).getTime()) / 1000;
        if (otpAge > DELIVERY_OTP_TTL) {
            await revertClaim();
            return errorResponse(res, 'Delivery OTP has expired. Ask the customer to tap "New OTP" on their order screen.', StatusCodes.BAD_REQUEST);
        }

        // Max 5 attempts per OTP; the customer can issue a fresh one.
        if ((order.deliveryOtpAttempts || 0) >= 5) {
            await revertClaim();
            return errorResponse(res, 'Too many wrong OTP attempts. Ask the customer to tap "New OTP" on their order screen.', StatusCodes.BAD_REQUEST);
        }

        if (String(otp) !== String(order.deliveryOtp)) {
            await ShopOrder.findByIdAndUpdate(order._id, { $inc: { deliveryOtpAttempts: 1 } });
            await revertClaim();
            return errorResponse(res, 'Invalid delivery OTP. Please ask the customer for the correct OTP.', StatusCodes.BAD_REQUEST);
        }

        // Settle Shop Order via Centralized Idempotent Settlement Engine (100% to shop, 0% commission)
        const { settleShopOrderDelivery } = require('../../helpers/settlementEngine.helper');
        try {
            await settleShopOrderDelivery({ order });
        } catch (settleErr) {
            await revertClaim();
            throw settleErr;
        }

        order.status = 'DELIVERED';
        if (!order.payment) order.payment = {};
        // Cash is collected at the door, so it is paid now. Wallet orders are already
        // PAID, and UPI orders can't reach delivery unless verified as PAID.
        if (isCashMethod(order.payment?.method)) {
            order.payment.status = 'PAID';
        }
        order.payment.escrowStatus = 'SETTLED';
        await order.save();

        if (order.deliveryStaffId) {
            await DeliveryStaff.updateOne(
                { _id: order.deliveryStaffId, activeOrderId: order._id },
                { $unset: { activeOrderId: 1 }, $inc: { totalDeliveries: 1 } }
            );
        }
    } else if (status === 'OUT_FOR_DELIVERY') {
        if (deliveryStaffId) {
            const staff = await DeliveryStaff.findOne({ _id: deliveryStaffId, shopId: order.shopId });
            if (!staff) return errorResponse(res, 'Delivery staff not found for this shop', StatusCodes.NOT_FOUND);
            if (staff.activeOrderId && String(staff.activeOrderId) !== String(order._id)) {
                const busyOn = await ShopOrder.findOne({ _id: staff.activeOrderId, status: 'OUT_FOR_DELIVERY' }).select('orderNumber').lean();
                if (busyOn) {
                    return errorResponse(res, `${staff.name} is already delivering order #${busyOn.orderNumber || String(busyOn._id).slice(-6)}. Choose another rider.`, StatusCodes.CONFLICT);
                }
            }
            order.deliveryStaffId = staff._id;
            order.deliveryStaffName = staff.name;
            order.deliveryStaffPhone = staff.phone || undefined;
            staff.activeOrderId = order._id;
            await staff.save();
        }
        // Restart the OTP clock and attempt counter at dispatch.
        order.deliveryOtpGeneratedAt = new Date();
        order.deliveryOtpAttempts = 0;
        order.status = status;
        await order.save();
    } else if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        let session = null, useTransaction = false;
        if (supportsTransactions()) { try { session = await mongoose.startSession(); session.startTransaction(); useTransaction = true; } catch (e) { session = null; useTransaction = false; } }

        try {
            const sessOpts = useTransaction ? { session } : {};

            // If order was already DELIVERED (and therefore settled), reverse
            // the settlement: claw back the shop payout (bounded by shop
            // balance), reverse fee/GST from treasury, and refund the
            // customer — all idempotently. Stock is NOT restored (goods were
            // delivered) and the generic refund below must not double-pay.
            if (order.status === 'DELIVERED') {
                const { reverseShopOrderDelivery } = require('../../helpers/settlementEngine.helper');
                await reverseShopOrderDelivery({ order, session });

                // Cancel any legacy pending Settlement doc as well
                const settlement = await Settlement.findOne({ orderId: order._id, status: { $in: ['PENDING', 'PARTIAL'] } });
                if (settlement) {
                    settlement.status = 'CANCELLED';
                    settlement.note = (settlement.note ? settlement.note + ' | ' : '') + 'Cancelled: order was cancelled after delivery';
                    await settlement.save(sessOpts);
                }

                if (order.payment) { order.payment.escrowStatus = 'REFUNDED'; order.payment.status = 'REFUNDED'; }
                order.status = status;
                await order.save(sessOpts);

                if (useTransaction) await session.commitTransaction();
                if (session) session.endSession();
            } else {
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
                    order.payment.status = 'REFUNDED';
                }

                order.status = status;
                await order.save(sessOpts);

                if (useTransaction) await session.commitTransaction();
                if (session) session.endSession();
            }
        } catch (error) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            throw error;
        }
    } else {
        order.status = status;
        await order.save();
    }

    if (status === 'CANCELLED') {
        await restorePromoUsage(order);
        emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', { orderId: order._id, status });
    }

    if (status === 'CANCELLED' && order.deliveryStaffId) {
        await DeliveryStaff.updateOne(
            { _id: order.deliveryStaffId, activeOrderId: order._id },
            { $unset: { activeOrderId: 1 } }
        );
    }

    // Notify customer in real-time
    emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', { orderId: order._id, status });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_STATUS_CHANGED', id: order._id });

    // Notify customer via notification
    const statusMessages = {
        CONFIRMED: { emoji: '✓', msg: 'Your order has been confirmed by the shop and is being prepared.' },
        PACKING: { emoji: '📦', msg: 'Your order is being packed and will be dispatched soon.' },
        OUT_FOR_DELIVERY: { emoji: '🚚', msg: 'Your order is out for delivery! Prepare your OTP for handover.' },
        DELIVERED: { emoji: '🎉', msg: 'Your order has been delivered successfully. Enjoy!' },
        CANCELLED: { emoji: '❌', msg: 'Your order has been cancelled. A refund will be processed if applicable.' },
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

    return successResponse(res, req.user.role === 'ADMIN' ? order : hideDeliveryOtp(order), 'Order status updated');
});


/**
 * POST /api/v1/shoporders/:id/delivery-otp (Customer)
 * Issues a fresh delivery OTP when the old one expired or was locked by wrong attempts.
 */
exports.regenerateDeliveryOtp = catchAsync(async (req, res) => {
    const order = await ShopOrder.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
    if (!['NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY'].includes(order.status)) {
        return errorResponse(res, 'This order is no longer awaiting delivery', StatusCodes.BAD_REQUEST);
    }
    order.deliveryOtp = crypto.randomInt(OTP_MIN, OTP_MAX).toString();
    order.deliveryOtpGeneratedAt = new Date();
    order.deliveryOtpAttempts = 0;
    await order.save();
    return successResponse(res, { deliveryOtp: order.deliveryOtp }, 'New delivery OTP issued');
});

/**
 * GET /api/v1/shoporders (Admin)
 */
exports.getAllOrders = catchAsync(async (req, res) => {
    const { status, search, page = 1, limit = 20, shopId } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();
    if (shopId) query.shopId = shopId;

    if (search && search.trim()) {
        const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const [matchingCustomers, matchingShops] = await Promise.all([
            Customer.find({ $or: [{ name: regex }, { phone: regex }] }).select('_id').lean(),
            Shop.find({ name: regex }).select('_id').lean()
        ]);
        query.$or = [
            { orderNumber: regex },
            { 'payment.utrNumber': regex },
            { customerId: { $in: matchingCustomers.map(c => c._id) } },
            { shopId: { $in: matchingShops.map(s => s._id) } }
        ];
    }

    const total = await ShopOrder.countDocuments(query);
    const orders = await ShopOrder.find(query)
        .populate('shopId', 'name')
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    // Platform-wide KPI stats (independent of status/search filters)
    const [statusStats, revenueStats] = await Promise.all([
        ShopOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        // Only money actually collected: delivered or paid, never cancelled/refunded
        ShopOrder.aggregate([
            { $match: { status: { $ne: 'CANCELLED' }, 'payment.status': { $ne: 'REFUNDED' }, $or: [{ status: 'DELIVERED' }, { 'payment.status': 'PAID' }] } },
            { $group: { _id: null, revenue: { $sum: '$total' }, platformRevenue: { $sum: { $add: [{ $ifNull: ['$platformFee', 0] }, { $ifNull: ['$gstAmount', 0] }] } } } }
        ])
    ]);
    const byStatus = {};
    statusStats.forEach(s => { byStatus[s._id] = s.count; });

    return successResponse(res, {
        orders,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        stats: { byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0), revenue: revenueStats[0]?.revenue || 0, platformRevenue: revenueStats[0]?.platformRevenue || 0 }
    }, 'All orders fetched');
});

/**
 * POST /api/v1/shoporders/:id/verify-payment (Admin only)
 * Confirms that direct UPI payment (UTR) has arrived in the bank account.
 */
exports.verifyShopOrderPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { action = 'approve', reason = 'Fake / Invalid UTR' } = req.body;

    const order = await ShopOrder.findById(id).populate('customerId', 'name phone');
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);

    // Only a payment still awaiting verification can be approved or rejected, and
    // only once: claim it atomically so a repeat or concurrent call can't credit
    // the treasury or refund the customer a second time.
    const claimed = await ShopOrder.findOneAndUpdate(
        { _id: order._id, 'payment.status': 'PENDING_VERIFICATION' },
        { $set: { 'payment.status': action === 'approve' ? 'PAID' : 'FAILED' } },
        { returnDocument: 'after' }
    );
    if (!claimed) {
        return errorResponse(res, `This payment is not awaiting verification (current status: ${order.payment?.status || 'unknown'})`, StatusCodes.CONFLICT);
    }

    if (action === 'approve') {
        order.payment.status = 'PAID';
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            note: `Payment verified & confirmed by Admin (UTR: ${order.payment?.utrNumber || 'UPI'})`
        });
        await order.save();

        // Treasury is booked at settlement (fee + GST), same as the checkout bank match and the webhook
        const orderAmount = order.total || 0;
        recordUpiOrderPayment(order, 'verified by admin');

        // If the order was already CANCELLED (e.g. timed out after 30 mins or cancelled before verification),
        // we automatically refund the verified funds into the customer's Kwickly Wallet!
        if (order.status === 'CANCELLED' && orderAmount > 0) {
            const customerId = order.customerId?._id || order.customerId;
            const refundedCustomer = await Customer.findByIdAndUpdate(customerId, {
                $inc: { 'wallet.balance': orderAmount }
            }, { returnDocument: 'after' });

            await WalletTxn.create([{
                userId: customerId,
                type: 'REFUND',
                amount: orderAmount,
                balance: refundedCustomer?.wallet?.balance || 0,
                refId: String(order._id),
                status: 'COMPLETED',
                description: `Refund for cancelled order #${order.orderNumber || String(order._id).slice(-6)} (UPI payment verified by Admin)`
            }]);

            order.payment.status = 'REFUNDED';
            await order.save();
            await delCache(`session:${customerId}`);

            notifyUser({
                userId: customerId,
                title: '💰 Refund Credited to Wallet',
                message: `Your payment of ₹${orderAmount} for cancelled order #${order.orderNumber} has been verified and credited to your Kwickly Wallet.`,
                action: 'ORDER_REFUNDED',
                entityType: 'ORDER',
                entityId: order._id,
                targetRole: 'CUSTOMER'
            });

            emitToRoom(`customer_${customerId}`, 'WALLET_UPDATED', { balance: refundedCustomer?.wallet?.balance });
            emitToRoom(`customer_${customerId}`, 'ORDER_STATUS', { orderId: order._id, status: 'CANCELLED', paymentStatus: 'REFUNDED' });

            return successResponse(res, order, 'Payment approved and refunded to customer wallet because order was cancelled');
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
        // Reject fake UTR -> cancel order and restore stock (unless a cancel already restored it)
        const stockAlreadyRestored = order.status === 'CANCELLED';
        if (!stockAlreadyRestored) await restorePromoUsage(order);
        for (const item of stockAlreadyRestored ? [] : order.items) {
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

