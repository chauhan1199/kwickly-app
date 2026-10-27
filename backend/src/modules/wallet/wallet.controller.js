const { StatusCodes } = require('http-status-codes');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const WalletTxn = require('./wallet.model');
const Customer = require('../customer/customer.model');
const Shop = require('../shop/shop.model');
const Payout = require('../payout/payout.model');
const Notification = require('../notification/notification.model');
const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll, emitToUser } = require('../../helpers/socket.helper');
const { delCache } = require('../../helpers/redis.helper');
const logger = require('../../helpers/logger.helper');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { registerPaymentIntent } = require('../../services/upiProvider.service');
const { buildReceiptPdf, walletReceiptData } = require('../../helpers/receiptPdf.helper');

// In-process lock against concurrent race condition UTR submissions
const activeUtrSubmissions = new Set();


/**
 * Helper: atomically deduct amount from user/shop wallet.
 * Returns { newBalance, entity } or throws if insufficient funds.
 */
const atomicDeduct = async (userId, role, amount, session) => {
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const minBalance = settings?.wallet?.minimumBalance || 100;
    const requiredTotal = amount + minBalance;

    if (role === 'SHOP' || role === 'SHOP_OWNER') {
        const shop = await Shop.findOneAndUpdate(
            { ownerId: userId, 'wallet.balance': { $gte: requiredTotal } },
            { $inc: { 'wallet.balance': -amount } },
            { returnDocument: 'after', session }
        );
        if (!shop) return null;
        return { newBalance: shop.wallet.balance, entityId: shop._id };
    } else {
        const user = await Customer.findOneAndUpdate(
            { _id: userId, 'wallet.balance': { $gte: requiredTotal } },
            { $inc: { 'wallet.balance': -amount } },
            { returnDocument: 'after', session }
        );
        if (!user) return null;
        return { newBalance: user.wallet.balance, entityId: user._id };
    }
};

/**
 * Helper: atomically credit amount to user/shop wallet.
 */
const atomicCredit = async (userId, role, amount, session) => {
    if (role === 'SHOP' || role === 'SHOP_OWNER') {
        const shop = await Shop.findOneAndUpdate(
            { ownerId: userId },
            { $inc: { 'wallet.balance': amount } },
            { returnDocument: 'after', session }
        );
        if (!shop) return null;
        return { newBalance: shop.wallet.balance };
    } else {
        const user = await Customer.findOneAndUpdate(
            { _id: userId },
            { $inc: { 'wallet.balance': amount } },
            { returnDocument: 'after', session }
        );
        if (!user) return null;
        return { newBalance: user.wallet.balance };
    }
};

// ─── GET /api/v1/wallet/balance ───────────────────────────────────────────────
// ─── GET /api/v1/wallet/balance ──────────────────────────────────────────────
exports.getWallet = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const user = await Customer.findById(req.user._id).select('wallet name role').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let balance = user.wallet?.balance || 0;
    if (user.role === 'SHOP' || user.role === 'SHOP_OWNER') {
        const shop = await Shop.findOne({ ownerId: req.user._id }).select('wallet').lean();
        if (shop) balance = shop.wallet?.balance || 0;
    }

    const query = { userId: req.user._id };
    if (type) query.type = type.toUpperCase();

    const total = await WalletTxn.countDocuments(query);
    const transactions = await WalletTxn.find(query)
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    // All-time totals, so the summary is not limited to the current page of transactions
    const CREDIT_TYPES = ['JOB_CREDIT', 'ORDER_CREDIT', 'REFUND', 'REFERRAL_BONUS', 'TOPUP', 'TRANSFER_RECEIVED'];
    const [agg] = await WalletTxn.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(String(req.user._id)), $or: [{ status: 'COMPLETED' }, { status: { $exists: false } }] } },
        { $addFields: {
            isCredit: { $or: [
                { $in: ['$type', CREDIT_TYPES] },
                { $and: [
                    { $eq: ['$type', 'ADJUSTMENT'] },
                    { $not: [{ $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: /debit|deduct/i } }] }
                ] }
            ] }
        } },
        { $group: {
            _id: null,
            totalCredits: { $sum: { $cond: ['$isCredit', '$amount', 0] } },
            totalDebits: { $sum: { $cond: ['$isCredit', 0, '$amount'] } }
        } }
    ]);

    return successResponse(res, {
        balance,
        transactions,
        summary: {
            totalCredits: Math.round((agg?.totalCredits || 0) * 100) / 100,
            totalDebits: Math.round((agg?.totalDebits || 0) * 100) / 100
        },
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit))
    }, 'Wallet fetched');
});

