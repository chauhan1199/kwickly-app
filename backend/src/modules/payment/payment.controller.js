const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
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

/**
 * POST /api/v1/payments/create-order
 * Creates a Razorpay order for a given amount
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

    try {
        const rpOrder = await createRazorpayOrder(amount, receipt, notes);

        // Store the order in our DB
        const payment = await Payment.create({
            orderId: orderId || null,
            razorpayOrderId: rpOrder.id,
            amount,
            userId: req.user._id,
            status: 'CREATED',
            metadata: rpOrder
        });

        return successResponse(res, {
            razorpayOrderId: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            paymentId: payment._id,
            keyId: process.env.RAZORPAY_KEY_ID
        }, 'Razorpay order created', StatusCodes.CREATED);

    } catch (error) {
        const errMsg = error.error?.description || error.message || 'Unknown payment error';
        return errorResponse(res, 'Failed to create payment order: ' + errMsg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
});

/**
 * POST /api/v1/payments/verify
 * Verifies payment after Razorpay checkout success
 */
exports.verifyPayment = catchAsync(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return errorResponse(res, 'Missing payment verification fields', StatusCodes.BAD_REQUEST);
    }

    // Verify signature
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
        return errorResponse(res, 'Invalid payment signature', StatusCodes.BAD_REQUEST);
    }

    // Fetch payment details from Razorpay
    let rpPayment;
    try {
        rpPayment = await fetchPayment(razorpayPaymentId);
    } catch (e) {
        // Do NOT fallback to fake data — reject the verification
        return errorResponse(res, 'Unable to verify payment with Razorpay. Please try again.', StatusCodes.BAD_REQUEST);
    }

    // B7 FIX: Use transactions to prevent partial updates
    let session = null;
    let useTransaction = false;
    if (typeof mongoose !== 'undefined' && mongoose.startSession) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) { session = null; useTransaction = false; }
    }

    try {
        const sessOpts = useTransaction ? { session } : {};
        
        // Update our payment record
        const payment = await Payment.findOne({ razorpayOrderId }).session(session);
        if (!payment) {
            if (useTransaction) { await session.abortTransaction(); session.endSession(); }
            return errorResponse(res, 'Payment record not found', StatusCodes.NOT_FOUND);
        }

        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        payment.method = rpPayment.method || 'upi';
        payment.status = rpPayment.status === 'captured' ? 'CAPTURED' : 'AUTHORIZED';
        await payment.save(sessOpts);

        // If linked to an order, update the order
        if (payment.orderId) {
            const order = await ShopOrder.findById(payment.orderId).session(session);
            if (order) {
                order.payment.status = 'PAID';
                order.payment.razorpayOrderId = razorpayOrderId;
                order.payment.razorpayPaymentId = razorpayPaymentId;
                order.payment.method = payment.method?.toUpperCase() || 'UPI';
                order.statusHistory.push({ status: order.status, timestamp: new Date(), note: 'Payment verified' });
                await order.save(sessOpts);

                // Notify shop
                emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
                    orderId: order._id,
                    status: order.status,
                    paymentStatus: 'PAID'
                });
            }
        }

        if (useTransaction) {
            await session.commitTransaction();
            session.endSession();
        }

        return successResponse(res, {
            paymentId: payment._id,
            status: payment.status,
            razorpayPaymentId
        }, 'Payment verified successfully');

    } catch (err) {
        if (useTransaction && session) {
            await session.abortTransaction();
            session.endSession();
        }
        logger.error('Payment verification failed:', err);
        return errorResponse(res, 'Payment verification failed', StatusCodes.INTERNAL_SERVER_ERROR);
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
            payment.status = refundAmount >= order.total ? 'REFUNDED_TO_WALLET' : 'PARTIAL_REFUNDED_TO_WALLET';
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
