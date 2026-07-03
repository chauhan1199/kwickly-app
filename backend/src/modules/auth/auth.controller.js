const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { AUTH, COMMON } = require('../../constants/messages');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { setCache, getCache, delCache, getRedis } = require('../../helpers/redis.helper');

const getJwtSecret = () => process.env.JWT_SECRET; // Read at call time (server.js startup check or test setup)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

const generateToken = (user) => jwt.sign(
    { id: user._id, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
);

const { emitToAll } = require('../../helpers/socket.helper');
const smsService = require('../../services/sms.service');

// ─── OTP Rate Limiting ────────────────────────────────────────────────────────
const OTP_MAX_ATTEMPTS = process.env.NODE_ENV === 'test' ? 500 : 5;
const OTP_BLOCK_TTL = 3600; // 1 hour block in seconds

const checkOtpAttempts = async (phone) => {
    const key = `otp_attempts:${phone}`;
    const attempts = await getCache(key);
    return attempts ? parseInt(attempts) : 0;
};

const incrementOtpAttempts = async (phone) => {
    const redis = getRedis();
    if (!redis) return;
    const key = `otp_attempts:${phone}`;
    const current = await redis.incr(key);
    if (current === 1) {
        // Set TTL only on first attempt
        await redis.expire(key, OTP_BLOCK_TTL);
    }
};

const resetOtpAttempts = async (phone) => {
    await delCache(`otp_attempts:${phone}`);
};

// ─── Controllers ─────────────────────────────────────────────────────────────

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

    // Store OTP in Redis for 5 minutes
    await setCache(`otp:${phone}`, otp, 300);

    // Emit for admin monitoring only in non-production
    if (process.env.NODE_ENV !== 'production') {
        emitToAll('OTP_SENT', { phone, timestamp: new Date() });
    }

    return successResponse(res, null, AUTH.OTP_SENT);
});

exports.verifyOTP = catchAsync(async (req, res) => {
    const { phone, code, role } = req.body;
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
        // New account for this role
        const payload = { phone, role, isVerified: true };
        
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
    }

    const token = generateToken(user);

    // Cache the user session in Redis to avoid DB lookups on every request
    await setCache(`session:${user._id}`, JSON.stringify(user.toObject()), 86400); // 24h

    return successResponse(res, {
        token,
        user,
        isNew: !user.name // Prompt profile completion if name is missing
    }, AUTH.OTP_VERIFIED);
});

exports.login = catchAsync(async (req, res) => {
    const { email, phone, password, role } = req.body;

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

    const token = generateToken(user);

    // Cache user session
    const userObj = user.toObject();
    delete userObj.password;
    await setCache(`session:${user._id}`, JSON.stringify(userObj), 86400);

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
            // Token may already be invalid — that's fine
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
    const user = await Customer.findById(req.user._id).select('-password');
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
        { new: true }
    );

    if (!user) {
        return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    }

    await delCache(`session:${user._id}`);
    return successResponse(res, null, 'Password reset successfully');
});