// ─── POST /api/v1/wallet/topup ───────────────────────────────────────────────
// Dual-Mode Top-up:
// 1. Direct verified UTR redemption (mobile app submits 12-digit UTR from payment receipt)
// 2. Intent registration (mobile app requests deeplink intent URI for 1-tap app launch)
exports.topupWallet = catchAsync(async (req, res) => {
    let { amount, planId } = req.body;
    if (!amount || Number(amount) <= 0) {
        return errorResponse(res, 'Invalid top-up amount', StatusCodes.BAD_REQUEST);
    }
    amount = Number(amount);

    if (!planId && amount < 100) {
        return errorResponse(res, 'Minimum wallet top-up amount is ₹100', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findById(req.user._id).lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    // Verify the subscription plan (if this is a plan purchase) BEFORE queuing it
    let plan = null;
    if (planId && (user.role === 'WORKER' || user.role === 'SHOP' || user.role === 'SHOP_OWNER')) {
        const AppSettings = require('../settings/settings.model');
        const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        const configuredPlans = settings?.subscriptionPlans || [];
        const isShop = (user.role === 'SHOP' || user.role === 'SHOP_OWNER');
        plan = configuredPlans.find(p => p.id === planId && (isShop ? p.targetRole === 'SHOP' : p.targetRole === 'WORKER'))
            || configuredPlans.find(p => p.id === planId)
            || null;

        if (!plan) {
            return errorResponse(res, 'Subscription plan not found', StatusCodes.NOT_FOUND);
        }
        if (Number(plan.price) !== amount) {
            return errorResponse(res, `Top-up amount must exactly match the plan price of ₹${plan.price}`, StatusCodes.BAD_REQUEST);
        }
    }

    const { isValidUtr, findUtrUsage } = require('../../helpers/upi.helper');
    const rawUtr = (req.body.utrNumber || req.body.paymentDetails?.txnId || req.body.razorpayPaymentId || '').toString().trim();

    // Mode 1: 12-digit UTR Verification Check
    if (rawUtr) {
        if (!isValidUtr(rawUtr)) {
            return errorResponse(res, 'Invalid UTR format. Please enter the exact 12-digit UPI Reference Number from your bank receipt.', StatusCodes.BAD_REQUEST);
        }

        if (activeUtrSubmissions.has(rawUtr)) {
            return errorResponse(res, 'This UPI Reference / Transaction ID is currently being processed or has already been used.', StatusCodes.CONFLICT);
        }
        activeUtrSubmissions.add(rawUtr);

        const { acquireLock, releaseLock } = require('../../helpers/redis.helper');
        const lockKey = `lock:utr:${rawUtr}`;
        let lockHolder = null;
        try {
            lockHolder = await acquireLock(lockKey, 15);
        } catch (e) {}

        try {
            // Cross-flow duplicate UTR check across all models
            const utrUsage = await findUtrUsage(rawUtr);
            if (utrUsage) {
                return errorResponse(res, 'This UPI Reference / Transaction ID has already been redeemed on the platform.', StatusCodes.CONFLICT);
            }

            const utrNumber = rawUtr;
            const reuseTxnId = req.body.pendingTxnId && mongoose.isValidObjectId(req.body.pendingTxnId) ? req.body.pendingTxnId : null;

            // Check if bank webhook already verified and credited this transaction
            const alreadyCompleted = await WalletTxn.findOne({
                userId: req.user._id,
                status: 'COMPLETED',
                $or: [{ razorpayPaymentId: utrNumber }, { gatewayTransactionId: utrNumber }]
            });

            let currentBalance = user.wallet?.balance || 0;
            if (user.role === 'SHOP' || user.role === 'SHOP_OWNER') {
                const shop = await Shop.findOne({ ownerId: user._id });
                currentBalance = shop?.wallet?.balance || 0;
            }

            if (alreadyCompleted) {
                return successResponse(res, {
                    txnId: alreadyCompleted._id,
                    status: 'COMPLETED',
                    verified: true,
                    amount,
                    newBalance: alreadyCompleted.balance || currentBalance
                }, `Top-up of ₹${amount} has been verified and credited to your wallet.`, StatusCodes.CREATED);
            }

            // 1. Strict Replay Protection: Check if this UTR was ever used for any completed transaction across the platform
            const duplicateCompleted = await WalletTxn.findOne({
                razorpayPaymentId: utrNumber,
                status: 'COMPLETED'
            });

            if (duplicateCompleted) {
                return errorResponse(res, `This UPI Reference (UTR: ${utrNumber}) has already been used and credited.`, StatusCodes.BAD_REQUEST);
            }

            // 2. Claim a Bank Credit recorded server-side by the bank-SMS webhook.
            // Only that record proves money arrived; a UTR, pasted SMS or intent
            // response typed into the app is user-controlled and never credits on
            // its own. Without a match the top-up waits for the webhook or an admin.
            const BankCredit = require('../payment/bankCredit.model');
            const numAmount = Number(amount);

            const existingBankCredit = await BankCredit.findOne({ utr: utrNumber });
            let bankCreditMatched = false;

            if (existingBankCredit) {
                if (existingBankCredit.isClaimed) {
                    return errorResponse(res, `This UPI Reference (UTR: ${utrNumber}) has already been used and claimed.`, StatusCodes.BAD_REQUEST);
                }

                // Strict amount check: existing BankCredit amount MUST match requested top-up amount
                if (Math.abs(existingBankCredit.amount - numAmount) > 0.5) {
                    return errorResponse(
                        res,
                        `Amount mismatch: Bank records confirm UTR ${utrNumber} is for ₹${existingBankCredit.amount.toFixed(2)}, but your top-up requires ₹${numAmount.toFixed(2)}. Only the transaction made for ₹${numAmount.toFixed(2)} is valid.`,
                        StatusCodes.BAD_REQUEST
                    );
                }

                // Atomic claim so two concurrent submissions can't both credit
                const claimed = await BankCredit.findOneAndUpdate(
                    { _id: existingBankCredit._id, isClaimed: false },
                    { $set: { isClaimed: true, claimedBy: user._id, claimedAt: new Date() } },
                    { returnDocument: 'after' }
                );
                if (!claimed) {
                    return errorResponse(res, `This UPI Reference (UTR: ${utrNumber}) has already been used and claimed.`, StatusCodes.BAD_REQUEST);
                }
                bankCreditMatched = true;
                // A plain top-up credits what the bank received (within ₹0.50 of the claim)
                if (!plan) amount = Number(existingBankCredit.amount);
            } else {
                const { isAdjacentOrTamperedUtr } = require('../../helpers/upi.helper');
                const recentCredits = await BankCredit.find({}).sort({ _id: -1 }).limit(50).select('utr').lean();
                if (isAdjacentOrTamperedUtr(utrNumber, recentCredits.map(r => r.utr))) {
                    return errorResponse(
                        res,
                        `Suspicious reference number: UTR ${utrNumber} is adjacent to a recently used transaction. Please check the UTR on your bank receipt.`,
                        StatusCodes.BAD_REQUEST
                    );
                }
            }

            const shouldAutoCredit = bankCreditMatched;
            if (shouldAutoCredit) {
                let newBalance = currentBalance;
                if (plan) {
                    const days = plan?.durationDays || 30;
                    const baseDate = new Date();
                    const newExpiry = new Date(baseDate.getTime() + days * 86400000);

                    if (user.role === 'SHOP' || user.role === 'SHOP_OWNER') {
                        const Shop = require('../shop/shop.model');
                        const { ShopSubscription } = require('../subscription/subscription.model');
                        const shop = await Shop.findOne({ ownerId: user._id });
                        if (shop) {
                            shop.subscription = {
                                planId: plan.id,
                                expiryDate: newExpiry,
                                isActive: true,
                                isTrial: false
                            };
                            await shop.save();

                            await ShopSubscription.create({
                                shopId: shop._id,
                                planId: plan.id,
                                startDate: baseDate,
                                endDate: newExpiry,
                                amount,
                                payment: {
                                    status: 'PAID',
                                    method: 'UPI',
                                    razorpayPaymentId: utrNumber
                                }
                            });
                        }
                    } else {
                        const { WorkerSubscription } = require('../subscription/subscription.model');
                        await Customer.findByIdAndUpdate(user._id, {
                            'subscription.planId': plan.id,
                            'subscription.expiryDate': newExpiry,
                            'subscription.isActive': true,
                            'subscription.isTrial': false
                        });

                        await WorkerSubscription.create({
                            workerId: user._id,
                            planId: plan.id,
                            startDate: baseDate,
                            endDate: newExpiry,
                            amount,
                            payment: {
                                status: 'PAID',
                                method: 'UPI',
                                razorpayPaymentId: utrNumber
                            }
                        });
                    }
                } else {
                    // Regular topup: credit balance
                    if (user.role === 'SHOP' || user.role === 'SHOP_OWNER') {
                        const Shop = require('../shop/shop.model');
                        const updatedShop = await Shop.findOneAndUpdate(
                            { ownerId: user._id },
                            { $inc: { 'wallet.balance': Number(amount) } },
                            { returnDocument: 'after' }
                        );
                        newBalance = updatedShop?.wallet?.balance ?? (currentBalance + Number(amount));
                    } else {
                        const updatedUser = await Customer.findByIdAndUpdate(
                            user._id,
                            { $inc: { 'wallet.balance': Number(amount) } },
                            { returnDocument: 'after' }
                        );
                        newBalance = updatedUser?.wallet?.balance ?? (currentBalance + Number(amount));
                    }
                }

                const txn = await WalletTxn.create({
                    userId: req.user._id,
                    type: plan ? 'SUBSCRIPTION' : 'TOPUP',
                    amount: Number(amount),
                    balance: Number(newBalance),
                    status: 'COMPLETED',
                    razorpayPaymentId: utrNumber,
                    planId: plan ? planId : undefined,
                    verifiedAt: new Date(),
                    description: plan
                        ? `Subscription Plan Purchase: ${plan.label || planId} (Direct UPI Verified)`
                        : `Wallet Top-up via Direct UPI (Verified)`
                });

                // Close the intent-mode placeholder so it can't be approved again later
                if (reuseTxnId) {
                    await WalletTxn.updateOne(
                        { _id: reuseTxnId, userId: req.user._id, status: 'PENDING', razorpayPaymentId: { $exists: false } },
                        { $set: { status: 'FAILED', description: `Payment intent closed — verified as UTR ${utrNumber}` } }
                    );
                }

                emitToAll('DASHBOARD_UPDATE', {
                    type: plan ? 'SUBSCRIPTION_PURCHASED' : 'WALLET_TOPUP_COMPLETED',
                    userId: req.user._id,
                    userName: user.name,
                    amount,
                    planId: plan ? planId : null,
                    utr: utrNumber
                });

                return successResponse(res, {
                    txnId: txn._id,
                    txn,
                    status: 'COMPLETED',
                    verified: true,
                    amount: Number(amount),
                    newBalance: Number(newBalance)
                }, plan ? `Subscription plan activated successfully!` : `Top-up of ₹${amount} has been verified and credited to your wallet.`, StatusCodes.CREATED);
            }

            // Check for existing pending transaction or create one awaiting webhook verification
            // Reuse only a record that has no UTR yet (never overwrite an earlier
            // submission): the intent-mode record the client names (txnId), or a
            // recent same-amount one from this user.
            let txn = await WalletTxn.findOne({
                userId: req.user._id,
                status: 'PENDING',
                type: 'TOPUP',
                $or: [
                    { razorpayPaymentId: utrNumber },
                    reuseTxnId
                        ? { _id: reuseTxnId, razorpayPaymentId: { $exists: false } }
                        : { amount, razorpayPaymentId: { $exists: false }, createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } }
                ]
            });

            if (txn) {
                txn.razorpayPaymentId = utrNumber;
                if (plan) txn.planId = planId;
                await txn.save();
            } else {
                txn = await WalletTxn.create({
                    userId: req.user._id,
                    type: 'TOPUP',
                    amount: Number(amount),
                    balance: Number(currentBalance),
                    status: 'PENDING',
                    razorpayPaymentId: utrNumber,
                    planId: plan ? planId : undefined,
                    description: plan
                        ? `Subscription Plan Purchase: ${plan.label || planId} (UTR: ${utrNumber} - Awaiting Bank Confirmation)`
                        : `Wallet Top-up (UTR: ${utrNumber} - Awaiting Bank Confirmation)`
                });
            }

            emitToAll('DASHBOARD_UPDATE', {
                type: 'PENDING_WALLET_TOPUP',
                userId: req.user._id,
                userName: user.name,
                amount,
                planId: plan ? planId : null,
                utr: utrNumber
            });

            return successResponse(res, {
                txnId: txn._id,
                txn,
                status: 'PENDING_VERIFICATION',
                verified: false,
                amount,
                utrNumber
            }, `UPI Reference (UTR: ${utrNumber}) submitted. Awaiting bank confirmation.`, StatusCodes.CREATED);
        } finally {
            activeUtrSubmissions.delete(rawUtr);
            if (lockHolder) {
                try {
                    await releaseLock(lockKey, lockHolder);
                } catch (e) {}
            }
        }
    }

    // Mode 2: Payment Intent Registration (for direct deeplink opening)
    const txn = await WalletTxn.create({
        userId: req.user._id,
        type: 'TOPUP',
        amount,
        balance: user.wallet?.balance || 0,
        status: 'PENDING',
        planId: plan ? planId : undefined,
        description: plan
            ? `Subscription Plan Purchase: ${plan.label || planId} (Awaiting UPI Payment)`
            : `Wallet Top-up (Awaiting UPI Payment)`
    });

    const isShopOwner = (user.role === 'SHOP' || user.role === 'SHOP_OWNER');
    const { gatewayOrderId, upiIntentUri } = await registerPaymentIntent({
        amount,
        internalId: txn._id,
        purpose: plan ? (isShopOwner ? 'shop_subscription' : 'worker_subscription') : 'wallet_topup',
        userId: req.user._id,
        planId: plan ? planId : undefined
    });

    if (gatewayOrderId) {
        await WalletTxn.findByIdAndUpdate(txn._id, { $set: { gatewayTransactionId: gatewayOrderId } });
    }

    emitToAll('DASHBOARD_UPDATE', {
        type: 'PENDING_WALLET_TOPUP',
        userId: req.user._id,
        userName: user.name,
        amount,
        planId: plan ? planId : null
    });

    return successResponse(res, {
        txnId: txn._id,
        txn,
        status: 'PENDING',
        gatewayOrderId,
        upiIntentUri,
        amount
    }, `Please complete the UPI payment of ₹${amount}. Your wallet will be credited automatically once the payment is confirmed.`, StatusCodes.CREATED);
});

// ─── POST /api/v1/wallet/withdraw ─────────────────────────────────────────────
exports.requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body;

    if (!amount || amount <= 0) {
        return errorResponse(res, 'Invalid withdrawal amount', StatusCodes.BAD_REQUEST);
    }
    if (!payoutMethod) {
        return errorResponse(res, 'Payout method is required', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findById(req.user._id).select('role').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let session = null;
    let useTransaction = false;
    if (supportsTransactions()) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) {
            session = null;
            useTransaction = false;
        }
    }

    try {
        // P0 FIX: Atomic check-and-deduct in a single query (prevents race condition)
        const result = await atomicDeduct(req.user._id, user.role, amount, useTransaction ? session : null);
        if (!result) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Insufficient withdrawable balance. A minimum safety balance must be maintained in your wallet.', StatusCodes.PAYMENT_REQUIRED);
        }

        const createOpts = useTransaction ? { session } : {};
        const txn = await WalletTxn.create([{
            userId: req.user._id,
            type: 'WITHDRAWAL',
            amount,
            balance: result.newBalance,
            status: 'PENDING',
            description: `Withdrawal to ${payoutMethod}`
        }], createOpts);

        const paymentMethodType = payoutMethod.toLowerCase().includes('upi') ? 'UPI' : 'BANK';
        const payout = await Payout.create([{
            workerId: (user.role !== 'SHOP' && user.role !== 'SHOP_OWNER') ? req.user._id : undefined,
            shopId: (user.role === 'SHOP' || user.role === 'SHOP_OWNER') ? result.entityId : undefined,
            amount,
            paymentMethod: paymentMethodType,
            paymentDetails: payoutMethod,
            walletTxnId: txn[0]._id
        }], createOpts);

        if (useTransaction) {
            await session.commitTransaction();
            session.endSession();
        }

        // Invalidate cache
        await delCache(`session:${req.user._id}`);
        emitToAll('DASHBOARD_UPDATE', { type: 'NEW_PAYOUT', id: payout[0]._id });

        notifyUser({
            userId: req.user._id,
            title: 'Withdrawal Requested',
            message: `Your withdrawal request for ₹${amount} has been initiated and is pending approval.`,
            action: 'WITHDRAWAL',
            entityType: 'WALLET',
            entityId: txn[0]._id,
            targetRole: (user.role === 'SHOP' || user.role === 'SHOP_OWNER') ? 'SHOP_OWNER' : 'CUSTOMER'
        });

        return successResponse(res, { txn: txn[0], newBalance: result.newBalance }, 'Withdrawal request submitted successfully', StatusCodes.CREATED);
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// ─── GET /api/v1/wallet/transactions (Admin) ──────────────────────────────────
exports.getAllTransactions = catchAsync(async (req, res) => {
    const { type, userId, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type) query.type = type.toUpperCase();
    if (userId) query.userId = userId;

    const total = await WalletTxn.countDocuments(query);
    const txns = await WalletTxn.find(query)
        .populate('userId', 'name phone role')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { txns, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Transactions fetched');
});

// ─── GET /api/v1/wallet/transactions (own) ───
// Any authenticated user lists their own wallet transactions.
exports.getMyTransactions = catchAsync(async (req, res) => {
    const { type, page = 1, limit = 50 } = req.query;
    const query = { userId: req.user._id };
    if (type) query.type = type.toUpperCase();

    const total = await WalletTxn.countDocuments(query);
    const txns = await WalletTxn.find(query)
        .sort('-createdAt')
        .limit(Math.min(Number(limit), 100))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { txns, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Transactions fetched');
});

// ─── GET /api/v1/wallet/transactions/:id/receipt-pdf ─────────────────────────
// Returns { fileName, pdfBase64 } for one of the caller's own transactions.
exports.getTransactionReceiptPdf = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);
    }
    const txn = await WalletTxn.findById(req.params.id).lean();
    if (!txn) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);
    if (String(txn.userId) !== String(req.user._id) && req.user.role !== 'ADMIN') {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    const user = await Customer.findById(txn.userId).select('name phone role').lean();
    const data = walletReceiptData(txn, user);
    const pdf = buildReceiptPdf(data);
    return successResponse(res, { fileName: `Kwickly_Receipt_${data.receiptNo}.pdf`, pdfBase64: pdf.toString('base64') }, 'Receipt generated');
});

