const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { AUTH, COMMON } = require('../../constants/messages');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { setCache, getCache, delCache } = require('../../helpers/redis.helper');

const generateToken = (user) => jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'kwickly_secret_key',
    { expiresIn: '30d' }
);

const { emitToAll } = require('../../helpers/socket.helper');

exports.checkStatus = catchAsync(async (req, res) => {
    const { phone, role } = req.body;
    const user = await Customer.findOne({ phone, role });
    
    return successResponse(res, {
        exists: !!user,
        hasPassword: !!(user && user.password)
    }, COMMON.SUCCESS);
});

const smsService = require('../../services/sms.service');

exports.sendOTP = catchAsync(async (req, res) => {
    const { phone } = req.body;
    
    // Call dynamic SMS service
    const otp = await smsService.sendOTP(phone);
    
    // Store in Redis (5 min)
    await setCache(`otp:${phone}`, otp, 300);
    
    // Emit socket event for real-time tracking (Testing/Admin)
    emitToAll('OTP_SENT', { phone, timestamp: new Date() });
    
    return successResponse(res, null, AUTH.OTP_SENT);
});

exports.verifyOTP = catchAsync(async (req, res) => {
    const { phone, code, role } = req.body;
    const cached = await getCache(`otp:${phone}`);

    if (!cached || cached !== code) {
        return errorResponse(res, AUTH.OTP_INVALID, StatusCodes.BAD_REQUEST);
    }

    await delCache(`otp:${phone}`);

    // Find user by phone (ignore role for unique constraint check)
    let user = await Customer.findOne({ phone });
    
    if (user) {
        // If user exists with a different role, we update it or reject? 
        // For simplicity, let's assume one account per phone.
        if (user.role !== role) {
            user.role = role;
            await user.save();
        }
    } else {
        // Create new user
        user = await Customer.create({ phone, role, isVerified: true });
    }

    const token = generateToken(user);
    return successResponse(res, { 
        token, 
        user, 
        isNew: !user.name || !user.password // Prompt for password if missing
    }, AUTH.OTP_VERIFIED);
});

exports.login = catchAsync(async (req, res) => {
    const { email, phone, password, role } = req.body;
    
    let query = email ? { email } : { phone };
    
    // If role is specified, prefer finding the account with that exact role
    // This allows the same phone to have both CUSTOMER and WORKER accounts
    let user = null;
    if (role) {
        user = await Customer.findOne({ ...query, role: role.toUpperCase() });
    }
    // Fall back to any account with this phone if role-specific not found
    if (!user) {
        user = await Customer.findOne(query);
    }
    
    if (!user || !user.password) {
        return errorResponse(res, AUTH.LOGIN_FAILED, StatusCodes.UNAUTHORIZED);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return errorResponse(res, AUTH.LOGIN_FAILED, StatusCodes.UNAUTHORIZED);
    }

    return successResponse(res, {
        token: generateToken(user),
        user
    }, AUTH.LOGIN_SUCCESS);
});

exports.setPassword = catchAsync(async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await Customer.findByIdAndUpdate(req.user.id, { password: hashedPassword });
    return successResponse(res, null, AUTH.PASSWORD_SET);
});

exports.getMe = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.user.id).select('-password');
    return successResponse(res, user, COMMON.SUCCESS);
});
