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
const { verifyPaymentSignature, fetchPayment } = require('../../helpers/razorpay.helper');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');

/* â”€â”€ WORKER SUBSCRIPTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * POST /api/v1/subscriptions/subscribe
 * Worker purchases a plan
 */
exports.subscribe = catchAsync(async (req, res) => {
    const { planId, paymentId, targetRole = 'WORKER', razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user._id;

    // Payment verification is MANDATORY â€” prevent free subscription exploit
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return errorResponse(res, 'Payment verification required. Please complete payment via Razorpay.', StatusCodes.BAD_REQUEST);
    }

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
        return errorResponse(res, 'Invalid payment signature', StatusCodes.BAD_REQUEST);
    }
    try {
        const rpPayment = await fetchPayment(razorpayPaymentId);
        if (rpPayment.status !== 'captured') {
            return errorResponse(res, 'Payment not captured in Razorpay', StatusCodes.BAD_REQUEST);
        }
    } catch (error) {
        return errorResponse(res, 'Failed to verify payment with Razorpay', StatusCodes.INTERNAL_SERVER_ERROR);
    }

    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
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

    let startDate = new Date();
    let endDate = new Date();
    let sub;

    try {
        if (targetRole === 'SHOP') {
            const shop = await Shop.findOne({ ownerId: userId }).session(session);
            if (!shop) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Shop not found for this user', StatusCodes.NOT_FOUND);
            }

            const freeTrialDays = settings?.subscription?.freeTrialDays || 14;

            if (shop.subscription?.expiryDate && new Date(shop.subscription.expiryDate) > new Date()) {
                startDate = new Date(shop.subscription.expiryDate);
            } else if (shop.subscription?.isTrial !== false) {
                if (shop.subscription?.trialEndDate && new Date(shop.subscription.trialEndDate) > new Date()) {
                    startDate = new Date(shop.subscription.trialEndDate);
                } else {
                    const registrationDate = new Date(shop.createdAt || Date.now());
                    const trialEndDate = new Date(registrationDate.getTime() + freeTrialDays * 24 * 60 * 60 * 1000);
                    if (trialEndDate > new Date()) startDate = trialEndDate;
                }
            }

            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

            [sub] = await ShopSubscription.create([{
                shopId: shop._id,
                planId: activePlan.id,
                planName: activePlan.label || activePlan.id,
                amount:   activePlan.price,
                startDate,
                endDate,
                isTrial:  false,
                payment:  { status: 'PAID', razorpayPaymentId: paymentId || 'manual' }
            }], { session });

            const updatedShop = await Shop.findByIdAndUpdate(shop._id, {
                'subscription.planId':     activePlan.id,
                'subscription.expiryDate': endDate,
                'subscription.isTrial':    false
            }, { returnDocument: 'after', session });
        } else {
            // WORKER logic
            const worker = await Customer.findById(userId).session(session);
            if (!worker) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);
            }

            const freeTrialDays = settings?.subscription?.freeTrialDays || 14;

            if (worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > new Date()) {
                startDate = new Date(worker.subscription.expiryDate);
            } else if (worker.subscription?.isTrial !== false) {
                if (worker.subscription?.trialEndDate && new Date(worker.subscription.trialEndDate) > new Date()) {
                    startDate = new Date(worker.subscription.trialEndDate);
                } else {
                    const registrationDate = new Date(worker.createdAt || Date.now());
                    const trialEndDate = new Date(registrationDate.getTime() + freeTrialDays * 24 * 60 * 60 * 1000);
                    if (trialEndDate > new Date()) startDate = trialEndDate;
                }
            }

            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (activePlan.durationDays || 30));

            [sub] = await WorkerSubscription.create([{
                workerId: userId,
                planId: activePlan.id,
                planName: activePlan.label || activePlan.id,
                amount:   activePlan.price,
                startDate,
                endDate,
                isTrial:  false,
                payment:  { status: 'PAID', razorpayPaymentId: paymentId || 'manual' }
            }], { session });

            const updatedWorker = await Customer.findByIdAndUpdate(
                userId, 
                { 
                    'subscription.planId':     activePlan.id,
                    'subscription.expiryDate': endDate,
                    'subscription.isTrial':    false
                },
                { returnDocument: 'after', session }
            );
        }

        // Atomic: credit Admin Wallet (Platform Revenue)
        const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
        let adminWallet = await AdminWallet.findOne().session(session);
        if (!adminWallet) {
            const [newWallet] = await AdminWallet.create([{ balance: 0 }], { session });
            adminWallet = newWallet;
        }
        const creditedAdminWallet = await AdminWallet.findOneAndUpdate(
            { _id: adminWallet._id },
            { $inc: { balance: activePlan.price } },
            { returnDocument: 'after', session }
        );

        await AdminWalletTxn.create([{
            type: 'PLATFORM_FEE_COLLECTED',
            amount: activePlan.price,
            balanceAfter: creditedAdminWallet.balance,
            description: `Subscription plan ${activePlan.id} purchased by ${targetRole}`,
            referenceId: userId,
            referenceModel: targetRole === 'SHOP' ? 'Shop' : 'Customer'
        }], { session });

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

        await delCache('admin_dashboard_stats');

    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }

    // Notify the user directly
    notifyUser({
        userId: userId,
        title: 'Subscription Activated ðŸŽ¯',
        message: `Your ${activePlan.label || activePlan.id} plan is now active!`,
        action: 'UPDATE',
        entityType: targetRole === 'SHOP' ? 'SHOP' : 'WORKER',
        entityId: sub._id,
        targetRole: targetRole
    });

    // Notify the platform admins
    const adminNotif = await Notification.create({
        userId: null,
        title: 'New Subscription Purchase ðŸ’°',
        message: `A ${targetRole} has just purchased the ${activePlan.label || activePlan.id} plan for â‚¹${activePlan.price}.`,
        type: 'SYSTEM',
        action: 'CREATE',
        entityType: targetRole === 'SHOP' ? 'SHOP' : 'WORKER',
        targetRole: 'ADMIN'
    });

    const userNotif = await Notification.create({
        userId: userId,
        title: 'Plan Activated! ðŸŽ‰',
        message: `Your ${activePlan.label || activePlan.id} subscription is now active!`,
        type: 'SYSTEM',
        action: 'UPDATE'
    });
    
    const { getIO, emitToUser } = require('../../helpers/socket.helper');
    emitToUser(userId.toString(), 'NEW_NOTIFICATION', userNotif);
    const io = getIO();
    if (io) io.to('admin_dashboard').emit('NEW_NOTIFICATION', adminNotif);

    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SUBSCRIPTION', id: sub._id || 'new' });
    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP', id: sub._id || 'new' });
    return successResponse(res, sub || {}, 'Subscription activated & Wallet Recharged', StatusCodes.CREATED);
});

/**
 * GET /api/v1/subscriptions/my
 * Worker sees their subscription history
 */
exports.getMySubscriptions = catchAsync(async (req, res) => {
    const subs = await WorkerSubscription.find({ workerId: req.user._id })
        .populate('planId', 'name durationDays price')
        .sort('-createdAt');
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
        .skip((page - 1) * limit);
    return successResponse(res, { subs, total, page, totalPages: Math.ceil(total / limit) }, 'All subscriptions');
});
