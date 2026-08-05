const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { AUTH, COMMON } = require('../../constants/messages');
const { OTP_TTL, OTP_BLOCK_TTL, SESSION_TTL, FREE_TRIAL_DAYS_DEFAULT } = require('../../constants/business');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { setCache, getCache, delCache, getRedis } = require('../../helpers/redis.helper');

const getJwtSecret = () => process.env.JWT_SECRET; // Read at call time (server.js startup check or test setup)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (user) => jwt.sign(
    { id: user._id, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
);

const smsService = require('../../services/sms.service');

// â”€â”€â”€ OTP Rate Limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const OTP_MAX_ATTEMPTS = (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') ? 500 : 5;

const checkOtpAttempts = async (phone) => {
    const key = `otp_attempts:${phone}`;
    const attempts = await getCache(key);
    return attempts ? parseInt(attempts) : 0;
};

const incrementOtpAttempts = async (phone) => {
    const redis = getRedis();
    if (!redis) return;
    const key = `otp_attempts:${phone}`;
    try {
        const current = await redis.incr(key);
        if (current === 1) {
            // Set TTL only on first attempt
            await redis.expire(key, OTP_BLOCK_TTL);
        }
    } catch (e) {
        // Redis unavailable — skip rate limiting attempts instead of failing the request
    }
};

const resetOtpAttempts = async (phone) => {
    await delCache(`otp_attempts:${phone}`);
};

// â”€â”€â”€ Controllers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.checkStatus = catchAsync(async (req, res) => {
    const { phone, role } = req.body;
    const user = await Customer.findOne({ phone, role });

    return successResponse(res, {
        exists: !!user,
        hasPassword: !!(user && user.password)
    }, COMMON.SUCCESS);
});

exports.sendOTP = catchAsync(async (req, res) => {
    const { phone } = req.body;

    // Check if this phone is rate-limited
    const attempts = await checkOtpAttempts(phone);
    if (attempts >= OTP_MAX_ATTEMPTS) {
        return errorResponse(
            res,
            'Too many OTP requests. Please try again in 1 hour.',
            StatusCodes.TOO_MANY_REQUESTS
        );
    }

    await incrementOtpAttempts(phone);

    const otp = await smsService.sendOTP(phone);

    // Store OTP in Redis
    await setCache(`otp:${phone}`, otp, OTP_TTL);

    return successResponse(res, null, AUTH.OTP_SENT);
});

exports.verifyOTP = catchAsync(async (req, res) => {
    const { phone, code, role, fcmToken } = req.body;
    const cached = await getCache(`otp:${phone}`);

    if (!cached || String(cached) !== String(code)) {
        await incrementOtpAttempts(phone);
        return errorResponse(res, AUTH.OTP_INVALID, StatusCodes.BAD_REQUEST);
    }

    // OTP is valid — clean up
    await delCache(`otp:${phone}`);
    await resetOtpAttempts(phone);

    // P0 FIX: Do NOT silently change user role. Each {phone, role} pair is a separate account.
    let user = await Customer.findOne({ phone, role });

    if (!user) {
        if (!req.body.name) {
            return errorResponse(res, 'Name is required to create a new account.', StatusCodes.BAD_REQUEST);
        }
        // New account for this role
        const payload = { phone, role, name: req.body.name, isVerified: true };
        
        if (role === 'WORKER' || role === 'SHOP') {
            const AppSettings = require('../settings/settings.model');
            let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
            const freeTrialDays = settings?.subscription?.freeTrialDays || 14;
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + freeTrialDays);
            
            payload.subscription = {
                isTrial: true,
                trialEndDate: trialEndDate,
                expiryDate: trialEndDate
            };
        }
        
        user = await Customer.create(payload);

        if (role === 'SHOP') {
            const Shop = require('../shop/shop.model');
            await Shop.getOrCreateForOwner(user._id, user.name);
        }
    }

    // Save FCM device token if provided (for push notifications)
    if (fcmToken && fcmToken !== user.fcmToken) {
        await Customer.findByIdAndUpdate(user._id, { fcmToken });
        user.fcmToken = fcmToken;
    }

    const token = generateToken(user);

    // BUG FIX B2: Store user object directly — getCache already JSON.parses,
    // so we must NOT double-stringify here.
    const safeUser = user.toObject();
    delete safeUser.password;
    if (safeUser.wallet) {
        delete safeUser.wallet.bankDetails;
        delete safeUser.wallet.upiId;
    }
    await setCache(`session:${user._id}`, JSON.stringify(safeUser), SESSION_TTL);

    return successResponse(res, {
        token,
        user: safeUser,
        isNew: !user.password // Prompt password creation if password is not set
    }, AUTH.OTP_VERIFIED);
});