// ─── POST /api/v1/wallet/credit (Admin adjustment) ────────────────────────────
exports.adminAdjust = catchAsync(async (req, res) => {
    const { userId, amount, type, description, debit } = req.body;

    const user = await Customer.findById(userId).select('role wallet').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    let adminWallet;
    let newBalance;
    if (debit) {
        // Admin debits from user wallet → money goes TO admin wallet
        const result = await atomicDeduct(userId, user.role, Math.abs(amount), null);
        if (!result) return errorResponse(res, 'Insufficient balance for debit', StatusCodes.PAYMENT_REQUIRED);
        newBalance = result.newBalance;

        adminWallet = await AdminWallet.findOneAndUpdate(
            {},
            { $inc: { balance: Math.abs(amount) } },
            { returnDocument: 'after', upsert: true }
        );

        await AdminWalletTxn.create({
            type: 'COMMISSION_COLLECTED',
            amount: Math.abs(amount),
            balanceAfter: adminWallet.balance,
            description: `₹${Math.abs(amount)} debited from ${user.role?.toLowerCase() || 'user'} "${user.name || user._id}" wallet`,
            referenceId: userId,
            referenceModel: 'Customer',
            meta: { performedBy: req.user?._id }
        });
    } else {
        // Admin credits to user wallet → money comes FROM admin wallet (atomic balance check)
        adminWallet = await AdminWallet.findOneAndUpdate(
            { balance: { $gte: Math.abs(amount) } },
            { $inc: { balance: -Math.abs(amount) } },
            { returnDocument: 'after' }
        );
        if (!adminWallet) {
            return errorResponse(res, 'Insufficient admin wallet balance', StatusCodes.BAD_REQUEST);
        }

        const result = await atomicCredit(userId, user.role, Math.abs(amount), null);
        newBalance = result.newBalance;

        await AdminWalletTxn.create({
            type: 'SHOP_PAYOUT',
            amount: Math.abs(amount),
            balanceAfter: adminWallet.balance,
            description: `₹${Math.abs(amount)} credited to ${user.role?.toLowerCase() || 'user'} "${user.name || user._id}" wallet`,
            referenceId: userId,
            referenceModel: 'Customer',
            meta: { performedBy: req.user?._id }
        });
    }

    const txn = await WalletTxn.create({
        userId,
        type: 'ADJUSTMENT',
        direction: debit ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(amount),
        balance: newBalance,
        status: 'COMPLETED',
        description: description || `Admin ${debit ? 'debit' : 'credit'} adjustment`
    });

    // Invalidate the user's session cache
    await delCache(`session:${userId}`);
    await delCache('admin_dashboard_stats');

    const actionLabel = debit ? 'debited from' : 'credited to';
    const entityType = user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
    logAdminActivity(debit ? 'WALLET_DEBIT' : 'WALLET_CREDIT', entityType, userId,
        `${entityType} Wallet ${debit ? 'Debited' : 'Credited'}`,
        `₹${Math.abs(amount)} ${actionLabel} ${user.name || 'user'} wallet${description ? ' — ' + description : ''}`,
        req.user?._id
    );

    try {
        const notif = await Notification.create({
            title: `Wallet ${debit ? 'Debited' : 'Credited'}`,
            message: `₹${Math.abs(amount)} ${actionLabel} your wallet${description ? ' — ' + description : ''}`,
            type: 'DIRECT',
            action: 'UPDATE',
            entityType: 'WALLET',
            entityId: userId,
            userId: userId,
            performedBy: req.user?._id,
            targetRole: 'ALL'
        });
        try {
            const { getIO } = require('../../helpers/socket.helper');
            const io = getIO();
            if (io) io.to('admin_dashboard').emit('NEW_NOTIFICATION', notif);
        } catch (_) { }
    } catch (_) { }

    return successResponse(res, { txn, adminBalance: adminWallet.balance }, 'Wallet adjusted successfully');
});

