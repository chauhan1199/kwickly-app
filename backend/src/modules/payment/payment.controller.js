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
const { generateUpiIntentUri, isValidUtr } = require('../../helpers/upi.helper');
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
 * Creates a Pure Direct UPI order (NPCI Intent) for a given amount
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

    const adminWallet = await AdminWallet.findOne().lean();
    const platformVpa = adminWallet?.upiId || process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi';
    const payeeName = adminWallet?.bankDetails?.accountHolder || 'Kwickly PVT LTD';
    const upiOrderId = `upi_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const { uri: upiIntentUri } = generateUpiIntentUri({
        vpa: platformVpa,
        payeeName,
        amount,
        purpose,
        orderId,
        txnId: upiOrderId
    });

    // Store the payment order in our DB
    const payment = await Payment.create({
        orderId: orderId || null,
        razorpayOrderId: upiOrderId, // maintain field for backward compatibility
        amount,
        userId: req.user._id,
        status: 'CREATED',
        method: 'UPI',
        metadata: {
            receipt,
            notes,
            isUpiDirect: true,
            upiIntentUri,
            payeeName,
            platformVpa
        }
    });

    return successResponse(res, {
        razorpayOrderId: upiOrderId, // for existing clients
        upiOrderId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        paymentId: payment._id,
        upiVpa: platformVpa,
        payeeName,
        bankDetails: adminWallet?.bankDetails || null,
        upiIntentUri,
        isUpiDirect: true
    }, 'Direct UPI payment order created successfully', StatusCodes.CREATED);
});

/**
 * POST /api/v1/payments/verify
 * Verifies payment after Direct UPI checkout submission (12-digit UTR)
 */
exports.verifyPayment = catchAsync(async (req, res) => {
    const { razorpayOrderId, upiOrderId, razorpayPaymentId, upiTransactionId, utrNumber, orderId } = req.body;

    const orderRef = upiOrderId || razorpayOrderId;
    if (!orderRef) {
        return errorResponse(res, 'Missing payment order ID', StatusCodes.BAD_REQUEST);
    }

    const upiRef = (upiTransactionId || utrNumber || razorpayPaymentId || '').toString().trim();

    if (!upiRef || !isValidUtr(upiRef)) {
        return errorResponse(res, 'Please enter a valid 12-digit UPI Reference / UTR Number from your actual bank receipt.', StatusCodes.BAD_REQUEST);
    }

    // Anti-replay / duplicate UTR check across past transactions
    const existingTxn = await WalletTxn.findOne({
        razorpayPaymentId: upiRef,
        status: 'COMPLETED'
    }).lean();

    if (existingTxn) {
        return errorResponse(res, 'This UPI Reference / Transaction ID has already been credited to your wallet.', StatusCodes.CONFLICT);
    }

    const existingPayment = await Payment.findOne({
        razorpayPaymentId: upiRef,
        status: 'CAPTURED',
        razorpayOrderId: { $ne: orderRef }
    }).lean();

    if (existingPayment) {
        return errorResponse(res, 'This UPI Reference / Transaction ID has already been used for another payment.', StatusCodes.CONFLICT);
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
                status: 'PENDING',
                method: 'UPI',
                razorpayPaymentId: finalPaymentId,
                razorpaySignature: 'upi_verified'
            }], sessOpts).then(arr => arr[0]);
        } else {
            payment.razorpayPaymentId = finalPaymentId;
            payment.razorpaySignature = 'upi_verified';
            payment.method = 'UPI';
            payment.status = 'PENDING';
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

            // Manual UTR submission -> Hold in PENDING status for Admin Verification
            const existingPending = await WalletTxn.findOne({
                userId: req.user._id,
                type: 'TOPUP',
                razorpayPaymentId: finalPaymentId
            }).session(session);

            if (!existingPending) {
                await WalletTxn.create([{
                    userId: req.user._id,
                    type: 'TOPUP',
                    amount: creditAmount,
                    balance: req.user.wallet?.balance || 0,
                    balanceAfter: req.user.wallet?.balance || 0,
                    status: 'PENDING',
                    razorpayPaymentId: finalPaymentId,
                    description: `Wallet Top-up (Pending Admin Verification - UTR: ${finalPaymentId})`
                }], { session });

                // Emit to Admin Dashboard
                emitToAll('DASHBOARD_UPDATE', {
                    type: 'PENDING_WALLET_TOPUP',
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
                status: 'PENDING_VERIFICATION',
                utr: finalPaymentId,
                amount: creditAmount
            }, `Top-up request for ₹${creditAmount} submitted! It will be verified and credited to your wallet.`);
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
 * POST /api/v1/payments/webhook
 * Safe fallback for webhook endpoints (returns 200 OK)
 */
exports.handleWebhook = catchAsync(async (req, res) => {
    return res.status(200).json({ status: 'ok', message: 'Direct UPI payment mode active' });
});

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

/**
 * GET /api/v1/payments/:id
 */
exports.getPaymentById = catchAsync(async (req, res) => {
    const payment = await Payment.findById(req.params.id).lean();
    if (!payment) return errorResponse(res, 'Payment not found', StatusCodes.NOT_FOUND);
    return successResponse(res, payment, 'Payment fetched');
});

/**
 * POST /api/v1/payments/:id/refund
 */
exports.refundPayment = catchAsync(async (req, res) => {
    const { amount, reason } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return errorResponse(res, 'Payment not found', StatusCodes.NOT_FOUND);

    const refundAmount = amount || payment.amount;

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