exports.login = catchAsync(async (req, res) => {
    const { email, phone, password, role, fcmToken } = req.body;

    let query = email ? { email } : { phone };
    if (role) query.role = role.toUpperCase();

    const user = await Customer.findOne(query).select('+password');

    if (!user) {
        const roleLabel = role ? role.toLowerCase() : 'admin';
        return errorResponse(res, `Account not found for the selected role (${roleLabel}). Please check your credentials.`, StatusCodes.UNAUTHORIZED);
    }

    if (!user.password) {
        return errorResponse(res, AUTH.LOGIN_FAILED, StatusCodes.UNAUTHORIZED);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return errorResponse(res, AUTH.LOGIN_FAILED, StatusCodes.UNAUTHORIZED);
    }

    // Save FCM device token if provided
    if (fcmToken && fcmToken !== user.fcmToken) {
        await Customer.findByIdAndUpdate(user._id, { fcmToken });
        user.fcmToken = fcmToken;
    }

    const token = generateToken(user);

    // BUG FIX B2: Store object directly — not double-stringified
    const userObj = user.toObject();
    delete userObj.password;
    await setCache(`session:${user._id}`, userObj, SESSION_TTL);

    return successResponse(res, {
        token,
        user: userObj
    }, AUTH.LOGIN_SUCCESS);
});

exports.logout = catchAsync(async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        // Blacklist token until its expiry
        try {
            const decoded = jwt.verify(token, getJwtSecret());
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await setCache(`blacklist:${token}`, '1', ttl);
            }
        } catch (e) {
            // Token may already be invalid â€” that's fine
        }
        // Clear user session cache
        if (req.user) {
            await delCache(`session:${req.user._id}`);
        }
    }
    return successResponse(res, null, 'Logged out successfully');
});

exports.setPassword = catchAsync(async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    await Customer.findByIdAndUpdate(req.user._id, { password: hashedPassword });

    // Invalidate session cache so new data is reflected
    await delCache(`session:${req.user._id}`);

    return successResponse(res, null, AUTH.PASSWORD_SET);
});

exports.getMe = catchAsync(async (req, res) => {
    // req.user is already populated by auth middleware (from Redis or DB)
    const user = await Customer.findById(req.user._id).select('-password').populate('services.category');
    return successResponse(res, user, COMMON.SUCCESS);
});

exports.forgotPassword = catchAsync(async (req, res) => {
    const { phone, role } = req.body;

    const user = await Customer.findOne({ phone, role: role || 'CUSTOMER' });
    if (!user) {
        return errorResponse(res, 'No account found with this phone number', StatusCodes.NOT_FOUND);
    }

    // Rate limit OTP sends
    const attempts = await checkOtpAttempts(`reset_${phone}`);
    if (attempts >= OTP_MAX_ATTEMPTS) {
        return errorResponse(res, 'Too many reset requests. Please try again later.', StatusCodes.TOO_MANY_REQUESTS);
    }
    await incrementOtpAttempts(`reset_${phone}`);

    const otp = await smsService.sendOTP(phone);
    await setCache(`reset_otp:${phone}`, otp, 300);

    return successResponse(res, null, 'Password reset OTP sent');
});

exports.resetPassword = catchAsync(async (req, res) => {
    const { phone, code, newPassword, role } = req.body;

    const cached = await getCache(`reset_otp:${phone}`);
    if (!cached || String(cached) !== String(code)) {
        return errorResponse(res, 'Invalid or expired reset code', StatusCodes.BAD_REQUEST);
    }

    await delCache(`reset_otp:${phone}`);
    await resetOtpAttempts(`reset_${phone}`);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const user = await Customer.findOneAndUpdate(
        { phone, role: role || 'CUSTOMER' },
        { password: hashedPassword },
        { returnDocument: 'after' }
    );

    if (!user) {
        return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    }

    await delCache(`session:${user._id}`);
    return successResponse(res, null, 'Password reset successfully');
});