// ─── GET /api/v1/wallet/pending-topups (Admin) ───
// NOTE: The automated webhook flow no longer requires manual admin verification
// for new topups. This endpoint is kept as a read-only fallback to surface any
// legacy PENDING records created before the webhook migration. New topups are
// auto-resolved by the UPI provider webhook or the reconciliation cron.
exports.getPendingTopups = catchAsync(async (req, res) => {
    const txns = await WalletTxn.find({ type: 'TOPUP', status: 'PENDING' })
        .populate('userId', 'name phone email role')
        .sort('-createdAt')
        .lean();

    return successResponse(res, { txns, count: txns.length }, 'Pending top-up requests fetched (legacy view — new topups are auto-resolved by webhook)');
});

// ─── POST /api/v1/wallet/pending-topups/:id/approve (Admin) ───
// Resolves a PENDING top-up / UPI plan purchase after the admin confirmed the
// money in the bank. The PENDING→COMPLETED flip is the atomic claim, so a
// double click or a racing bank webhook can never credit twice.
exports.approvePendingTopup = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);

    const txn = await WalletTxn.findOneAndUpdate(
        { _id: id, type: 'TOPUP', status: 'PENDING' },
        { $set: { status: 'COMPLETED', verifiedAt: new Date(), description: 'Verified by admin (manual approval)' } },
        { returnDocument: 'after' }
    );
    if (!txn) {
        const existing = await WalletTxn.findById(id).select('status').lean();
        if (!existing) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);
        return errorResponse(res, `Transaction is already ${existing.status}`, StatusCodes.BAD_REQUEST);
    }

    // The approved UTR is spent: a later bank SMS for it must not fund anything else.
    if (txn.razorpayPaymentId) {
        const BankCredit = require('../payment/bankCredit.model');
        await BankCredit.updateOne(
            { utr: txn.razorpayPaymentId, isClaimed: false },
            { $set: { isClaimed: true, claimedBy: txn.userId, claimedAt: new Date() } }
        );
    }

    const { applyConfirmedTopup } = require('../../helpers/webhookHandlers.helper');
    const { newBalance } = await applyConfirmedTopup({
        txn,
        amount: Number(txn.amount),
        eventId: `admin_${txn._id}`,
        source: 'admin'
    });

    if (!txn.planId) {
        await WalletTxn.findByIdAndUpdate(txn._id, { $set: { description: 'Wallet Top-up Verified & Credited (manual admin approval)' } });
    }

    const fresh = await WalletTxn.findById(txn._id).lean();
    return successResponse(
        res,
        { txn: fresh, newBalance },
        txn.planId
            ? `Plan "${txn.planId}" verified and activated!`
            : `Top-up of ₹${txn.amount} approved and credited!`
    );
});

