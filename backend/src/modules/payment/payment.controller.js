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
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { generateUpiIntentUri, isValidUtr, findUtrUsage, extractSmsAmount, extractSmsDate, verifyIntentResponse, isAuthenticBankDebitSms, isAdjacentOrTamperedUtr } = require('../../helpers/upi.helper');
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

    const platformVpa = (adminWallet?.upiId || appSettings?.wallet?.upiId || process.env.PLATFORM_UPI_ID || (process.env.NODE_ENV === 'test' ? 'kwickly@upi' : '')).trim();
    const payeeName = (adminWallet?.bankDetails?.accountHolder || appSettings?.wallet?.accountHolder || process.env.PLATFORM_PAYEE_NAME || 'Kwickly PVT LTD').trim();

    if (!platformVpa) {
        return errorResponse(res, 'Admin UPI ID is not configured. Please set your UPI ID in Admin Panel -> Admin Wallet -> Edit Bank Details.', StatusCodes.BAD_REQUEST);
    }

    const validOrderId = (orderId && mongoose.isValidObjectId(orderId)) ? orderId : undefined;
    const paymentId = new mongoose.Types.ObjectId();

    // Create a Payment record first so we have a real MongoDB _id to embed
    // as the webhook back-reference (internalId in provider metadata).
    const payment = await Payment.create({
        _id: paymentId,
        razorpayOrderId: paymentId.toString(),
        orderId: validOrderId,
        amount,
        userId: req.user._id,
        status: 'CREATED',
        method: 'UPI',
        metadata: {
            notes: {
                userId: req.user._id.toString(),
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
        purpose: purpose || 'wallet_topup',
        userId: req.user._id
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
        upiOrderId: payment._id.toString(),
        paymentId: payment._id,
        gatewayOrderId,
        amount: Math.round(amount * 100),
        currency: 'INR',
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
    const {
        razorpayOrderId,
        upiOrderId,
        razorpayPaymentId,
        upiTransactionId,
        utrNumber,
        orderId,
        rawMessage,
        smsText,
        detectedAmount,
        isIntentVerified,
        intentStatus,
        responseCode,
        rawResponse,
        txnId
    } = req.body;

    const orderRef = upiOrderId || razorpayOrderId;
    if (!orderRef) {
        return errorResponse(res, 'Missing payment order ID', StatusCodes.BAD_REQUEST);
    }

    let upiRef = (upiTransactionId || utrNumber || razorpayPaymentId || '').toString().trim();

    if (!upiRef) {
        return errorResponse(res, 'Please enter the 12-digit UPI Reference / UTR Number from your actual bank receipt or SMS.', StatusCodes.BAD_REQUEST);
    }

    // Strict 12-digit NPCI UTR validation — Zero bypass allowed
    if (!isValidUtr(upiRef)) {
        return errorResponse(res, 'Please enter a valid 12-digit UPI Reference / UTR Number from your actual bank receipt or SMS.', StatusCodes.BAD_REQUEST);
    }

    const finalPaymentId = upiRef;

    // Strict SMS Text Content Validation (if raw SMS / clipboard text was submitted)
    const rawSms = (rawMessage || smsText || '').toString().trim();
    if (rawSms) {
        const parsedSmsAmt = extractSmsAmount(rawSms);
        const expectedAmt = Number(req.body.amount || 0);
        if (parsedSmsAmt !== null && expectedAmt > 0) {
            const diff = Math.abs(parsedSmsAmt - expectedAmt);
            const roundedMatches = Math.round(parsedSmsAmt) === Math.round(expectedAmt);
            if (diff > 1.01 && !roundedMatches) {
                return errorResponse(
                    res,
                    `Amount mismatch: The copied bank SMS indicates a payment of ₹${parsedSmsAmt.toFixed(2)}, but this transaction requires ₹${expectedAmt.toFixed(2)}. Only transactions made for ₹${expectedAmt.toFixed(2)} are valid.`,
                    StatusCodes.BAD_REQUEST
                );
            }
        }
    }

    // Anti-replay / duplicate UTR check across ALL flows
    const utrUsage = await findUtrUsage(finalPaymentId);
    const existingForOrder = await Payment.findOne({
        $or: [{ razorpayOrderId: orderRef }, ...(orderId ? [{ orderId }] : [])]
    }).lean();
    const isSelfRetry = existingForOrder &&
        String(existingForOrder.razorpayPaymentId || '') === finalPaymentId &&
        utrUsage?.flow === 'PAYMENT' &&
        String(utrUsage?.ref?._id || '') === String(existingForOrder._id);

    if (utrUsage && !isSelfRetry) {
        return errorResponse(res, 'This UPI Reference / Transaction ID has already been submitted or used on the platform.', StatusCodes.CONFLICT);
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
        const validOrderId = orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : undefined;

        if (!payment) {
            payment = await Payment.create([{
                orderId: validOrderId,
                razorpayOrderId: orderRef,
                amount: Number(req.body.amount) || 0,
                userId: req.user._id,
                status: 'PENDING',
                method: 'UPI',
                metadata: { notes: { purpose: req.body.purpose || 'wallet_topup' } },
                razorpayPaymentId: finalPaymentId
            }], sessOpts).then(arr => arr[0]);
        } else {
            payment.razorpayPaymentId = finalPaymentId;
            payment.method = 'UPI';
            if (req.body.purpose && !payment.metadata?.notes?.purpose) {
                payment.metadata = payment.metadata || {};
                payment.metadata.notes = payment.metadata.notes || {};
                payment.metadata.notes.purpose = req.body.purpose;
            }
            await payment.save(sessOpts);
        }

        // If linked to an order, update the order to PENDING_VERIFICATION
        const targetOrderId = (payment?.orderId || validOrderId) ? String(payment?.orderId || validOrderId) : null;
        if (targetOrderId && mongoose.Types.ObjectId.isValid(targetOrderId)) {
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
            const creditAmount = Number(payment.amount || req.body.amount);

            // Check if already credited by bank webhook for this order or UTR
            let existingCompletedTxn = await WalletTxn.findOne({
                userId: req.user._id,
                type: 'TOPUP',
                status: 'COMPLETED',
                $or: [{ razorpayOrderId: orderRef }, { razorpayPaymentId: finalPaymentId }]
            }).session(session);

            if (existingCompletedTxn) {
                if (useTransaction) await session.commitTransaction();
                if (useTransaction) session.endSession();

                return successResponse(res, {
                    paymentId: payment._id,
                    status: 'COMPLETED',
                    verified: true,
                    utr: finalPaymentId,
                    amount: creditAmount,
                    newBalance: existingCompletedTxn.balance
                }, `Top-up of ₹${creditAmount} verified and credited to your wallet.`);
            }

            // ─── 1. Strict Replay Protection: UTR can NEVER be reused across the platform ───
            const duplicateCompleted = await WalletTxn.findOne({
                razorpayPaymentId: finalPaymentId,
                status: 'COMPLETED'
            }).session(session);

            if (duplicateCompleted) {
                if (useTransaction) await session.commitTransaction();
                if (useTransaction) session.endSession();
                return errorResponse(res, `This UPI Reference (UTR: ${finalPaymentId}) has already been credited.`, StatusCodes.BAD_REQUEST);
            }

            // ─── 2. Register & Claim Bank Credit Record ───
            const BankCredit = require('./bankCredit.model');
            let existingBankCredit = await BankCredit.findOne({
                utr: finalPaymentId
            }).session(session);

            if (existingBankCredit) {
                if (existingBankCredit.isClaimed) {
                    if (useTransaction) await session.commitTransaction();
                    if (useTransaction) session.endSession();
                    return errorResponse(res, `This UPI Reference (UTR: ${finalPaymentId}) has already been claimed and credited.`, StatusCodes.BAD_REQUEST);
                }

                // Strict amount check: existing BankCredit amount MUST match requested top-up amount
                if (Math.abs(existingBankCredit.amount - creditAmount) > 0.5) {
                    if (useTransaction) await session.commitTransaction();
                    if (useTransaction) session.endSession();
                    return errorResponse(
                        res,
                        `Amount mismatch: Bank records confirm UTR ${finalPaymentId} was for ₹${existingBankCredit.amount.toFixed(2)}, but your top-up requires ₹${creditAmount.toFixed(2)}. Only the transaction made for ₹${creditAmount.toFixed(2)} is valid.`,
                        StatusCodes.BAD_REQUEST
                    );
                }

                existingBankCredit.isClaimed = true;
                existingBankCredit.claimedBy = req.user._id;
                existingBankCredit.claimedAt = new Date();
                await existingBankCredit.save(sessOpts);
            } else {
                // If BankCredit was not pre-recorded in database:
                const hasValidIntent = verifyIntentResponse({
                    isIntentVerified: Boolean(isIntentVerified),
                    intentStatus,
                    responseCode,
                    rawResponse,
                    utr: finalPaymentId,
                    expectedRef: orderRef
                });

                const rawSms = (rawMessage || smsText || '').toString().trim();
                const hasValidSms = isAuthenticBankDebitSms({
                    rawMessage: rawSms,
                    utr: finalPaymentId,
                    expectedAmount: creditAmount,
                    payeeName: payment.metadata?.payeeName,
                    vpa: payment.metadata?.platformVpa
                });

                // Anti-tamper & Loophole check:
                // Check if candidate UTR is suspiciously adjacent (±15) to any recently recorded transaction
                const recentCredits = await BankCredit.find({}).sort({ _id: -1 }).limit(50).select('utr').lean();
                const recentUtrs = recentCredits.map(r => r.utr);
                const isTampered = isAdjacentOrTamperedUtr(finalPaymentId, recentUtrs);

                if (isTampered && !hasValidSms && !hasValidIntent) {
                    if (useTransaction) await session.commitTransaction();
                    if (useTransaction) session.endSession();
                    return errorResponse(
                        res,
                        `Suspicious reference number: UTR ${finalPaymentId} is adjacent to a recently used transaction. To protect against unauthorized entry, please provide your authentic bank debit SMS text.`,
                        StatusCodes.BAD_REQUEST
                    );
                }

                // Check session freshness: reject orders older than 30 minutes
                if (payment.createdAt && (Date.now() - new Date(payment.createdAt).getTime()) > 30 * 60 * 1000) {
                    if (useTransaction) await session.commitTransaction();
                    if (useTransaction) session.endSession();
                    return errorResponse(res, 'This payment session has expired (exceeded 30 minutes). Please initiate a fresh top-up.', StatusCodes.BAD_REQUEST);
                }

                let source = 'MANUAL_UTR';
                if (hasValidIntent) source = 'UPI_INTENT';
                else if (hasValidSms) source = 'BANK_SMS';

                await BankCredit.create([{
                    utr: finalPaymentId,
                    amount: creditAmount,
                    rawMessage: hasValidIntent ? (rawResponse || `Direct UPI payment session ${orderRef} intent verified for user ${req.user._id}`) : (hasValidSms ? rawSms : `Manual UTR entry ${finalPaymentId} for session ${orderRef}`),
                    source,
                    receivedAt: new Date(),
                    isClaimed: true,
                    claimedBy: req.user._id,
                    claimedAt: new Date()
                }], sessOpts);
            }

            // ─── 3. Credit the User Wallet Balance (Role-Aware) ───
            let newBalance;
            if (req.user.role === 'SHOP') {
                const Shop = require('../shop/shop.model');
                const updatedShop = await Shop.findOneAndUpdate(
                    { ownerId: req.user._id },
                    { $inc: { 'wallet.balance': creditAmount } },
                    { returnDocument: 'after', ...(useTransaction ? { session } : {}) }
                );
                newBalance = updatedShop?.wallet?.balance ?? creditAmount;
            } else {
                const updatedUser = await Customer.findByIdAndUpdate(
                    req.user._id,
                    { $inc: { 'wallet.balance': creditAmount } },
                    { returnDocument: 'after', ...(useTransaction ? { session } : {}) }
                );
                newBalance = updatedUser?.wallet?.balance ?? creditAmount;
            }

            // Mark Payment as COMPLETED
            payment.status = 'COMPLETED';
            payment.razorpayPaymentId = finalPaymentId;
            payment.markModified('metadata');
            await payment.save(sessOpts);

            // Check for existing PENDING txn and upgrade it, or create new COMPLETED one
            let walletTxn = await WalletTxn.findOne({
                userId: req.user._id,
                type: 'TOPUP',
                $or: [{ _id: payment._id }, { razorpayOrderId: orderRef }]
            }).session(session);

            if (walletTxn) {
                walletTxn.status = 'COMPLETED';
                walletTxn.razorpayPaymentId = finalPaymentId;
                walletTxn.balance = newBalance;
                walletTxn.verifiedAt = new Date();
                walletTxn.description = `Wallet Top-up via Direct UPI (Verified)`;
                await walletTxn.save(sessOpts);
            } else {
                walletTxn = await WalletTxn.create([{
                    userId: req.user._id,
                    type: 'TOPUP',
                    amount: creditAmount,
                    balance: newBalance,
                    status: 'COMPLETED',
                    razorpayOrderId: orderRef,
                    razorpayPaymentId: finalPaymentId,
                    verifiedAt: new Date(),
                    description: `Wallet Top-up via Direct UPI (Verified)`
                }], sessOpts).then(arr => arr[0]);
            }

            // Credit admin treasury helper
            const { creditAdminTreasury } = require('../../helpers/webhookHandlers.helper');

            if (useTransaction) await session.commitTransaction();
            if (useTransaction) session.endSession();

            // Fire-and-forget async tasks (after transaction committed)
            setImmediate(async () => {
                try {
                    if (typeof creditAdminTreasury === 'function') {
                        await creditAdminTreasury({
                            amount: creditAmount,
                            description: `Wallet topup via Direct UPI — ${req.user?.role || 'User'} ${req.user?.name || req.user._id} (UTR: ${finalPaymentId})`,
                            referenceId: walletTxn._id || payment._id,
                            referenceModel: 'WalletTxn',
                            type: 'TOPUP'
                        });
                    }

                    // Clear cache
                    await delCache(`session:${req.user._id}`);
                    await delCache('admin_dashboard_stats');

                    // In-app & push notification
                    const { notifyUser } = require('../../helpers/notifyUser.helper');
                    await notifyUser({
                        userId: req.user._id,
                        title: 'Wallet Topped Up ✓',
                        message: `₹${creditAmount} has been added to your Kwickly Wallet instantly. (UTR: ${finalPaymentId}) New Balance: ₹${newBalance}`,
                        type: 'WALLET_CREDIT',
                        action: 'WALLET_CREDIT',
                        entityType: 'WALLET',
                        entityId: walletTxn._id,
                        referenceId: walletTxn._id,
                        referenceModel: 'WalletTxn',
                        targetRole: req.user?.role || 'CUSTOMER'
                    });

                    // Emit real-time socket events
                    const { emitToUser } = require('../../helpers/socket.helper');
                    emitToUser(String(req.user._id), 'WALLET_TOPUP_APPROVED', {
                        amount: creditAmount,
                        newBalance,
                        txnId: walletTxn._id,
                        utr: finalPaymentId
                    });
                    emitToUser(String(req.user._id), 'WALLET_UPDATE', {
                        balance: newBalance,
                        amount: creditAmount,
                        type: 'TOPUP'
                    });
                    emitToAll('DASHBOARD_UPDATE', {
                        type: 'WALLET_TOPUP_APPROVED',
                        txnId: walletTxn._id,
                        userId: req.user._id,
                        amount: creditAmount
                    });
                } catch (asyncErr) {
                    logger.error(`[VerifyPayment] Async post-credit error: ${asyncErr.message}`);
                }
            });

            logger.info(`[VerifyPayment] ✓ Successfully credited ₹${creditAmount} to ${req.user?.role || 'user'} ${req.user._id} — UTR=${finalPaymentId}, newBalance=${newBalance}`);

            return successResponse(res, {
                paymentId: payment._id,
                status: 'COMPLETED',
                verified: true,
                utr: finalPaymentId,
                amount: creditAmount,
                newBalance
            }, `₹${creditAmount} verified and credited to your Kwickly Wallet!`);
        }

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();

        return successResponse(res, {
            verified: payment.status === 'COMPLETED',
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
    const WEBHOOK_SECRET = process.env.UPI_PROVIDER_WEBHOOK_SECRET || 'kwickly_p2p_webhook_secret_2026';

    // ── Step 1: Authentication & Signature Verification ──────────────────────────────
    const rawBody = req.body; // Buffer from express.raw()
    const receivedSig = (
        req.headers['x-upi-signature'] ||
        req.headers['x-kwikupi-hmac'] ||
        req.headers['x-webhook-signature'] ||
        req.headers['x-webhook-secret'] ||
        req.headers['authorization'] ||
        req.query?.secret ||
        req.query?.token ||
        ''
    ).toString().trim();

    const expectedHmac = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')
        .toLowerCase();

    // ── Step 2: Parse Payload ─────────────────────────────────────────────────────
    let payload = {};
    try {
        const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
        payload = JSON.parse(raw);
    } catch (parseErr) {
        // If body is plain text SMS
        const rawStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
        if (rawStr && (rawStr.includes('credited') || rawStr.includes('Ref No') || rawStr.includes('UPI'))) {
            payload = { message: rawStr };
        } else {
            logger.warn(`[Webhook] JSON parse failed: ${parseErr.message}`);
            return res.status(400).json({ error: 'Invalid JSON payload' });
        }
    }

    const isHmacValid = safeCompare(receivedSig.toLowerCase(), expectedHmac);
    const isDirectSecretValid = (
        receivedSig === WEBHOOK_SECRET ||
        receivedSig === `Bearer ${WEBHOOK_SECRET}` ||
        receivedSig.toLowerCase() === WEBHOOK_SECRET.toLowerCase() ||
        payload.secret === WEBHOOK_SECRET ||
        payload.token === WEBHOOK_SECRET
    );

    if (!isHmacValid && !isDirectSecretValid) {
        logger.warn(`[Webhook] Unauthorized webhook from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing webhook secret' });
    }

    // ── Step 2.1: Intelligent SMS Parsing for Android SMS Forwarders ──────────
    const smsText = (payload.message || payload.text || payload.sms || payload.smsContent || payload.body || payload.content || '').toString();
    if (smsText) {
        const amtMatch = smsText.match(/(?:credited\s*(?:by|with)?\s*(?:Rs\.?|INR)?\s*|Rs\.?\s*|INR\s*)([0-9]+(?:\.[0-9]{1,2})?)/i);
        const utrMatch = smsText.match(/(?:Ref\s*No\.?|UTR|RRN|UPI\s*Ref(?:\s*No)?\.?|Txn(?:\s*Id)?|UPI\/)\s*[:\-]?\s*([0-9]{12})/i) || smsText.match(/\b([0-9]{12})\b/);

        if (amtMatch && !payload.amount) {
            payload.amount = parseFloat(amtMatch[1]);
        }
        if (utrMatch && !payload.utr) {
            payload.utr = utrMatch[1];
        }
        if (payload.amount && (payload.utr || smsText.toLowerCase().includes('credited'))) {
            payload.status = 'SUCCESS';
            payload.isSuccess = true;
            payload.purpose = payload.purpose || 'wallet_topup';
            logger.info(`[Webhook] Auto-parsed SMS: Amount=₹${payload.amount}, UTR=${payload.utr}`);

            if (payload.utr && payload.amount) {
                const BankCredit = require('./bankCredit.model');
                BankCredit.findOneAndUpdate(
                    { utr: payload.utr },
                    {
                        $setOnInsert: {
                            utr: payload.utr,
                            amount: Number(payload.amount),
                            rawMessage: smsText || JSON.stringify(payload),
                            source: 'BANK_SMS',
                            receivedAt: new Date(),
                            isClaimed: false
                        }
                    },
                    { upsert: true }
                ).catch(err => logger.error(`[Webhook] BankCredit upsert error: ${err.message}`));
            }
        }
    }

    // Validate timestamp (reject replays older than 5 minutes if timestamp is provided)
    if (payload.timestamp) {
        const tsMs = new Date(payload.timestamp).getTime();
        if (!isNaN(tsMs) && Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
            logger.warn(`[Webhook] Stale timestamp rejected: ${payload.timestamp}`);
            return res.status(400).json({ error: 'Stale webhook timestamp' });
        }
    }

    const eventId = payload.transactionId || payload.utr || payload.eventId || payload.id || `evt_${Date.now()}`;
    const purpose = payload.metadata?.purpose || payload.purpose || 'wallet_topup';
    const isSuccess = (payload.status || '').toUpperCase() === 'SUCCESS' || payload.isSuccess === true;

    logger.info(`[Webhook] Verified event=${payload.event || 'payment.success'}, purpose=${purpose}, eventId=${eventId}, status=${payload.status}`);

    // ── Step 3: Acknowledge immediately (provider must get 200 ASAP) ──────────────
    res.status(200).json({ received: true, amount: payload.amount, utr: payload.utr });

    // ── Step 4: Route to purpose handler asynchronously ───────────────────────────
    setImmediate(async () => {
        try {
            if (!isSuccess) {
                await handleFailedPaymentWebhook(payload, eventId);
                return;
            }

            // Accept recognized payment success events or direct status confirmation
            const eventName = (payload.event || 'payment.success').toLowerCase();
            const successEvents = ['payment.success', 'payment.captured', 'payment.paid', 'transaction.success', 'upi.credit'];
            if (!successEvents.includes(eventName)) {
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

/**
 * GET /api/v1/payments/status/:orderId
 * Real-time payment verification check for mobile and web clients waiting on loading screen
 */
exports.checkPaymentStatus = catchAsync(async (req, res) => {
    const orderRef = req.params.orderId;
    if (!orderRef) {
        return errorResponse(res, 'Order ID is required', StatusCodes.BAD_REQUEST);
    }

    let payment = null;
    if (mongoose.isValidObjectId(orderRef)) {
        payment = await Payment.findById(orderRef).lean();
    }
    if (!payment) {
        payment = await Payment.findOne({
            $or: [{ razorpayOrderId: orderRef }, { gatewayOrderId: orderRef }, { orderId: orderRef }]
        }).lean();
    }

    // Check linked WalletTxn if available
    let walletTxn = null;
    if (payment) {
        const txnFilters = [];
        if (payment.razorpayOrderId) {
            txnFilters.push({ razorpayOrderId: String(payment.razorpayOrderId) });
        }
        if (payment.razorpayPaymentId) {
            txnFilters.push({ razorpayPaymentId: String(payment.razorpayPaymentId) });
        }
        if (mongoose.isValidObjectId(payment._id)) {
            txnFilters.push({ _id: payment._id });
        }

        if (txnFilters.length > 0) {
            walletTxn = await WalletTxn.findOne({
                userId: payment.userId || req.user._id,
                $or: txnFilters
            }).lean();
        }
    } else if (mongoose.isValidObjectId(orderRef)) {
        walletTxn = await WalletTxn.findOne({
            _id: orderRef,
            userId: req.user._id
        }).lean();
    }

    const isCompleted = Boolean(payment?.status === 'COMPLETED' || walletTxn?.status === 'COMPLETED');
    const isFailed = Boolean(payment?.status === 'FAILED' || walletTxn?.status === 'FAILED');
    const status = isCompleted ? 'COMPLETED' : (isFailed ? 'FAILED' : 'PENDING');

    let currentBalance = 0;
    if (req.user?.role === 'SHOP' || req.user?.role === 'SHOP_OWNER') {
        const shop = await Shop.findOne({ ownerId: req.user._id }).lean();
        currentBalance = shop?.wallet?.balance || 0;
    } else if (req.user?._id) {
        const customer = await Customer.findById(req.user._id).lean();
        currentBalance = customer?.wallet?.balance || 0;
    }

    return successResponse(res, {
        status,
        verified: isCompleted,
        amount: payment?.amount || walletTxn?.amount || 0,
        utr: payment?.razorpayPaymentId || walletTxn?.razorpayPaymentId || null,
        currentBalance,
        planId: walletTxn?.planId || null
    }, `Payment status: ${status}`);
});

exports.cancelPayment = catchAsync(async (req, res) => {
    const { razorpayOrderId, orderId, reason } = req.body;
    const orderRef = razorpayOrderId || orderId;

    if (!orderRef) {
        return errorResponse(res, 'Missing order reference', StatusCodes.BAD_REQUEST);
    }

    const payment = await Payment.findOne({
        razorpayOrderId: orderRef,
        userId: req.user._id
    });

    if (!payment) {
        return errorResponse(res, 'Payment record not found', StatusCodes.NOT_FOUND);
    }

    // If already completed, cannot cancel
    if (payment.status === 'COMPLETED') {
        return errorResponse(res, 'Payment has already been completed and verified.', StatusCodes.CONFLICT);
    }

    payment.status = 'CANCELLED';
    payment.metadata = {
        ...(payment.metadata || {}),
        cancelledAt: new Date(),
        cancelledReason: reason || 'Cancelled by user in UPI app'
    };
    await payment.save();

    let currentBalance = 0;
    if (req.user?.role === 'SHOP' || req.user?.role === 'SHOP_OWNER') {
        const shop = await Shop.findOne({ ownerId: req.user._id }).lean();
        currentBalance = shop?.wallet?.balance || 0;
    } else if (req.user?._id) {
        const customer = await Customer.findById(req.user._id).lean();
        currentBalance = customer?.wallet?.balance || 0;
    }

    await WalletTxn.create({
        userId: req.user._id,
        type: 'TOPUP',
        amount: payment.amount,
        balance: currentBalance,
        status: 'FAILED',
        razorpayOrderId: orderRef,
        verifiedAt: new Date(),
        description: `Wallet Top-up Cancelled (${reason || 'Not Paid'})`
    });

    return successResponse(res, {
        orderId: orderRef,
        status: 'CANCELLED',
        message: 'Payment cancelled and recorded in history'
    }, 'Payment cancelled successfully');
});

