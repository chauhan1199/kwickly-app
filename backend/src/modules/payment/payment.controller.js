const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('./payment.model');
const ShopOrder = require('../shoporder/shoporder.model');
const Shop = require('../shop/shop.model');
const Customer = require('../customer/customer.model');
const Product = require('../product/product.model');
const WalletTxn = require('../wallet/wallet.model');
const AppSettings = require('../settings/settings.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { delCache } = require('../../helpers/redis.helper');
const logger = require('../../helpers/logger.helper');
const {
    createRazorpayOrder, fetchPayment, capturePayment, createRefund, verifyPaymentSignature
} = require('../../helpers/razorpay.helper');
const { supportsTransactions } = require('../../helpers/transaction.helper');

const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');

/**
 * GET /api/v1/payments/admin-upi
 * Fetches admin-configured UPI ID and Bank Details for public/authenticated payments
 */
exports.getAdminUpiConfig = catchAsync(async (req, res) => {
    const adminWallet = await AdminWallet.findOne().lean();
    return successResponse(res, {
        upiId: adminWallet?.upiId || process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi',
        payeeName: adminWallet?.bankDetails?.accountHolder || 'Kwickly PVT LTD',
        bankDetails: adminWallet?.bankDetails || {
            accountHolder: 'Kwickly PVT LTD',
            accountNumber: '1234567890',
            ifscCode: 'SBIN0001234',
            bankName: 'SBI'
        }
    }, 'Admin UPI configuration fetched');
});

/**
 * POST /api/v1/payments/create-order
 * Creates a Razorpay or Direct UPI order for a given amount
 */
exports.createOrder = catchAsync(async (req, res) => {
    const { amount, orderId, purpose } = req.body;

    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const receipt = `rcpt_${req.user._id.toString().slice(-8)}_${Date.now()}`;
    const notes = {
        userId: req.user._id.toString(),
        purpose: purpose || 'order_payment',
        orderId: orderId || null
    };

    let rpOrderId = null;
    let isUpiDirect = false;

    try {
        const rpOrder = await createRazorpayOrder(amount, receipt, notes);
        rpOrderId = rpOrder.id;
    } catch (rpErr) {
        // If Razorpay test credentials fail or offline, fallback to Direct UPI Intent mode
        logger.warn('[Payment] Razorpay order creation failed, falling back to Direct UPI:', rpErr.message || rpErr);
        rpOrderId = `upi_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        isUpiDirect = true;
    }

    const adminWallet = await AdminWallet.findOne().lean();
    const platformVpa = adminWallet?.upiId || process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi';
    const payeeName = adminWallet?.bankDetails?.accountHolder || 'Kwickly PVT LTD';
    const upiIntentUri = `upi://pay?pa=${encodeURIComponent(platformVpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=Kwickly_${purpose || 'Payment'}_${orderId || Date.now()}&tr=${rpOrderId}`;

    // Store the payment order in our DB
    const payment = await Payment.create({
        orderId: orderId || null,
        razorpayOrderId: rpOrderId,
        amount,
        userId: req.user._id,
        status: 'CREATED',
        metadata: {
            receipt,
            notes,
            isUpiDirect,
            upiIntentUri,
            payeeName,
            platformVpa
        }
    });

    return successResponse(res, {
        razorpayOrderId: rpOrderId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        paymentId: payment._id,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_kwickly',
        upiVpa: platformVpa,
        payeeName,
        bankDetails: adminWallet?.bankDetails || null,
        upiIntentUri,
        isUpiDirect
    }, 'Payment order created successfully', StatusCodes.CREATED);
});


/**
 * POST /api/v1/payments/verify
 * Verifies payment after UPI or Razorpay checkout success
 */
exports.verifyPayment = catchAsync(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, upiTransactionId, utrNumber, razorpaySignature, orderId } = req.body;

    if (!razorpayOrderId) {
        return errorResponse(res, 'Missing payment order ID', StatusCodes.BAD_REQUEST);
    }

    const upiRef = (upiTransactionId || utrNumber || (razorpayPaymentId && razorpayPaymentId.startsWith('upi_') ? razorpayPaymentId : '')).toString().trim();
    const isUpiOrder = razorpayOrderId.startsWith('upi_') || (upiTransactionId && upiTransactionId.length > 0) || (utrNumber && utrNumber.length > 0);

    if (isUpiOrder) {
        if (!upiRef || upiRef.length < 4) {
            return errorResponse(res, 'Please enter the 12-digit UPI Reference / UTR Number from your payment receipt.', StatusCodes.BAD_REQUEST);
        }

        // Anti-replay / duplicate UTR check across past transactions
        const existingTxn = await WalletTxn.findOne({
            razorpayPaymentId: upiRef,
            status: 'COMPLETED'
        }).lean();

        if (existingTxn) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been processed and credited.', StatusCodes.CONFLICT);
        }

        const existingPayment = await Payment.findOne({
            razorpayPaymentId: upiRef,
            status: 'CAPTURED',
            razorpayOrderId: { $ne: razorpayOrderId }
        }).lean();

        if (existingPayment) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been used for another order.', StatusCodes.CONFLICT);
        }
    } else {
        // Verify signature for Razorpay
        if (razorpaySignature) {
            const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                return errorResponse(res, 'Invalid payment signature', StatusCodes.BAD_REQUEST);
            }
        }
    }

    // Use transactions to prevent partial updates
    let session = null;
    let useTransaction = false;
    if (supportsTransactions()) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) { session = null; useTransaction = false; }
    }

    try {
        const sessOpts = useTransaction ? { session } : {};
        
        // Update our payment record
        let payment = await Payment.findOne({ razorpayOrderId }).session(session);
        if (!payment && orderId) {
            payment = await Payment.findOne({ orderId }).session(session);
        }

        const finalPaymentId = upiRef || razorpayPaymentId || `upi_txn_${Date.now()}`;

        if (!payment) {
            // Create record if not found
            payment = await Payment.create([{
                orderId: orderId || null,
                razorpayOrderId,
                amount: req.body.amount || 0,
                userId: req.user._id,
                status: 'CAPTURED',
                method: 'UPI',
                razorpayPaymentId: finalPaymentId,
                razorpaySignature: razorpaySignature || 'upi_verified'
            }], sessOpts).then(arr => arr[0]);
        } else {
            payment.razorpayPaymentId = finalPaymentId;
            payment.razorpaySignature = razorpaySignature || 'upi_verified';
            payment.method = 'UPI';
            payment.status = 'CAPTURED';
            await payment.save(sessOpts);
        }

        // If linked to an order, update the order
        const targetOrderId = payment.orderId || orderId;
        if (targetOrderId) {
            const order = await ShopOrder.findById(targetOrderId).session(session);
            if (order) {
                order.payment.status = 'PAID';
                order.payment.razorpayOrderId = razorpayOrderId;
                order.payment.razorpayPaymentId = payment.razorpayPaymentId;
                order.payment.method = 'UPI';
                order.statusHistory.push({ status: order.status, timestamp: new Date(), note: `UPI Payment verified successfully (UTR: ${finalPaymentId})` });
                await order.save(sessOpts);

                // Credit Admin Treasury for shop order collection
                const orderAmount = order.totalAmount || payment.amount || req.body.amount || 0;
                if (orderAmount > 0) {
                    const adminW = await AdminWallet.findOneAndUpdate(
                        {},
                        { $inc: { balance: orderAmount, totalCollected: orderAmount } },
                        { returnDocument: 'after', upsert: true, session }
                    );
                    if (adminW) {
                        await AdminWalletTxn.create([{
                            type: 'TOPUP',
                            amount: orderAmount,
                            balanceAfter: adminW.balance,
                            description: `Shop Order #${order.orderNumber || order._id} UPI payment received (UTR: ${finalPaymentId})`,
                            referenceId: order._id,
                            referenceModel: 'ShopOrder',
                            meta: { userId: req.user._id, orderId: order._id, utr: finalPaymentId }
                        }], { session });
                        emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_CREDIT', id: order._id, amount: orderAmount });
                    }
                }

                // Notify shop
                emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
                    orderId: order._id,
                    status: order.status,
                    paymentStatus: 'PAID'
                });
                emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_PAYMENT_RECEIVED', id: order._id });
            }
        }

        // Wallet top-up flow (purpose: 'wallet_topup')
        if (payment.metadata?.notes?.purpose === 'wallet_topup' || req.body.purpose === 'wallet_topup') {
            const alreadyCredited = await WalletTxn.findOne({ type: 'TOPUP', razorpayPaymentId: payment.razorpayPaymentId }).session(session);
            if (!alreadyCredited) {
                const creditAmount = payment.amount || req.body.amount;
                const creditedUser = await Customer.findByIdAndUpdate(
                    payment.userId || req.user._id,
                    { $inc: { 'wallet.balance': creditAmount } },
                    { returnDocument: 'after', session }
                );
                if (creditedUser) {
                    await WalletTxn.create([{
                        userId: creditedUser._id,
                        type: 'TOPUP',
                        amount: creditAmount,
                        balance: creditedUser.wallet?.balance || 0,
                        balanceAfter: creditedUser.wallet?.balance || 0,
                        status: 'COMPLETED',
                        razorpayPaymentId: payment.razorpayPaymentId,
                        description: `Wallet Top-up via Admin UPI (UTR: ${finalPaymentId})`
                    }], { session });

                    // Credit Admin Wallet for platform tracking
                    const adminW = await AdminWallet.findOneAndUpdate(
                        {},
                        { $inc: { balance: creditAmount, totalCollected: creditAmount } },
                        { returnDocument: 'after', upsert: true, session }
                    );
                    if (adminW) {
                        await AdminWalletTxn.create([{
                            type: 'TOPUP',
                            amount: creditAmount,
                            balanceAfter: adminW.balance,
                            description: `User ${creditedUser.name || creditedUser.phone || 'Customer'} wallet top-up via UPI (UTR: ${finalPaymentId})`,
                            referenceId: payment._id,
                            referenceModel: 'Payment',
                            meta: { userId: creditedUser._id, purpose: 'wallet_topup', utr: finalPaymentId }
                        }], { session });
                        emitToAll('DASHBOARD_UPDATE', { type: 'ADMIN_WALLET_CREDIT', id: payment._id, amount: creditAmount });
                    }
                    await delCache(`session:${creditedUser._id}`);
                }
            }
        }

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();

        return successResponse(res, {
            verified: true,
            orderId: targetOrderId,
            paymentId: payment._id,
            status: payment.status || 'CAPTURED',
            utr: finalPaymentId
        }, 'Payment verified and credited successfully');

    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