// ─── POST /api/v1/wallet/pending-topups/:id/reject (Admin) ───
exports.rejectPendingTopup = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason = 'Payment not found in admin bank account' } = req.body;
    if (!mongoose.isValidObjectId(id)) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);

    const txn = await WalletTxn.findOneAndUpdate(
        { _id: id, type: 'TOPUP', status: 'PENDING' },
        { $set: { status: 'FAILED', description: `Wallet Top-up Rejected (${reason})` } },
        { returnDocument: 'after' }
    );
    if (!txn) {
        const existing = await WalletTxn.findById(id).select('status').lean();
        if (!existing) return errorResponse(res, 'Transaction not found', StatusCodes.NOT_FOUND);
        return errorResponse(res, `Transaction is already ${existing.status}`, StatusCodes.BAD_REQUEST);
    }
    if (txn.planId) {
        txn.description = `Subscription Plan "${txn.planId}" Payment Rejected (${reason})`;
        await WalletTxn.updateOne({ _id: txn._id }, { $set: { description: txn.description } });
    }

    await delCache(`session:${txn.userId}`);

    await notifyUser({
        userId: txn.userId,
        title: txn.planId ? 'Subscription Payment Rejected ❌' : 'Top-up Verification Failed ❌',
        message: `Your ${txn.planId ? 'plan payment' : 'top-up request'} of ₹${txn.amount} was rejected: ${reason}`,
        type: 'WALLET_REJECTED',
        referenceId: txn._id, referenceModel: 'WalletTxn'
    });

    // Existing per-user event the mobile wallet screens already listen for
    emitToUser(txn.userId, 'WALLET_UPDATE', { type: 'TOPUP_REJECTED', txnId: txn._id, amount: txn.amount, reason });
    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP_REJECTED', txnId: txn._id, userId: txn.userId });
    return successResponse(res, { txn }, `Top-up request for ₹${txn.amount} rejected.`);
});

