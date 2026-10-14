const { StatusCodes } = require('http-status-codes');
const { WorkerSubscription, ShopSubscription } = require('./subscription.model');
const Customer = require('../customer/customer.model');
const WalletTxn = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const { delCache } = require('../../helpers/redis.helper');
const Shop = require('../shop/shop.model');
const Notification = require('../notification/notification.model');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');

/* ─── Shared helpers ─────────────────────────────────────────────────── */

/**
 * Compute the date a new plan should start from (stacks on remaining
 * trial/paid time so users never lose days they already paid for).
 */
const computeStartDate = (existingSubscription, createdAt, freeTrialDays) => {
    let startDate = new Date();
    if (existingSubscription?.expiryDate && new Date(existingSubscription.expiryDate) > startDate) {
        startDate = new Date(existingSubscription.expiryDate);
    } else if (existingSubscription?.isTrial !== false) {
        if (existingSubscription?.trialEndDate && new Date(existingSubscription.trialEndDate) > startDate) {
            startDate = new Date(existingSubscription.trialEndDate);
        } else {
            const registrationDate = new Date(createdAt || Date.now());
            const trialEndDate = new Date(registrationDate.getTime() + freeTrialDays * 24 * 60 * 60 * 1000);
            if (trialEndDate > startDate) startDate = trialEndDate;
        }
    }
    return startDate;
};

async function creditTreasuryForSubscription(price, planId, referenceId, referenceModel, session) {
    const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
    let adminWallet = await AdminWallet.findOne().session(session);
    if (!adminWallet) {
        const [newWallet] = await AdminWallet.create([{ balance: 0 }], { session });
        adminWallet = newWallet;
    }
    const creditedAdminWallet = await AdminWallet.findOneAndUpdate(
        { _id: adminWallet._id },
        { $inc: { balance: price, totalCommission: price, subscriptionRevenue: price } },
        { returnDocument: 'after', session }
    );

    await AdminWalletTxn.create([{
        type: 'PLATFORM_FEE_COLLECTED',
        amount: price,
        balanceAfter: creditedAdminWallet.balance,
        description: `Subscription plan ${planId} purchased`,
        referenceId,
        referenceModel
    }], { session });

    await delCache('admin_dashboard_stats');
}

