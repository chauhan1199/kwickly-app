const { StatusCodes } = require('http-status-codes');
const AppSettings = require('./settings.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache, fetchWithCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const Notification = require('../notification/notification.model');

const CACHE_KEY = 'app_settings';

const DEFAULT_SUBSCRIPTION_PLANS = [
    {
        id: 'worker_trial',
        label: 'Free Trial',
        name: 'Free Trial',
        price: 0,
        durationDays: 14,
        features: ['14 Days Free Platform Access', 'Receive Service Requests', 'Standard Support'],
        isActive: true,
        targetRole: 'WORKER'
    },
    {
        id: 'worker_monthly',
        label: 'Worker Monthly',
        name: 'Worker Monthly',
        price: 499,
        durationDays: 30,
        features: ['Unlimited Job Broadcasts', 'Direct Customer Calling', 'Standard 10% Commission Cap', 'In-App Wallet Payouts'],
        isActive: true,
        targetRole: 'WORKER'
    },
    {
        id: 'worker_annual',
        label: 'Worker Annual',
        name: 'Worker Annual',
        price: 4499,
        durationDays: 365,
        features: ['Priority Lead Dispatch', 'Verified Pro Badge', 'Zero Commission on First 10 Jobs', 'Instant Daily Settlements'],
        isActive: true,
        targetRole: 'WORKER'
    },
    {
        id: 'shop_monthly',
        label: 'Shop Starter Monthly',
        name: 'Shop Starter Monthly',
        price: 299,
        durationDays: 30,
        features: ['List up to 100 Products', 'Order Management & Invoicing', 'Local Discovery Search'],
        isActive: true,
        targetRole: 'SHOP'
    },
    {
        id: 'shop_annual',
        label: 'Shop Pro Annual',
        name: 'Shop Pro Annual',
        price: 2499,
        durationDays: 365,
        features: ['Unlimited Product Catalog', 'Featured Store Placement', 'Promo Banner Boosts', 'Fast Bank Settlements'],
        isActive: true,
        targetRole: 'SHOP'
    }
];

// Helper to flatten nested settings for frontend
const flattenSettings = (s) => ({
    feeAmount: s.fees?.amount || 50,
    feeType: s.fees?.type || 'tiered',
    feeMinAmount: s.fees?.minFee !== undefined ? s.fees.minFee : (s.fees?.amount || 50),
    feeThreshold: s.fees?.threshold !== undefined ? s.fees.threshold : 500,
    feePercentage: s.fees?.percentage !== undefined ? s.fees.percentage : 12,
    gstPercentage: s.fees?.gstPercentage || 18,
    walletMinimum: s.wallet?.minimumBalance || 100,
    topupPresets: (s.wallet?.topupPresets || [50, 100, 200, 500]).join(','),
    maxRadius: s.radius?.maxKm || 15,
    maintenanceMode: s.maintenance?.mode || false,
    maintenanceMsg: s.maintenance?.message || '',
    appName: s.branding?.appName || 'Kwickly',
    logoUrl: s.branding?.logoUrl || '',
    iconUrl: s.branding?.iconUrl || '',
    // Subscriptions (Flat keys for standard plans)
    freeTrialDays: s.subscription?.freeTrialDays || 14,
    monthlyPlan: s.subscriptionPlans?.find(p => p.id === 'worker_monthly' || p.id === 'monthly')?.price || 499,
    semiPlan: s.subscriptionPlans?.find(p => p.id === 'semi')?.price || 2499,
    annualPlan: s.subscriptionPlans?.find(p => p.id === 'worker_annual' || p.id === 'annual')?.price || 4499,
    subscriptionPlans: (s.subscriptionPlans && s.subscriptionPlans.length > 0) ? s.subscriptionPlans : DEFAULT_SUBSCRIPTION_PLANS,
    termsOfService: s.legal?.termsOfService || '',
    privacyPolicy: s.legal?.privacyPolicy || '',
    ...s.toObject() // Keep original nested for fallback
});

// Helper to map flat keys to nested paths
const mapFlatToNested = (body) => {
    const update = {};
    const mapping = {
        feeAmount: 'fees.amount',
        feeType: 'fees.type',
        feeMinAmount: 'fees.minFee',
        feeThreshold: 'fees.threshold',
        feePercentage: 'fees.percentage',
        gstPercentage: 'fees.gstPercentage',
        walletMinimum: 'wallet.minimumBalance',
        topupPresets: 'wallet.topupPresets',
        maxRadius: 'radius.maxKm',
        maintenanceMode: 'maintenance.mode',
        maintenanceMsg: 'maintenance.message',
        appName: 'branding.appName',
        logoUrl: 'branding.logoUrl',
        iconUrl: 'branding.iconUrl',
        freeTrialDays: 'subscription.freeTrialDays',
        monthlyPlan: 'subscriptionPlans.0.price',
        semiPlan: 'subscriptionPlans.1.price',
        annualPlan: 'subscriptionPlans.2.price',
        termsOfService: 'legal.termsOfService',
        privacyPolicy: 'legal.privacyPolicy'
    };

    const numericFields = [
        'feeAmount', 'feeMinAmount', 'feeThreshold', 'feePercentage', 'gstPercentage', 'walletMinimum',
        'monthlyPlan', 'semiPlan', 'annualPlan', 'maxRadius', 'freeTrialDays'
    ];
    const booleanFields = ['maintenanceMode'];

    Object.keys(body).forEach(key => {
        let val = body[key];
        const path = mapping[key];
        
        if (path) {
            // Numeric casting
            if (numericFields.includes(key) && typeof val === 'string') {
                val = parseFloat(val) || 0;
            }
            // Boolean casting
            if (booleanFields.includes(key)) {
                val = val === true || val === 'true';
            }
            // Array casting (topupPresets)
            if (key === 'topupPresets' && typeof val === 'string') {
                val = val.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            }

            update[path] = val;
        }
    });

    return update;
};

exports.getSettings = catchAsync(async (req, res) => {
    const flat = await fetchWithCache(CACHE_KEY, 86400, async () => {
        let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
        if (!settings) {
            settings = await AppSettings.create({ isSingleton: 'CONFIG', subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS });
        } else if (!settings.subscriptionPlans || settings.subscriptionPlans.length === 0) {
            settings.subscriptionPlans = DEFAULT_SUBSCRIPTION_PLANS;
            await settings.save();
        }
        return flattenSettings(settings);
    });

    return successResponse(res, flat, 'Settings fetched successfully');
});

exports.getPublicSettings = catchAsync(async (req, res) => {
    const cachedData = await getCache('public_settings');
    if (cachedData) return successResponse(res, cachedData, 'Public settings from cache');

    let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    if (!settings) {
        settings = await AppSettings.create({ isSingleton: 'CONFIG', subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS });
    } else if (!settings.subscriptionPlans || settings.subscriptionPlans.length === 0) {
        settings.subscriptionPlans = DEFAULT_SUBSCRIPTION_PLANS;
        await settings.save();
    }

    const publicSettings = {
        subscriptionPlans: (settings.subscriptionPlans && settings.subscriptionPlans.length > 0) ? settings.subscriptionPlans : DEFAULT_SUBSCRIPTION_PLANS,
        maintenanceMode: settings.maintenance?.mode || false,
        maintenanceMsg: settings.maintenance?.message || '',
        appName: settings.branding?.appName || 'Kwickly',
        logoUrl: settings.branding?.logoUrl || '',
        iconUrl: settings.branding?.iconUrl || '',
        freeTrialDays: settings.subscription?.freeTrialDays || 14,
        termsOfService: settings.legal?.termsOfService || '',
        privacyPolicy: settings.legal?.privacyPolicy || ''
    };

    await setCache('public_settings', publicSettings, 86400);
    return successResponse(res, publicSettings, 'Public settings fetched');
});

exports.getBranding = catchAsync(async (req, res) => {
    const cachedData = await getCache('app_branding');
    if (cachedData) return successResponse(res, cachedData, 'Branding from cache');

    let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    if (!settings) {
        settings = await AppSettings.create({ isSingleton: 'CONFIG' });
    }

    const branding = {
        appName: settings.branding?.appName || 'Kwickly',
        logoUrl: settings.branding?.logoUrl || '',
        iconUrl: settings.branding?.iconUrl || ''
    };
    
    await setCache('app_branding', branding, 86400); 
    return successResponse(res, branding, 'Branding fetched successfully');
});

exports.updateSettings = catchAsync(async (req, res) => {
    const updatePaths = mapFlatToNested(req.body);
    
    // Explicitly pass through complex arrays that shouldn't be flattened
    if (req.body.subscriptionPlans) {
        updatePaths.subscriptionPlans = req.body.subscriptionPlans;
    }
    
    const settings = await AppSettings.findOneAndUpdate(
        { isSingleton: 'CONFIG' },
        { $set: updatePaths },
        { returnDocument: 'after', upsert: true }
    );
    
    await delCache(CACHE_KEY);
    await delCache('public_settings');
    await delCache('app_branding');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('UPDATE', 'SETTINGS', req.user?._id, 'Platform Settings Updated', 'Admin updated core platform settings', req.user?._id);

    // If subscription plans were updated, notify the respective users
    if (req.body.subscriptionPlans) {
        // Send a broadcast notification about plan updates to Workers
        await Notification.create({
            userId: null,
            title: 'Subscription Plans Updated ðŸŽ¯',
            message: 'We have updated our subscription plans. Check out the new benefits in the app!',
            type: 'BROADCAST',
            action: 'UPDATE',
            entityType: 'SETTINGS',
            targetRole: 'WORKER'
        });

        // Send a broadcast notification about plan updates to Shops
        await Notification.create({
            userId: null,
            title: 'Subscription Plans Updated ðŸŽ¯',
            message: 'We have updated our subscription plans. Check out the new benefits in the app!',
            type: 'BROADCAST',
            action: 'UPDATE',
            entityType: 'SETTINGS',
            targetRole: 'SHOP'
        });

        const { emitToAll } = require('../../helpers/socket.helper');
        emitToAll('NEW_NOTIFICATION', {
            title: 'Subscription Plans Updated ðŸŽ¯',
            message: 'We have updated our subscription plans. Check out the new benefits in the app!',
            targetRole: 'WORKER',
            action: 'UPDATE',
            entityType: 'SETTINGS'
        });
        emitToAll('NEW_NOTIFICATION', {
            title: 'Subscription Plans Updated ðŸŽ¯',
            message: 'We have updated our subscription plans. Check out the new benefits in the app!',
            targetRole: 'SHOP',
            action: 'UPDATE',
            entityType: 'SETTINGS'
        });
    }

    return successResponse(res, flattenSettings(settings), 'Settings updated successfully');
});