// ─── POST /api/v1/wallet/lookup-recipient ─────────────────────────────────────
exports.lookupRecipient = catchAsync(async (req, res) => {
    const { phone, role: targetRole } = req.body;
    if (!phone || typeof phone !== 'string') {
        return errorResponse(res, 'Valid phone number is required', StatusCodes.BAD_REQUEST);
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
        return errorResponse(res, 'Please provide a 10-digit mobile number', StatusCodes.BAD_REQUEST);
    }

    if (req.user?.phone && req.user.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) {
        return errorResponse(res, 'You cannot transfer money to yourself', StatusCodes.BAD_REQUEST);
    }

    const query = { phone: new RegExp(cleanPhone + '$') };
    if (targetRole) query.role = targetRole.toUpperCase();

    const recipient = await Customer.findOne(query).select('name phone role profileImage').lean();

    if (!recipient) {
        return errorResponse(res, 'No registered Kwickly user found with this mobile number', StatusCodes.NOT_FOUND);
    }

    if (recipient._id.toString() === req.user._id.toString()) {
        return errorResponse(res, 'You cannot transfer money to yourself', StatusCodes.BAD_REQUEST);
    }

    return successResponse(res, {
        recipientId: recipient._id,
        name: recipient.name,
        phone: recipient.phone,
        role: recipient.role,
        profileImage: recipient.profileImage || null
    }, 'Recipient verified');
});

