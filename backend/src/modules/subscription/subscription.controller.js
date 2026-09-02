const { StatusCodes } = require('http-status-codes');
const { WorkerSubscription, ShopSubscription } = require('./subscription.model');
const Customer   = require('../customer/customer.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const Shop = require('../shop/shop.model');
const Notification = require('../notification/notification.model');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { registerPaymentIntent } = require('../../services/upiProvider.service');

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
    const { getIO } = require('../../helpers/socket.helper');
    const io = getIO();
    if (io) io.to('admin_dashboard').emit('NEW_NOTIFICATION', adminNotif);
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

        if (!isValidUtr(rawUtr) && !rawUtr.startsWith('AUTO_')) {
            return errorResponse(res, 'Invalid UTR format. Please enter the exact 12-digit UPI Reference Number from your bank receipt.', StatusCodes.BAD_REQUEST);
        }

        const utrUsage = await findUtrUsage(rawUtr);
        if (utrUsage) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been redeemed on the platform.', StatusCodes.CONFLICT);
        }

        const utrNumber = rawUtr;

        // ── AUTOMATED DIRECT UPI: Register payment intent & return UPI link ──
        let sub;
        if (isShop) {
            const shop = await Shop.findOne({ ownerId: userId }).session(session);
            if (!shop) throw Object.assign(new Error('Shop not found for this user'), { statusCode: StatusCodes.NOT_FOUND });

            const startDate = computeStartDate(shop.subscription, shop.createdAt, freeTrialDays);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

            [sub] = await ShopSubscription.create([{
                shopId: shop._id,
                planId: activePlan.id,
                planName: activePlan.label || activePlan.id,
                amount: activePlan.price,
                startDate,
                endDate,
                isTrial: false,
                payment: { status: 'PAID', razorpayPaymentId: utrNumber || 'upi_auto' }
            }], { session });

            await Shop.findByIdAndUpdate(shop._id, {
                'subscription.planId': activePlan.id,
                'subscription.expiryDate': endDate,
                'subscription.isTrial': false
            }, { session });

            await creditTreasuryForSubscription(activePlan.price, activePlan.id, userId, 'Shop', session);
            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();

            await delCache(`session:${userId}`);
            await afterSubscriptionActivated(userId, 'SHOP', activePlan, sub._id);
            return successResponse(res, sub, 'Subscription activated successfully via UPI', StatusCodes.CREATED);
        } else {
            const worker = await Customer.findById(userId).session(session);
            if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: StatusCodes.NOT_FOUND });

            const startDate = computeStartDate(worker.subscription, worker.createdAt, freeTrialDays);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

            [sub] = await WorkerSubscription.create([{
                workerId: userId,
                planId: activePlan.id,
                planName: activePlan.label || activePlan.id,
                amount: activePlan.price,
                startDate,
                endDate,
                isTrial: false,
                payment: { status: 'PAID', razorpayPaymentId: utrNumber || 'upi_auto' }
            }], { session });

            await Customer.findByIdAndUpdate(userId, {
                'subscription.planId': activePlan.id,
                'subscription.expiryDate': endDate,
                'subscription.isTrial': false
            }, { session });

            await creditTreasuryForSubscription(activePlan.price, activePlan.id, userId, 'Customer', session);
            if (useTransaction) await session.commitTransaction();
            if (session) session.endSession();

            await delCache(`session:${userId}`);
            await afterSubscriptionActivated(userId, 'WORKER', activePlan, sub._id);
            return successResponse(res, sub, 'Subscription activated successfully via UPI', StatusCodes.CREATED);
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
    const subs  = await WorkerSubscription.find()
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

    const pending = [
        ...workerSubs.map(s => ({ ...s, targetRole: 'WORKER', userId: s.workerId?._id })),
        ...shopSubs.map(s => ({ ...s, targetRole: 'SHOP', userId: s.shopId?.ownerId }))
    ];

    return successResponse(res, { pending, count: pending.length }, 'Pending subscription verifications fetched');
});

/**
 * POST /api/v1/subscriptions/pending/:id/approve (Admin)
 * Verifies the UTR hit the platform bank account, then activates the plan.
 */
exports.approvePendingSubscription = catchAsync(async (req, res) => {
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
exports.rejectPendingSubscription = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason = 'Payment not found / invalid UTR in admin bank account' } = req.body;

    let sub = await WorkerSubscription.findById(id);
    let isShop = false;
    if (!sub) {
        sub = await ShopSubscription.findById(id);
        isShop = true;
    }
    if (!sub) return errorResponse(res, 'Subscription not found', StatusCodes.NOT_FOUND);
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