async function afterSubscriptionActivated(userId, targetRole, activePlan, subId) {
    notifyUser({
        userId,
        title: 'Subscription Activated',
        message: `Your ${activePlan.label || activePlan.id} plan is now active!`,
        action: 'UPDATE',
        entityType: targetRole === 'SHOP' ? 'SHOP' : 'WORKER',
        entityId: subId,
        targetRole
    });

    const adminNotif = await Notification.create({
        userId: null,
        title: 'New Subscription Purchase',
        message: `A ${targetRole} has just purchased the ${activePlan.label || activePlan.id} plan for ₹${activePlan.price}.`,
        type: 'SYSTEM',
        action: 'CREATE',
        entityType: targetRole === 'SHOP' ? 'SHOP' : 'WORKER',
        targetRole: 'ADMIN'
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SUBSCRIPTION', id: subId || 'new' });
    const { emitToRoom } = require('../../helpers/socket.helper');
    emitToRoom('admin_dashboard', 'NEW_NOTIFICATION', adminNotif);
}

/* ─── WORKER SUBSCRIPTION ────────────────────────────────────────────── */

/**
 * POST /api/v1/subscriptions/subscribe
 * Worker/Shop purchases a plan via:
 *  - WALLET: deducted atomically, activated immediately
 *  - UPI:    creates a PENDING subscription that an Admin verifies against
 *            the bank statement before activation (anti fake-UTR)
 */
exports.subscribe = catchAsync(async (req, res) => {
    const { planId, paymentId, targetRole = 'WORKER', razorpayPaymentId, utrNumber, paymentMethod = 'UPI' } = req.body;
    const userId = req.user._id;

    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
    const plan = settings?.subscriptionPlans?.find(p => p.id === planId && p.targetRole === targetRole);

    // Fallback for older configurations that didn't have targetRole
    const activePlan = plan || settings?.subscriptionPlans?.find(p => p.id === planId);

    if (!activePlan) return errorResponse(res, 'Plan not found', StatusCodes.NOT_FOUND);

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

    const freeTrialDays = settings?.subscription?.freeTrialDays || 14;

    try {
        const isShop = targetRole === 'SHOP';

        // ── WALLET PAYMENT: deduct atomically and activate immediately ──
        if (paymentMethod === 'WALLET') {
            if (isShop) {
                const shop = await Shop.findOne({ ownerId: userId }).session(session);
                if (!shop) throw Object.assign(new Error('Shop not found for this user'), { statusCode: StatusCodes.NOT_FOUND });

                const startDate = computeStartDate(shop.subscription, shop.createdAt, freeTrialDays);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

                const updated = await Shop.findOneAndUpdate(
                    { _id: shop._id, 'wallet.balance': { $gte: activePlan.price } },
                    {
                        $inc: { 'wallet.balance': -activePlan.price },
                        $set: {
                            'subscription.planId': activePlan.id,
                            'subscription.expiryDate': endDate,
                            'subscription.isTrial': false
                        }
                    },
                    { returnDocument: 'after', session }
                );
                if (!updated) throw Object.assign(new Error('Insufficient shop wallet balance for this plan'), { statusCode: StatusCodes.PAYMENT_REQUIRED });

                const [sub] = await ShopSubscription.create([{
                    shopId: shop._id,
                    planId: activePlan.id,
                    planName: activePlan.label || activePlan.id,
                    amount: activePlan.price,
                    startDate,
                    endDate,
                    isTrial: false,
                    payment: { status: 'PAID', razorpayPaymentId: paymentId || 'wallet' }
                }], { session });

                await WalletTxn.create([{
                    userId,
                    type: 'SUBSCRIPTION',
                    amount: activePlan.price,
                    balance: updated.wallet?.balance || 0,
                    refId: String(sub._id),
                    status: 'COMPLETED',
                    description: `Subscription plan ${activePlan.label || activePlan.id} purchased via wallet`
                }], { session });

                await creditTreasuryForSubscription(activePlan.price, activePlan.id, shop._id, 'Shop', session);
                if (useTransaction) await session.commitTransaction();
                if (session) session.endSession();

                await afterSubscriptionActivated(userId, targetRole, activePlan, sub._id);
                return successResponse(res, sub, 'Subscription activated via wallet', StatusCodes.CREATED);
            } else {
                const worker = await Customer.findById(userId).session(session);
                if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: StatusCodes.NOT_FOUND });

                const startDate = computeStartDate(worker.subscription, worker.createdAt, freeTrialDays);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

                const updated = await Customer.findOneAndUpdate(
                    { _id: userId, 'wallet.balance': { $gte: activePlan.price } },
                    {
                        $inc: { 'wallet.balance': -activePlan.price },
                        $set: {
                            'subscription.planId': activePlan.id,
                            'subscription.expiryDate': endDate,
                            'subscription.isTrial': false,
                            'subscription.isActive': true
                        }
                    },
                    { returnDocument: 'after', session }
                );
                if (!updated) throw Object.assign(new Error('Insufficient wallet balance for this plan'), { statusCode: StatusCodes.PAYMENT_REQUIRED });

                const [sub] = await WorkerSubscription.create([{
                    workerId: userId,
                    planId: activePlan.id,
                    planName: activePlan.label || activePlan.id,
                    amount: activePlan.price,
                    startDate,
                    endDate,
                    isTrial: false,
                    payment: { status: 'PAID', razorpayPaymentId: paymentId || 'wallet' }
                }], { session });

                await WalletTxn.create([{
                    userId,
                    type: 'SUBSCRIPTION',
                    amount: activePlan.price,
                    balance: updated.wallet?.balance || 0,
                    refId: String(sub._id),
                    status: 'COMPLETED',
                    description: `Subscription plan ${activePlan.label || activePlan.id} purchased via wallet`
                }], { session });

                await creditTreasuryForSubscription(activePlan.price, activePlan.id, userId, 'Customer', session);
                if (useTransaction) await session.commitTransaction();
                if (session) session.endSession();

                await delCache(`session:${userId}`);
                await afterSubscriptionActivated(userId, targetRole, activePlan, sub._id);
                return successResponse(res, sub, 'Subscription activated via wallet', StatusCodes.CREATED);
            }
        }

        const { isValidUtr, findUtrUsage } = require('../../helpers/upi.helper');
        const rawUtr = (req.body.utrNumber || req.body.paymentId || req.body.razorpayPaymentId || '').toString().trim();

        if (!rawUtr) {
            return errorResponse(res, 'Please enter the 12-digit UPI Reference / UTR Number from your payment receipt.', StatusCodes.BAD_REQUEST);
        }

        if (!isValidUtr(rawUtr)) {
            return errorResponse(res, 'Invalid UTR format. Please enter the exact 12-digit UPI Reference Number from your bank receipt.', StatusCodes.BAD_REQUEST);
        }

        const utrUsage = await findUtrUsage(rawUtr);
        if (utrUsage) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been redeemed on the platform.', StatusCodes.CONFLICT);
        }

        const utrNumber = rawUtr;

        // ── AUTOMATED DIRECT UPI: Reconcile with webhook or record pending intent ──
        if (isShop) {
            const shop = await Shop.findOne({ ownerId: userId }).session(session);
            if (!shop) throw Object.assign(new Error('Shop not found for this user'), { statusCode: StatusCodes.NOT_FOUND });

            // Check if webhook already confirmed this payment
            const alreadyActive = await ShopSubscription.findOne({
                shopId: shop._id,
                'payment.status': 'PAID',
                $or: [{ 'payment.razorpayPaymentId': utrNumber }, { 'payment.webhookEventId': utrNumber }]
            }).session(session);

            if (alreadyActive) {
                if (useTransaction) await session.commitTransaction();
                if (session) session.endSession();
                return successResponse(res, alreadyActive, 'Subscription plan verified and active!', StatusCodes.OK);
            }

            // Record as pending subscription transaction awaiting webhook confirmation
            let pendingTxn = await WalletTxn.findOne({
                userId,
                status: 'PENDING',
                type: 'TOPUP',
                // never overwrite a UTR already submitted on another pending record
                $or: [{ razorpayPaymentId: utrNumber }, { planId: activePlan.id, razorpayPaymentId: { $exists: false }, createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } }]
            }).session(session);

            if (pendingTxn) {
                pendingTxn.razorpayPaymentId = utrNumber;
                pendingTxn.planId = activePlan.id;
                await pendingTxn.save({ session });
            } else {
                await WalletTxn.create([{
                    userId,
                    type: 'TOPUP',
                    amount: activePlan.price,
                    balance: shop.wallet?.balance || 0,
                    status: 'PENDING',
                    planId: activePlan.id,
                    razorpayPaymentId: utrNumber,
                    description: `Shop Subscription Plan Purchase: ${activePlan.label || activePlan.id} (UTR: ${utrNumber} - Awaiting Bank Confirmation)`
                }], { session });
            }

            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();

            emitToAll('DASHBOARD_UPDATE', {
                type: 'PENDING_SUBSCRIPTION',
                userId,
                role: 'SHOP',
                planId: activePlan.id,
                utr: utrNumber,
                amount: activePlan.price
            });

            return successResponse(res, {
                planId: activePlan.id,
                status: 'PENDING_VERIFICATION',
                verified: false,
                utr: utrNumber,
                amount: activePlan.price
            }, 'Subscription payment submitted. Awaiting bank confirmation.', StatusCodes.CREATED);

        } else {
            const worker = await Customer.findById(userId).session(session);
            if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: StatusCodes.NOT_FOUND });

            // Check if webhook already confirmed this payment
            const alreadyActive = await WorkerSubscription.findOne({
                workerId: userId,
                'payment.status': 'PAID',
                $or: [{ 'payment.razorpayPaymentId': utrNumber }, { 'payment.webhookEventId': utrNumber }]
            }).session(session);

            if (alreadyActive) {
                if (useTransaction) await session.commitTransaction();
                if (session) session.endSession();
                return successResponse(res, alreadyActive, 'Subscription plan verified and active!', StatusCodes.OK);
            }

            // Record as pending subscription transaction awaiting webhook confirmation
            let pendingTxn = await WalletTxn.findOne({
                userId,
                status: 'PENDING',
                type: 'TOPUP',
                // never overwrite a UTR already submitted on another pending record
                $or: [{ razorpayPaymentId: utrNumber }, { planId: activePlan.id, razorpayPaymentId: { $exists: false }, createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } }]
            }).session(session);

            if (pendingTxn) {
                pendingTxn.razorpayPaymentId = utrNumber;
                pendingTxn.planId = activePlan.id;
                await pendingTxn.save({ session });
            } else {
                await WalletTxn.create([{
                    userId,
                    type: 'TOPUP',
                    amount: activePlan.price,
                    balance: worker.wallet?.balance || 0,
                    status: 'PENDING',
                    planId: activePlan.id,
                    razorpayPaymentId: utrNumber,
                    description: `Worker Subscription Plan Purchase: ${activePlan.label || activePlan.id} (UTR: ${utrNumber} - Awaiting Bank Confirmation)`
                }], { session });
            }

            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();

            emitToAll('DASHBOARD_UPDATE', {
                type: 'PENDING_SUBSCRIPTION',
                userId,
                role: 'WORKER',
                planId: activePlan.id,
                utr: utrNumber,
                amount: activePlan.price
            });

            return successResponse(res, {
                planId: activePlan.id,
                status: 'PENDING_VERIFICATION',
                verified: false,
                utr: utrNumber,
                amount: activePlan.price
            }, 'Subscription payment submitted. Awaiting bank confirmation.', StatusCodes.CREATED);
        }

    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();

        // Attach statusCode so the global error handler returns the right HTTP code
        if (error.statusCode) error.status = error.statusCode;
        throw error;
    }
});