// ─── POST /api/v1/wallet/transfer (P2P Wallet Transfer) ──────────────────────
exports.transferWallet = catchAsync(async (req, res) => {
    const { recipientPhone, amount, note, recipientRole } = req.body;

    const amountNum = Math.round(Number(amount) * 100) / 100;
    if (isNaN(amountNum) || amountNum <= 0) {
        return errorResponse(res, 'Please enter a valid transfer amount greater than 0', StatusCodes.BAD_REQUEST);
    }

    if (!recipientPhone || typeof recipientPhone !== 'string') {
        return errorResponse(res, 'Recipient phone number is required', StatusCodes.BAD_REQUEST);
    }

    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
        return errorResponse(res, 'Please provide a valid 10-digit recipient mobile number', StatusCodes.BAD_REQUEST);
    }

    // Sender details
    const sender = await Customer.findById(req.user._id).select('name phone role wallet');
    if (!sender) return errorResponse(res, 'Sender user not found', StatusCodes.NOT_FOUND);

    if (sender.phone && sender.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) {
        return errorResponse(res, 'You cannot transfer money to yourself', StatusCodes.BAD_REQUEST);
    }

    // Recipient details
    const recipientQuery = { phone: new RegExp(cleanPhone + '$') };
    if (recipientRole) recipientQuery.role = recipientRole.toUpperCase();

    const recipient = await Customer.findOne(recipientQuery).select('name phone role wallet');

    if (!recipient) {
        return errorResponse(res, 'Recipient user not found with this mobile number', StatusCodes.NOT_FOUND);
    }

    if (recipient._id.toString() === sender._id.toString()) {
        return errorResponse(res, 'You cannot transfer money to yourself', StatusCodes.BAD_REQUEST);
    }

    // Atomic balance deduction from sender
    const updatedSender = await Customer.findOneAndUpdate(
        { _id: sender._id, 'wallet.balance': { $gte: amountNum } },
        { $inc: { 'wallet.balance': -amountNum } },
        { returnDocument: 'after' }
    );

    if (!updatedSender) {
        return errorResponse(res, `Insufficient wallet balance. Your available balance is ₹${sender.wallet?.balance || 0}`, StatusCodes.PAYMENT_REQUIRED);
    }

    // Atomic credit to recipient
    const updatedRecipient = await Customer.findByIdAndUpdate(
        recipient._id,
        { $inc: { 'wallet.balance': amountNum } },
        { returnDocument: 'after' }
    );

    const senderNewBalance = updatedSender.wallet.balance;
    const recipientNewBalance = updatedRecipient.wallet.balance;

    // Create Sender Debit Transaction
    const senderTxn = await WalletTxn.create({
        userId: sender._id,
        type: 'TRANSFER_SENT',
        amount: amountNum,
        balance: senderNewBalance,
        status: 'COMPLETED',
        description: `P2P Transfer to ${recipient.name} (${cleanPhone})${note ? ' • ' + note : ''}`,
        counterpartyId: recipient._id,
        counterpartyName: recipient.name
    });

    // Create Recipient Credit Transaction
    const recipientTxn = await WalletTxn.create({
        userId: recipient._id,
        type: 'TRANSFER_RECEIVED',
        amount: amountNum,
        balance: recipientNewBalance,
        status: 'COMPLETED',
        description: `P2P Transfer from ${sender.name}${note ? ' • ' + note : ''}`,
        counterpartyId: sender._id,
        counterpartyName: sender.name
    });

    // Invalidate session caches
    await delCache(`session:${sender._id}`);
    await delCache(`session:${recipient._id}`);

    // Push notification to recipient
    try {
        await notifyUser({
            userId: recipient._id,
            title: 'Money Received! 💰',
            message: `₹${amountNum} received from ${sender.name} in your Kwickly Wallet.`,
            type: 'WALLET_CREDIT',
            referenceId: recipientTxn._id,
            referenceModel: 'WalletTxn',
            targetRole: recipient.role || 'CUSTOMER'
        });
    } catch (notifErr) {
        logger.warn(`[WalletTransfer] Notification failed: ${notifErr.message}`);
    }

    // Real-time socket events to both users
    emitToUser(sender._id, 'WALLET_UPDATE', {
        type: 'TRANSFER_SENT',
        amount: amountNum,
        newBalance: senderNewBalance,
        txn: senderTxn
    });

    emitToUser(recipient._id, 'WALLET_UPDATE', {
        type: 'TRANSFER_RECEIVED',
        amount: amountNum,
        newBalance: recipientNewBalance,
        txn: recipientTxn
    });

    emitToAll('DASHBOARD_UPDATE', {
        type: 'P2P_TRANSFER_COMPLETED',
        senderId: sender._id,
        recipientId: recipient._id,
        amount: amountNum
    });

    return successResponse(res, {
        txn: senderTxn,
        amount: amountNum,
        newBalance: senderNewBalance,
        recipientName: recipient.name,
        recipientPhone: recipient.phone
    }, `Successfully transferred ₹${amountNum} to ${recipient.name}!`, StatusCodes.OK);
});

