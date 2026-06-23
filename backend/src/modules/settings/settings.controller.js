const { StatusCodes } = require('http-status-codes');
const AppSettings = require('./settings.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const Notification = require('../notification/notification.model');

const CACHE_KEY = 'app_settings';

// Helper to flatten nested settings for frontend
const flattenSettings = (s) => ({
    feeAmount: s.fees?.amount || 0,
    feeType: s.fees?.type || 'flat',
    qrExpiry: s.paymentMethods?.qrExpiry || 30,
    cashEnabled: s.paymentMethods?.cashEnabled ?? true,
    walletMinimum: s.wallet?.minimumBalance || 100,
    topupPresets: (s.wallet?.topupPresets || [50, 100, 200, 500]).join(','),
    trialDays: s.trialDurationDays || 90,
    maxRadius: s.radius?.maxKm || 15,
    radiusRound1Wait: s.radius?.rounds?.[0]?.waitMinutes || 5,
    radiusRound2Wait: s.radius?.rounds?.[1]?.waitMinutes || 10,
    otpValidity: s.otp?.validityMinutes || 10,
    otpMaxAttempts: s.otp?.maxAttempts || 5,
    otpResendCooldown: s.otp?.resendCooldownSeconds || 60,
    maintenanceMode: s.maintenance?.mode || false,
    maintenanceMsg: s.maintenance?.message || '',
    appName: s.branding?.appName || 'Kwickly',
    logoUrl: s.branding?.logoUrl || '',
    iconUrl: s.branding?.iconUrl || '',
    // Subscriptions (Flat keys for standard plans)
    monthlyPlan: s.subscriptionPlans?.find(p => p.id === 'monthly')?.price || 499,
    semiPlan: s.subscriptionPlans?.find(p => p.id === 'semi')?.price || 2499,
    annualPlan: s.subscriptionPlans?.find(p => p.id === 'annual')?.price || 4499,
    subscriptionPlans: s.subscriptionPlans || [],
    ...s.toObject() // Keep original nested for fallback
});

// Helper to map flat keys to nested paths
const mapFlatToNested = (body) => {
    const update = {};
    const mapping = {
        feeAmount: 'fees.amount',
        feeType: 'fees.type',
        qrExpiry: 'paymentMethods.qrExpiry',
        cashEnabled: 'paymentMethods.cashEnabled',
        walletMinimum: 'wallet.minimumBalance',
        topupPresets: 'wallet.topupPresets',
        trialDays: 'trialDurationDays',
        maxRadius: 'radius.maxKm',
        radiusRound1Wait: 'radius.rounds.0.waitMinutes',
        radiusRound2Wait: 'radius.rounds.1.waitMinutes',
        otpValidity: 'otp.validityMinutes',
        otpMaxAttempts: 'otp.maxAttempts',
        otpResendCooldown: 'otp.resendCooldownSeconds',
        maintenanceMode: 'maintenance.mode',
        maintenanceMsg: 'maintenance.message',
        appName: 'branding.appName',
        logoUrl: 'branding.logoUrl',
        iconUrl: 'branding.iconUrl',
        monthlyPlan: 'subscriptionPlans.0.price',
        semiPlan: 'subscriptionPlans.1.price',
        annualPlan: 'subscriptionPlans.2.price'
    };

    const numericFields = [
        'feeAmount', 'qrExpiry', 'walletMinimum', 'trialDays',
        'monthlyPlan', 'semiPlan', 'annualPlan', 'maxRadius',
        'radiusRound1Wait', 'radiusRound2Wait', 'otpValidity',
        'otpMaxAttempts', 'otpResendCooldown'
    ];
    const booleanFields = ['cashEnabled', 'maintenanceMode'];

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
    const cachedData = await getCache(CACHE_KEY);
    if (cachedData) return successResponse(res, cachedData, 'Settings from cache');

    let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    if (!settings) {
        settings = await AppSettings.create({ isSingleton: 'CONFIG' });
    }

    const flat = flattenSettings(settings);
    await setCache(CACHE_KEY, flat, 86400); 

    return successResponse(res, flat, 'Settings fetched successfully');
});

exports.getPublicSettings = catchAsync(async (req, res) => {
    const cachedData = await getCache('public_settings');
    if (cachedData) return successResponse(res, cachedData, 'Public settings from cache');

    let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    if (!settings) {
        settings = await AppSettings.create({ isSingleton: 'CONFIG' });
    }

    const publicSettings = {
        subscriptionPlans: settings.subscriptionPlans || [],
        trialDays: settings.trialDurationDays || 90,
        maintenanceMode: settings.maintenance?.mode || false,
        maintenanceMsg: settings.maintenance?.message || '',
        appName: settings.branding?.appName || 'Kwickly',
        logoUrl: settings.branding?.logoUrl || '',
        iconUrl: settings.branding?.iconUrl || ''
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
        { new: true, upsert: true }
    );
    
    await delCache(CACHE_KEY);
    await delCache('public_settings');
    await delCache('app_branding');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('UPDATE', 'SETTINGS', req.user?._id, 'Platform Settings Updated', 'Admin updated core platform settings', req.user?._id);

    // If subscription plans were updated, notify the respective users
    if (req.body.subscriptionPlans) {
        // Send a broadcast notification about plan updates
        await Notification.create({
            userId: null,
            title: 'Subscription Plans Updated 🎯',
            message: 'We have updated our subscription plans. Check out the new benefits in the app!',
            type: 'BROADCAST',
            action: 'UPDATE',
            entityType: 'SETTINGS',
            targetRole: 'ALL'
        });

        const { emitToAll } = require('../../helpers/socket.helper');
        emitToAll('NEW_NOTIFICATION', {
            title: 'Subscription Plans Updated 🎯',
            message: 'We have updated our subscription plans. Check out the new benefits in the app!',
            targetRole: 'ALL',
            action: 'UPDATE',
            entityType: 'SETTINGS'
        });
    }

    return successResponse(res, flattenSettings(settings), 'Settings updated successfully');
});