/**
 * GET /api/v1/subscriptions/my
 * Worker sees their subscription history
 */
exports.getMySubscriptions = catchAsync(async (req, res) => {
    const subs = await WorkerSubscription.find({ workerId: req.user._id })
        .populate('planId', 'name durationDays price')
        .sort('-createdAt')
        .lean();
    return successResponse(res, subs, 'Subscriptions fetched');
});

/**
 * GET /api/v1/subscriptions/plans
 * Returns available subscription plans from platform settings
 */
exports.getPlans = catchAsync(async (req, res) => {
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const plans = settings?.subscriptionPlans || [];
    return successResponse(res, plans, 'Subscription plans fetched');
});

/**
 * GET /api/v1/subscriptions (Admin)
 */
exports.getAllSubscriptions = catchAsync(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await WorkerSubscription.countDocuments();
    const subs = await WorkerSubscription.find()
        .populate('workerId', 'name phone')
        .populate('planId', 'name price')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();
    return successResponse(res, { subs, total, page, totalPages: Math.ceil(total / limit) }, 'All subscriptions');
});

/* ─── ADMIN: pending UPI subscription verification ───────────────────── */

/**
 * GET /api/v1/subscriptions/pending (Admin)
 */
exports.getPendingSubscriptions = catchAsync(async (req, res) => {
    const [workerSubs, shopSubs] = await Promise.all([
        WorkerSubscription.find({ 'payment.status': 'PENDING' })
            .populate('workerId', 'name phone')
            .sort('-createdAt').lean(),
        ShopSubscription.find({ 'payment.status': 'PENDING' })
            .populate('shopId', 'name ownerId')
            .sort('-createdAt').lean()
    ]);

    // Direct-UPI plan purchases are queued as PENDING TOPUP WalletTxns with a
    // planId (wallet.topupWallet / subscribe). Surface the ones with a UTR here
    // in the same shape; approve/reject below route them to the wallet
    // controller so the plan is activated exactly once.
    const planTxns = await WalletTxn.find({ type: 'TOPUP', status: 'PENDING', planId: { $exists: true, $nin: [null, ''] }, razorpayPaymentId: { $exists: true } })
        .populate('userId', 'name phone role')
        .sort('-createdAt').lean();
    const plans = settings => settings?.subscriptionPlans || [];
    const AppSettings = require('../settings/settings.model');
    const cfg = planTxns.length ? await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean() : null;

    const pending = [
        ...workerSubs.map(s => ({ ...s, targetRole: 'WORKER', userId: s.workerId?._id })),
        ...shopSubs.map(s => ({ ...s, targetRole: 'SHOP', userId: s.shopId?.ownerId })),
        ...planTxns.map(t => {
            const isShop = t.userId?.role === 'SHOP';
            return {
                _id: t._id,
                source: 'WALLET_TXN',
                planId: t.planId,
                planName: plans(cfg).find(p => p.id === t.planId)?.label || t.planId,
                amount: t.amount,
                createdAt: t.createdAt,
                payment: { status: 'PENDING', method: 'UPI', razorpayPaymentId: t.razorpayPaymentId },
                targetRole: isShop ? 'SHOP' : 'WORKER',
                userId: t.userId?._id,
                ...(isShop ? { shopId: { name: t.userId?.name, ownerId: t.userId?._id } } : { workerId: t.userId })
            };
        })
    ];

    return successResponse(res, { pending, count: pending.length }, 'Pending subscription verifications fetched');
});

