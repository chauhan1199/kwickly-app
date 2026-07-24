module.exports = {
    MAX_ACTIVE_JOBS: 5,
    MAX_AVAILABLE_JOBS: 50,
    GEOFENCE_MAX_METERS: 200,
    OTP_MIN: 1000,
    OTP_MAX: 9000,
    OTP_TTL: 300,                       // 5 minutes — OTP validity window
    OTP_BLOCK_TTL: 3600,                // 1 hour — block after max attempts
    SESSION_TTL: 86400,                 // 24 hours — Redis session cache
    DASHBOARD_STATS_TTL: 300,
    BADGE_COUNTS_TTL: 60,
    JOB_ELIGIBLE_WORKERS_TTL: 1800,
    DEFAULT_SHOP_PASSWORD_LENGTH: 8,
    CART_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours — cart expiry
    SUBSCRIPTION_PLAN_DAYS: { monthly: 30, quarterly: 90, half: 180, yearly: 365 },
    EARTH_RADIUS_KM: 6371,
    FREE_TRIAL_DAYS_DEFAULT: 14,
};
