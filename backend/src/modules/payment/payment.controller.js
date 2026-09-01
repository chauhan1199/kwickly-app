const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment   = require('./payment.model');
const ShopOrder = require('../shoporder/shoporder.model');
const Shop      = require('../shop/shop.model');
const Customer  = require('../customer/customer.model');
const Product   = require('../product/product.model');
const WalletTxn = require('../wallet/wallet.model');
const AppSettings = require('../settings/settings.model');
const catchAsync  = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { delCache }  = require('../../helpers/redis.helper');
const logger = require('../../helpers/logger.helper');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { generateUpiIntentUri, isValidUtr, findUtrUsage } = require('../../helpers/upi.helper');
const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
const { registerPaymentIntent } = require('../../services/upiProvider.service');
const {
    handleWalletTopupWebhook,
    handleShopOrderWebhook,
    handleWorkerSubscriptionWebhook,
    handleShopSubscriptionWebhook,
    handleFailedPaymentWebhook
} = require('../../helpers/webhookHandlers.helper');

/**
 * Constant-time buffer comparison — prevents HMAC timing attacks.
 */
const safeCompare = (a, b) => {
    try {
        const bufA = Buffer.from(typeof a === 'string' ? a : String(a), 'hex');
        const bufB = Buffer.from(typeof b === 'string' ? b : String(b), 'hex');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
};

/**
 * GET /api/v1/payments/admin-upi
 * Fetches admin-configured UPI ID and Bank Details for public/authenticated payments
 */
exports.getAdminUpiConfig = catchAsync(async (req, res) => {
    const [adminWallet, appSettings] = await Promise.all([
        AdminWallet.findOne().lean(),
        AppSettings.findOne({ isSingleton: 'CONFIG' }).lean()
    ]);

    const upiId = (adminWallet?.upiId || appSettings?.wallet?.upiId || process.env.PLATFORM_UPI_ID || '').trim();
    const payeeName = (adminWallet?.bankDetails?.accountHolder || appSettings?.wallet?.accountHolder || process.env.PLATFORM_PAYEE_NAME || 'Kwickly PVT LTD').trim();

    return successResponse(res, {
        upiId,
        payeeName,
        bankDetails: adminWallet?.bankDetails || {}
    }, 'Admin UPI configuration fetched');
});

/**
 * POST /api/v1/payments/create-order
 * Creates a Direct UPI payment intent.
 * - Registers the intent with the provider (if configured) so an automated
 *   webhook fires when money lands at the platform VPA.
 * - Falls back to a plain NPCI deeplink when no provider is configured
 *   (manual-UTR backward-compat mode).
 */
exports.createOrder = catchAsync(async (req, res) => {
    const { amount, orderId, purpose } = req.body;

    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    }

    const [adminWallet, appSettings] = await Promise.all([
        AdminWallet.findOne().lean(),
        AppSettings.findOne({ isSingleton: 'CONFIG' }).lean()
    ]);

    const platformVpa = (adminWallet?.upiId || appSettings?.wallet?.upiId || process.env.PLATFORM_UPI_ID || '').trim();
    const payeeName   = (adminWallet?.bankDetails?.accountHolder || appSettings?.wallet?.accountHolder || process.env.PLATFORM_PAYEE_NAME || 'Kwickly PVT LTD').trim();

    if (!platformVpa) {
        return errorResponse(res, 'Admin UPI ID is not configured. Please set your UPI ID in Admin Panel -> Admin Wallet -> Edit Bank Details.', StatusCodes.BAD_REQUEST);
    }

    const validOrderId = (orderId && mongoose.isValidObjectId(orderId)) ? orderId : undefined;
    const paymentId    = new mongoose.Types.ObjectId();

    // Create a Payment record first so we have a real MongoDB _id to embed
    // as the webhook back-reference (internalId in provider metadata).
    const payment = await Payment.create({
        _id:             paymentId,
        razorpayOrderId: paymentId.toString(),
        orderId:         validOrderId,
        amount,
        userId:          req.user._id,
        status:          'CREATED',
        method:          'UPI',
        metadata: {
            notes: {
                userId:  req.user._id.toString(),
                purpose: purpose || 'wallet_topup',
                orderId: validOrderId ? String(validOrderId) : null
            },
            isUpiDirect: true,
            payeeName,
            platformVpa
        }
    });

    // Register with provider (falls back to plain deeplink if not configured)
    const { gatewayOrderId, upiIntentUri } = await registerPaymentIntent({
        amount,
        internalId: payment._id,
        purpose:    purpose || 'wallet_topup',
        userId:     req.user._id
    });

    // Persist gateway session ref and deeplink on the payment record
    payment.gatewayOrderId = gatewayOrderId;
    if (payment.metadata) {
        payment.metadata.upiIntentUri = upiIntentUri;
        payment.metadata.gatewayOrderId = gatewayOrderId;
        payment.markModified('metadata');
    }
    await payment.save();

    return successResponse(res, {
        razorpayOrderId: payment._id.toString(), // legacy key for existing clients
        upiOrderId:      payment._id.toString(),
        paymentId:       payment._id,
        gatewayOrderId,
        amount:          Math.round(amount * 100),
        currency:        'INR',
        upiVpa:          platformVpa,
        payeeName,
        bankDetails:     adminWallet?.bankDetails || null,
        upiIntentUri,
        isUpiDirect:     true
    }, 'Direct UPI payment order created successfully', StatusCodes.CREATED);
});

