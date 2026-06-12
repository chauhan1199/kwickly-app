const { StatusCodes } = require('http-status-codes');
const { SubscriptionPlan, WorkerSubscription } = require('./subscription.model');
const Customer   = require('../customer/customer.model');
const WalletTxn  = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');

/* ── PLAN MANAGEMENT (Admin) ─────────────────────────────────────────── */

exports.createPlan = catchAsync(async (req, res) => {
    const plan = await SubscriptionPlan.create(req.body);
    return successResponse(res, plan, 'Plan created', StatusCodes.CREATED);
});

exports.getPlans = catchAsync(async (req, res) => {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort('price');
    return successResponse(res, plans, 'Plans fetched');
});

exports.updatePlan = catchAsync(async (req, res) => {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return errorResponse(res, 'Plan not found', StatusCodes.NOT_FOUND);
    return successResponse(res, plan, 'Plan updated');
});

exports.deletePlan = catchAsync(async (req, res) => {
    await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false });
    return successResponse(res, null, 'Plan deactivated');
});

/* ── WORKER SUBSCRIPTION ─────────────────────────────────────────────── */

/**
 * POST /api/v1/subscriptions/subscribe
 * Worker purchases a plan
 */
exports.subscribe = catchAsync(async (req, res) => {
    const { planId, paymentId } = req.body;
    const workerId = req.user._id;

    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    const plan = settings?.subscriptionPlans?.find(p => p.id === planId);
    
    if (!plan) return errorResponse(res, 'Plan not found', StatusCodes.NOT_FOUND);

    // Calculate end date
    const worker = await Customer.findById(workerId);
    let startDate = new Date();
    
    // Check if worker already has an active subscription or trial
    if (worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > new Date()) {
        startDate = new Date(worker.subscription.expiryDate);
    } else if (worker.subscription?.isTrial !== false) {
        // They are on a trial that might not have an explicit expiryDate set yet, check registration date
        const registrationDate = new Date(worker.createdAt || Date.now());
        const trialEndDate = new Date(registrationDate.getTime() + 180 * 24 * 60 * 60 * 1000);
        if (trialEndDate > new Date()) {
            startDate = trialEndDate;
        }
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (plan.durationDays || 30));

    const sub = await WorkerSubscription.create({
        workerId,
        planId: plan.id,
        planName: plan.label || plan.id,
        amount:   plan.price,
        startDate,
        endDate,
        isTrial:  false,
        payment:  { status: 'PAID', razorpayPaymentId: paymentId || 'manual' }
    });

    // Update Customer subscription fields
    await Customer.findByIdAndUpdate(workerId, {
        'subscription.planId':     planId,
        'subscription.expiryDate': endDate,
        'subscription.isTrial':    false
    });

    // In Kwickly, purchasing a subscription plan acts as a 'Recharge Pack'.
    // The amount paid for the plan is credited to the worker's wallet, AND their validity is extended.
    const updatedWorker = await Customer.findByIdAndUpdate(
        workerId, 
        { $inc: { 'wallet.balance': plan.price } },
        { new: true }
    );

    await WalletTxn.create({
        userId:      workerId,
        type:        'TOPUP', // Use TOPUP to match wallet credit history
        amount:      plan.price,
        balance:     updatedWorker.wallet.balance,
        refId:       String(sub._id),
        description: `Plan Recharge: ${plan.label || plan.id}`
    });

    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SUBSCRIPTION', id: sub._id });
    emitToAll('DASHBOARD_UPDATE', { type: 'WALLET_TOPUP', id: sub._id });
    return successResponse(res, sub, 'Subscription activated & Wallet Recharged', StatusCodes.CREATED);
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