/**
 * POST /api/v1/subscriptions/pending/:id/approve (Admin)
 * Verifies the UTR hit the platform bank account, then activates the plan.
 */
exports.approvePendingSubscription = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
    const freeTrialDays = settings?.subscription?.freeTrialDays || 14;

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

        // Try worker subscription first, then shop subscription
        let sub = await WorkerSubscription.findById(id).session(session);
        let isShop = false;
        if (!sub) {
            sub = await ShopSubscription.findById(id).session(session);
            isShop = true;
        }
        if (!sub) {
            if (session) session.endSession();
            // A queued Direct-UPI plan purchase (PENDING TOPUP WalletTxn with planId)
            const planTxn = mongoose.isValidObjectId(id) ? await WalletTxn.exists({ _id: id, planId: { $exists: true } }) : null;
            if (planTxn) return require('../wallet/wallet.controller').approvePendingTopup(req, res, next);
            return errorResponse(res, 'Subscription not found', StatusCodes.NOT_FOUND);
        }
        if (sub.payment?.status !== 'PENDING') {
            if (session) session.endSession();
            return errorResponse(res, `Subscription payment is already ${sub.payment?.status}`, StatusCodes.BAD_REQUEST);
        }

        const activePlan = (settings?.subscriptionPlans || []).find(p => p.id === sub.planId) ||
            { id: sub.planId, label: sub.planName, price: sub.amount, durationDays: 30 };

        if (isShop) {
            const shop = await Shop.findById(sub.shopId).session(session);
            if (!shop) {
                if (session) session.endSession();
                return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
            }

            const startDate = computeStartDate(shop.subscription, shop.createdAt, freeTrialDays);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

            sub.startDate = startDate;
            sub.endDate = endDate;
            sub.payment.status = 'PAID';
            await sub.save(sessOpts);

            await Shop.findByIdAndUpdate(shop._id, {
                'subscription.planId': activePlan.id,
                'subscription.expiryDate': endDate,
                'subscription.isTrial': false
            }, { session });

            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();

            await afterSubscriptionActivated(shop.ownerId, 'SHOP', activePlan, sub._id);
        } else {
            const worker = await Customer.findById(sub.workerId).session(session);
            if (!worker) {
                if (session) session.endSession();
                return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);
            }

            const startDate = computeStartDate(worker.subscription, worker.createdAt, freeTrialDays);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

            sub.startDate = startDate;
            sub.endDate = endDate;
            sub.payment.status = 'PAID';
            await sub.save(sessOpts);

            await Customer.findByIdAndUpdate(worker._id, {
                'subscription.planId': activePlan.id,
                'subscription.expiryDate': endDate,
                'subscription.isTrial': false,
                'subscription.isActive': true
            }, { session });

            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();

            await delCache(`session:${worker._id}`);
            await afterSubscriptionActivated(worker._id, 'WORKER', activePlan, sub._id);
        }

        await creditTreasuryForSubscription(sub.amount, sub.planId, sub._id, isShop ? 'ShopSubscription' : 'WorkerSubscription', null);

        return successResponse(res, sub, 'Subscription payment verified and plan activated');
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

