const { StatusCodes } = require('http-status-codes');
const { WorkerSubscription, ShopSubscription } = require('./subscription.model');
const Customer   = require('../customer/customer.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const Shop = require('../shop/shop.model');
const Notification = require('../notification/notification.model');
const { notifyUser } = require('../../helpers/notifyUser.helper');


/* ── WORKER SUBSCRIPTION ─────────────────────────────────────────────── */

/**
 * POST /api/v1/subscriptions/subscribe
 * Worker purchases a plan
 */
exports.subscribe = catchAsync(async (req, res) => {
    const { planId, paymentId, targetRole = 'WORKER' } = req.body;
    const userId = req.user._id;

    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    const plan = settings?.subscriptionPlans?.find(p => p.id === planId && p.targetRole === targetRole);
    
    // Fallback for older configurations that didn't have targetRole
    const activePlan = plan || settings?.subscriptionPlans?.find(p => p.id === planId);
    
    if (!activePlan) return errorResponse(res, 'Plan not found', StatusCodes.NOT_FOUND);

    const mongoose = require('mongoose');
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    let startDate = new Date();
    let endDate = new Date();
    let sub;

    try {
        if (targetRole === 'SHOP') {
            const shop = await Shop.findOne({ ownerId: userId }).session(session);
            if (!shop) {
                if (session) await session.abortTransaction();
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
                'subscription.isTrial':    false,
                $inc: { 'wallet.balance': activePlan.price }
            }, { new: true, session });

            await WalletTxn.create([{
                userId:      userId, // WalletTxn maps to Customer ID for auth
                type:        'TOPUP',
                amount:      activePlan.price,
                balance:     updatedShop.wallet.balance,
                refId:       String(sub._id),
                description: `Shop Plan Recharge: ${activePlan.label || activePlan.id}`
            }], { session });
        } else {
            // WORKER logic
            const worker = await Customer.findById(userId).session(session);
            if (!worker) {
                if (session) await session.abortTransaction();
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
                    'subscription.isTrial':    false,
                    $inc: { 'wallet.balance': activePlan.price } 
                },
                { new: true, session }
            );

            await WalletTxn.create([{
                userId:      userId,
                type:        'TOPUP',
                amount:      activePlan.price,
                balance:     updatedWorker.wallet.balance,
                refId:       String(sub._id),
                description: `Plan Recharge: ${activePlan.label || activePlan.id}`
            }], { session });
        }

        if (session) await session.commitTransaction();
        if (session) session.endSession();

    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }

    // Notify the user directly
    notifyUser({
        userId: userId,
        title: 'Subscription Activated 🎯',
        message: `Your ${activePlan.label || activePlan.id} plan is now active!`,
        action: 'UPDATE',
        entityType: targetRole === 'SHOP' ? 'SHOP' : 'WORKER',
        entityId: sub._id,
        targetRole: targetRole
    });

    // Notify the platform admins
    const adminNotif = await Notification.create({
        userId: null,
        title: 'New Subscription Purchase 💰',
        message: `A ${targetRole} has just purchased the ${activePlan.label || activePlan.id} plan for ₹${activePlan.price}.`,
        type: 'SYSTEM',
        action: 'CREATE',
        entityType: targetRole === 'SHOP' ? 'SHOP' : 'WORKER',
        targetRole: 'ADMIN'
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