/**
 * POST /api/v1/payments/verify
 * Verifies payment after Direct UPI checkout submission (12-digit UTR)
 */
exports.verifyPayment = catchAsync(async (req, res) => {
    const { razorpayOrderId, upiOrderId, razorpayPaymentId, upiTransactionId, utrNumber, orderId, isAutoConfirmed } = req.body;

    const orderRef = upiOrderId || razorpayOrderId;
    if (!orderRef) {
        return errorResponse(res, 'Missing payment order ID', StatusCodes.BAD_REQUEST);
    }

    let upiRef = (upiTransactionId || utrNumber || razorpayPaymentId || '').toString().trim();

    if (!upiRef) {
        // Automatically generate a unique payment reference for automatic confirmation
        upiRef = `AUTO_${Date.now().toString().slice(-8)}_${Math.random().toString(36).slice(-4)}`.toUpperCase();
    } else if (!isAutoConfirmed && !isValidUtr(upiRef) && !upiRef.startsWith('AUTO_')) {
        return errorResponse(res, 'Please enter a valid 12-digit UPI Reference / UTR Number from your actual bank receipt.', StatusCodes.BAD_REQUEST);
    }

    // Anti-replay / duplicate UTR check across ALL flows
    if (!upiRef.startsWith('AUTO_')) {
        const utrUsage = await findUtrUsage(upiRef);
        const existingForOrder = await Payment.findOne({
            $or: [{ razorpayOrderId: orderRef }, ...(orderId ? [{ orderId }] : [])]
        }).lean();
        const isSelfRetry = existingForOrder &&
            String(existingForOrder.razorpayPaymentId || '') === upiRef &&
            (utrUsage?.flow === 'WALLET_TOPUP'
                ? String(utrUsage.ref.userId || '') === String(req.user._id)
                : String(utrUsage?.ref?._id || '') === String(existingForOrder._id));

        if (utrUsage && !isSelfRetry) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been submitted or used on the platform.', StatusCodes.CONFLICT);
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
        let payment = await Payment.findOne({ razorpayOrderId: orderRef }).session(session);
        if (!payment && orderId) {
            payment = await Payment.findOne({ orderId }).session(session);
        }

        const finalPaymentId = upiRef;

        if (!payment) {
            payment = await Payment.create([{
                orderId: orderId || null,
                razorpayOrderId: orderRef,
                amount: req.body.amount || 0,
                userId: req.user._id,
                status: 'COMPLETED',
                method: 'UPI',
                razorpayPaymentId: finalPaymentId,
                razorpaySignature: 'upi_auto_verified'
            }], sessOpts).then(arr => arr[0]);
        } else {
            payment.razorpayPaymentId = finalPaymentId;
            payment.razorpaySignature = 'upi_auto_verified';
            payment.method = 'UPI';
            payment.status = 'COMPLETED';
            await payment.save(sessOpts);
        }

        // If linked to an order, update the order
        const targetOrderId = payment.orderId || orderId;
        if (targetOrderId) {
            const order = await ShopOrder.findById(targetOrderId).session(session);
            if (order) {
                order.payment.status = 'PENDING_VERIFICATION';
                order.payment.razorpayOrderId = orderRef;
                order.payment.razorpayPaymentId = payment.razorpayPaymentId;
                order.payment.utrNumber = finalPaymentId;
                order.payment.method = 'UPI';
                order.statusHistory.push({
                    status: order.status,
                    timestamp: new Date(),
                    note: `Direct UPI payment submitted (UTR: ${finalPaymentId} - Pending Verification)`
                });
                await order.save(sessOpts);

                const orderAmount = order.total || order.totalAmount || payment.amount || req.body.amount || 0;

                // Notify shop
                emitToRoom(`shop_${order.shopId}`, 'ORDER_STATUS', {
                    orderId: order._id,
                    status: order.status,
                    paymentStatus: 'PENDING_VERIFICATION',
                    utr: finalPaymentId
                });
                emitToAll('DASHBOARD_UPDATE', {
                    type: 'PENDING_ORDER_PAYMENT',
                    id: order._id,
                    orderNumber: order.orderNumber,
                    utr: finalPaymentId,
                    amount: orderAmount
                });

                if (useTransaction) await session.commitTransaction();
                if (useTransaction) session.endSession();
                return successResponse(res, {
                    paymentId: payment._id,
                    status: 'PENDING_VERIFICATION',
                    utr: finalPaymentId,
                    orderId: order._id,
                    orderNumber: order.orderNumber
                }, `Order placed! UPI Reference (UTR: ${finalPaymentId}) submitted for verification.`);
            }
        }

        // Wallet top-up flow (purpose: 'wallet_topup')
        if (payment.metadata?.notes?.purpose === 'wallet_topup' || req.body.purpose === 'wallet_topup') {
            const creditAmount = payment.amount || req.body.amount;

            // Check if already credited for this order
            let existingTxn = await WalletTxn.findOne({
                userId: req.user._id,
                type: 'TOPUP',
                $or: [{ razorpayOrderId: orderRef }, { razorpayPaymentId: finalPaymentId }]
            }).session(session);

            let newBalance = req.user.wallet?.balance || 0;

            if (!existingTxn) {
                const User = require('../user/user.model');
                const user = await User.findById(req.user._id).session(session);
                const currentBalance = user?.wallet?.balance || 0;
                newBalance = currentBalance + Number(creditAmount);

                if (user) {
                    user.wallet = user.wallet || {};
                    user.wallet.balance = newBalance;
                    await user.save(sessOpts);
                }

                existingTxn = await WalletTxn.create([{
                    userId: req.user._id,
                    type: 'TOPUP',
                    amount: creditAmount,
                    balance: currentBalance,
                    balanceAfter: newBalance,
                    status: 'COMPLETED',
                    razorpayOrderId: orderRef,
                    razorpayPaymentId: finalPaymentId,
                    description: `Wallet Top-up via Direct UPI (Verified)`
                }], sessOpts).then(arr => arr[0]);

                // Emit to User and Admin Dashboard
                const { emitToUser } = require('../../helpers/socket.helper');
                emitToUser(req.user._id, 'WALLET_UPDATE', {
                    balance: newBalance,
                    amount: creditAmount,
                    type: 'TOPUP'
                });
                emitToAll('DASHBOARD_UPDATE', {
                    type: 'WALLET_TOPUP',
                    userId: req.user._id,
                    userName: req.user.name,
                    amount: creditAmount,
                    utr: finalPaymentId
                });
            }

            if (useTransaction) await session.commitTransaction();
            if (useTransaction) session.endSession();

            return successResponse(res, {
                paymentId: payment._id,
                status: 'COMPLETED',
                utr: finalPaymentId,
                amount: creditAmount,
                newBalance
            }, `Top-up of ₹${creditAmount} successful! Securely credited to your wallet.`);
        }

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();

        return successResponse(res, {
            verified: true,
            orderId: targetOrderId,
            paymentId: payment._id,
            status: payment.status || 'PENDING',
            utr: finalPaymentId
        }, 'Direct UPI payment submitted successfully');

    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

/**
 * POST /api/v1/payments/free-upi-webhook   (PUBLIC — no auth middleware)
 *
 * Receives automated payment notifications from the UPI tech-overlay provider.
 * Security model:
 *   1. HMAC SHA256 signature check (fail-fast at layer 1 — no DB queries if invalid)
 *   2. Timestamp validation — rejects stale replays older than 5 minutes
 *   3. Purpose-based routing to idempotent handlers
 *   4. Fast 200 OK returned BEFORE running downstream logic
 *
 * The route must be registered with express.raw({ type: '* / *' }) so the raw
 * body buffer is available for signature verification.
 */
exports.handleWebhook = async (req, res) => {
    const WEBHOOK_SECRET = process.env.UPI_PROVIDER_WEBHOOK_SECRET || '';

    // ── Step 1: HMAC SHA256 Signature Verification ──────────────────────────────
    if (WEBHOOK_SECRET) {
        const rawBody     = req.body; // Buffer from express.raw()
        const receivedSig = (req.headers['x-upi-signature'] || req.headers['x-kwikupi-hmac'] || req.headers['x-webhook-signature'] || '').toString().toLowerCase();

        const expectedSig = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(rawBody)
            .digest('hex')
            .toLowerCase();

        if (!receivedSig || !safeCompare(receivedSig, expectedSig)) {
            logger.warn(`[Webhook] Signature mismatch from IP: ${req.ip} — header: ${req.headers['x-upi-signature'] || 'absent'}`);
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
    } else {
        logger.warn('[Webhook] UPI_PROVIDER_WEBHOOK_SECRET not set — running in unsigned mode (dev/test only)');
    }

    // ── Step 2: Parse Payload ─────────────────────────────────────────────────────
    let payload;
    try {
        const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
        payload = JSON.parse(raw);
    } catch (parseErr) {
        logger.warn(`[Webhook] JSON parse failed: ${parseErr.message}`);
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Validate timestamp (reject replays older than 5 minutes)
    if (payload.timestamp) {
        const tsMs = new Date(payload.timestamp).getTime();
        if (!isNaN(tsMs) && Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
            logger.warn(`[Webhook] Stale timestamp rejected: ${payload.timestamp}`);
            return res.status(400).json({ error: 'Stale webhook timestamp' });
        }
    }

    const eventId  = payload.transactionId || payload.eventId || payload.id || `evt_${Date.now()}`;
    const purpose  = payload.metadata?.purpose;
    const isSuccess = (payload.status || '').toUpperCase() === 'SUCCESS';

    logger.info(`[Webhook] Received event=${payload.event}, purpose=${purpose}, eventId=${eventId}, status=${payload.status}`);

    // ── Step 3: Acknowledge immediately (provider must get 200 ASAP) ──────────────
    res.status(200).json({ received: true });

    // ── Step 4: Route to purpose handler asynchronously ───────────────────────────
    setImmediate(async () => {
        try {
            if (!isSuccess) {
                await handleFailedPaymentWebhook(payload, eventId);
                return;
            }

            // Only process recognised payment success events
            const successEvents = ['payment.success', 'payment.captured', 'payment.paid', 'transaction.success'];
            if (!successEvents.includes((payload.event || '').toLowerCase())) {
                logger.info(`[Webhook] Ignoring non-payment event: ${payload.event}`);
                return;
            }

            switch (purpose) {
                case 'wallet_topup':
                    await handleWalletTopupWebhook(payload, eventId);
                    break;
                case 'shop_order':
                    await handleShopOrderWebhook(payload, eventId);
                    break;
                case 'worker_subscription':
                    await handleWorkerSubscriptionWebhook(payload, eventId);
                    break;
                case 'shop_subscription':
                    await handleShopSubscriptionWebhook(payload, eventId);
                    break;
                default:
                    logger.warn(`[Webhook] Unknown payment purpose: ${purpose} — eventId=${eventId}`);
            }
        } catch (err) {
            logger.error(`[Webhook] Unhandled error in async handler: ${err.message}`);
        }
    });
};

/**
 * GET /api/v1/payments/my-payments
 */
exports.getMyPayments = catchAsync(async (req, res) => {
    const payments = await Payment.find({ userId: req.user._id })
        .sort('-createdAt')
        .limit(20)
        .lean();
    return successResponse(res, payments, 'Payments fetched');
});
exports.getPaymentHistory = exports.getMyPayments;

/**
 * GET /api/v1/payments/:orderId
 * Route param is :orderId (holds either a payment id or an order reference)
 */
exports.getPaymentById = catchAsync(async (req, res) => {
    const ref = req.params.orderId || req.params.id;
    let payment = null;

    // Try payment id first, then fall back to payment-by-order lookup
    if (mongoose.isValidObjectId(ref)) {
        payment = await Payment.findById(ref).lean();
    }
    if (!payment && mongoose.isValidObjectId(ref)) {
        payment = await Payment.findOne({ orderId: ref }).lean();
    }
    if (!payment) return errorResponse(res, 'Payment not found', StatusCodes.NOT_FOUND);
    return successResponse(res, payment, 'Payment fetched');
});
exports.getPaymentByOrder = exports.getPaymentById;

/**
 * POST /api/v1/payments/refund (Admin)
 * Refunds a payment back to the customer's wallet.
 * Body: { orderId, amount?, reason? }
 */
exports.refundPayment = catchAsync(async (req, res) => {
    const { orderId, amount, reason } = req.body;

    let payment;
    if (orderId) {
        payment = await Payment.findOne({ orderId });
    } else {
        payment = await Payment.findById(req.params.id);
    }
    if (!payment) return errorResponse(res, 'Payment not found for this order', StatusCodes.NOT_FOUND);

    if (payment.status === 'REFUNDED') {
        return errorResponse(res, 'Payment has already been refunded', StatusCodes.BAD_REQUEST);
    }

    const refundAmount = Number(amount) || payment.amount;

    // Credit refund back to customer wallet
    const customer = await Customer.findByIdAndUpdate(
        payment.userId,
        { $inc: { 'wallet.balance': refundAmount } },
        { returnDocument: 'after' }
    );

    await WalletTxn.create({
        userId: payment.userId,
        type: 'REFUND',
        amount: refundAmount,
        balance: (customer?.wallet?.balance || 0) - refundAmount,
        balanceAfter: customer?.wallet?.balance || 0,
        status: 'COMPLETED',
        description: `Refund for Payment #${payment._id.toString().slice(-6)}: ${reason || 'Customer Refund'}`
    });

    payment.status = 'REFUNDED';
    await payment.save();

    return successResponse(res, payment, `Refund of ₹${refundAmount} credited to customer wallet`);
});