/**
 * POST /api/v1/subscriptions/pending/:id/reject (Admin)
 * UTR never arrived — mark FAILED. No money moved, nothing to refund.
 */
exports.rejectPendingSubscription = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { reason = 'Payment not found / invalid UTR in admin bank account' } = req.body;

    let sub = await WorkerSubscription.findById(id);
    let isShop = false;
    if (!sub) {
        sub = await ShopSubscription.findById(id);
        isShop = true;
    }
    if (!sub) {
        const planTxn = mongoose.isValidObjectId(id) ? await WalletTxn.exists({ _id: id, planId: { $exists: true } }) : null;
        if (planTxn) return require('../wallet/wallet.controller').rejectPendingTopup(req, res, next);
        return errorResponse(res, 'Subscription not found', StatusCodes.NOT_FOUND);
    }
    if (sub.payment?.status !== 'PENDING') {
        return errorResponse(res, `Subscription payment is already ${sub.payment?.status}`, StatusCodes.BAD_REQUEST);
    }

    sub.payment.status = 'FAILED';
    await sub.save();

    let userId;
    if (isShop) {
        const shop = await Shop.findById(sub.shopId).select('ownerId').lean();
        userId = shop?.ownerId;
    } else {
        userId = sub.workerId;
    }

    if (userId) {
        notifyUser({
            userId,
            title: 'Subscription Payment Rejected ❌',
            message: `Your payment of ₹${sub.amount} for the ${sub.planName || sub.planId} plan (UTR: ${sub.payment.razorpayPaymentId}) could not be verified: ${reason}`,
            action: 'UPDATE',
            entityType: 'WORKER',
            entityId: sub._id,
            targetRole: isShop ? 'SHOP' : 'WORKER'
        });
    }

    emitToAll('DASHBOARD_UPDATE', { type: 'SUBSCRIPTION_REJECTED', id: sub._id });

    return successResponse(res, sub, `Subscription payment rejected: ${reason}`);
});