/**
 * POST /api/v1/payments/webhook
 * Handles Razorpay webhook events (server-to-server)
 */
exports.handleWebhook = catchAsync(async (req, res) => {
    // express.raw() leaves req.body as a Buffer — parse it to JSON
    let body;
    if (Buffer.isBuffer(req.body)) {
        body = JSON.parse(req.body.toString('utf8'));
    } else {
        body = req.body;
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Skip verification only in test environment
    if (process.env.NODE_ENV !== 'test') {
        if (!webhookSecret) {
            logger.error('[Razorpay Webhook] Webhook secret not configured');
            return res.status(400).json({ error: 'Webhook secret not configured' });
        }

        const signature = req.headers['x-razorpay-signature'];
        const bodyStr = JSON.stringify(body);
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(bodyStr)
            .digest('hex');

        if (signature !== expectedSignature) {
            logger.warn('[Razorpay Webhook] Invalid signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }
    }

    const event = body?.event;
    const payload = body?.payload;
    const eventId = body?.id; // Razorpay event ID for dedup

    // Idempotency: skip if this event was already processed
    if (eventId) {
        const existing = await Payment.findOne({ webhookEventId: eventId });
        if (existing) {
            logger.info(`[Razorpay Webhook] Duplicate event ${eventId} — skipping`);
            return res.status(200).json({ status: 'ok', message: 'Event already processed' });
        }
    }

    logger.info(`[Razorpay Webhook] Event: ${event}`);

    switch (event) {
        case 'payment.captured': {
            const paymentEntity = payload?.payment?.entity;
            if (paymentEntity) {
                await handlePaymentCaptured(paymentEntity, eventId);
            }
            break;
        }
        case 'payment.failed': {
            const paymentEntity = payload?.payment?.entity;
            if (paymentEntity) {
                await handlePaymentFailed(paymentEntity, eventId);
            }
            break;
        }
        case 'refund.created': {
            const refundEntity = payload?.refund?.entity;
            if (refundEntity) {
                await handleRefundCreated(refundEntity, eventId);
            }
            break;
        }
        case 'order.paid': {
            logger.info('[Razorpay Webhook] Order paid event received');
            break;
        }
        default:
            logger.info(`[Razorpay Webhook] Unhandled event: ${event}`);
    }

    // Always return 200 to Razorpay
    return res.status(200).json({ ok: true });
});

async function handlePaymentCaptured(paymentEntity, eventId) {
    const { id, order_id, amount, method } = paymentEntity;

    const payment = await Payment.findOne({ razorpayOrderId: order_id });
    if (payment) {
        payment.status = 'CAPTURED';
        payment.razorpayPaymentId = id;
        payment.method = method;
        if (eventId) payment.webhookEventId = eventId;
        await payment.save();
    }

    // Update order if linked
    if (payment?.orderId) {
        const order = await ShopOrder.findById(payment.orderId);
        if (order && order.payment.status !== 'PAID') {
            order.payment.status = 'PAID';
            order.payment.razorpayPaymentId = id;
            order.payment.method = method?.toUpperCase() || 'UPI';
            await order.save();

            emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
                orderId: order._id,
                paymentStatus: 'PAID'
            });
        }
    }
}

async function handlePaymentFailed(paymentEntity, eventId) {
    const { id, order_id, error_description } = paymentEntity;

    const payment = await Payment.findOne({ razorpayOrderId: order_id });
    if (payment) {
        payment.status = 'FAILED';
        payment.failureReason = error_description;
        payment.razorpayPaymentId = id;
        if (eventId) payment.webhookEventId = eventId;
        await payment.save();
    }

    // Restore stock if order exists
    if (payment?.orderId) {
        const order = await ShopOrder.findById(payment.orderId);
        if (order) {
            // Restore stock
            for (const item of order.items) {
                if (item.productId) {
                    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
                }
            }
            order.status = 'CANCELLED';
            order.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Payment failed' });
            await order.save();
        }
    }
}

async function handleRefundCreated(refundEntity, eventId) {
    const { payment_id, amount } = refundEntity;
    const refundAmount = amount / 100; // Razorpay sends paise

    const payment = await Payment.findOne({ razorpayPaymentId: payment_id });
    if (payment) {
        // Validate refund amount does not exceed original payment
        if (refundAmount > payment.amount) {
            logger.warn(`[Razorpay Webhook] Refund amount ${refundAmount} exceeds original payment ${payment.amount} — skipping`);
            return;
        }
        payment.status = 'REFUNDED';
        payment.refundAmount = refundAmount;
        if (eventId) payment.webhookEventId = eventId;
        await payment.save();
    }

    // Credit customer wallet if linked to order
    if (payment?.orderId) {
        const order = await ShopOrder.findById(payment.orderId);
        if (order) {
            await Customer.findByIdAndUpdate(order.customerId, {
                $inc: { 'wallet.balance': refundAmount }
            });
            await WalletTxn.create({
                userId: order.customerId,
                type: 'REFUND',
                amount: refundAmount,
                balance: 0,
                refId: String(order._id),
                status: 'COMPLETED',
                description: `Refund for order #${order.orderNumber || String(order._id).slice(-6)}`
            });
            await delCache(`session:${order.customerId}`);
        }
    }
}

/**
 * POST /api/v1/payments/refund
 * Admin issues a refund for an order
 */
exports.refundPayment = catchAsync(async (req, res) => {
    const { orderId, amount, reason } = req.body;

    const order = await ShopOrder.findById(orderId);
    if (!order) return errorResponse(res, 'Order not found', StatusCodes.NOT_FOUND);
    if (!order.payment?.razorpayPaymentId) {
        return errorResponse(res, 'No Razorpay payment found for this order', StatusCodes.BAD_REQUEST);
    }

    const refundAmount = amount || order.total;

    try {
        // B5 FIX: Remove gateway charge cancellation (`createRefund`) to avoid double refunds.
        // Refunds are exclusively credited to the Kwickly wallet to keep cash in the ecosystem.
        // const refund = await createRefund(order.payment.razorpayPaymentId, refundAmount, { reason });

        // Update payment record
        const payment = await Payment.findOne({ razorpayOrderId: order.payment.razorpayOrderId });
        if (payment) {
            payment.status = refundAmount >= order.total ? 'REFUNDED' : 'PARTIAL_REFUNDED';
            payment.refundAmount = refundAmount;
            await payment.save();
        }

        // Credit customer wallet
        await Customer.findByIdAndUpdate(order.customerId, {
            $inc: { 'wallet.balance': refundAmount }
        });
        await WalletTxn.create({
            userId: order.customerId,
            type: 'REFUND',
            amount: refundAmount,
            balance: 0,
            refId: String(order._id),
            status: 'COMPLETED',
            description: reason || `Refund for order #${order.orderNumber}`
        });
        await delCache(`session:${order.customerId}`);

        // Update order
        order.payment.status = 'REFUNDED';
        order.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: `Refund of ₹${refundAmount} issued` });
        await order.save();

        // Notify customer
        emitToRoom(`customer_${order.customerId}`, 'ORDER_STATUS', {
            orderId: order._id,
            status: 'REFUNDED',
            refundAmount
        });

        return successResponse(res, { amount: refundAmount, walletCredited: true }, 'Refund processed to wallet');

    } catch (error) {
        return errorResponse(res, 'Refund failed: ' + error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
});

/**
 * GET /api/v1/payments/:orderId
 * Get payment details for an order
 */
exports.getPaymentByOrder = catchAsync(async (req, res) => {
    const payment = await Payment.findOne({ orderId: req.params.orderId })
        .populate('userId', 'name phone');

    if (!payment) return errorResponse(res, 'Payment not found', StatusCodes.NOT_FOUND);

    // Ownership check: only the payment owner or admin can view
    if (req.user.role !== 'ADMIN' && payment.userId?._id?.toString() !== req.user._id.toString()) {
        return errorResponse(res, 'Not authorized to view this payment', StatusCodes.FORBIDDEN);
    }

    return successResponse(res, payment, 'Payment fetched');
});

/**
 * GET /api/v1/payments/history
 * Get user's payment history
 */
exports.getPaymentHistory = catchAsync(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await Payment.countDocuments({ userId: req.user._id });
    const payments = await Payment.find({ userId: req.user._id })
        .populate('orderId', 'orderNumber total')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

    return successResponse(res, { payments, total, page: Number(page) }, 'Payment history');
});
