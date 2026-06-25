const { StatusCodes } = require('http-status-codes');
const Customer = require('./customer.model');
const Job = require('../job/job.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { setCache, getCache, delCache } = require('../../helpers/redis.helper');
const { notifyUser } = require('../../helpers/notifyUser.helper');

exports.getTopPros = catchAsync(async (req, res) => {
    const cachedData = await getCache('top_pros_list');
    if (cachedData) {
        return successResponse(res, cachedData, 'Top pros fetched from cache');
    }

    const pros = await Customer.find({ role: 'WORKER', isVerified: true })
        .select('name phone profileImage activeLocation rating jobs')
        .sort('-rating')
        .limit(10);
        
    await setCache('top_pros_list', pros, 3600);

    return successResponse(res, pros, 'Top pros fetched successfully');
});

exports.getProfile = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.user._id).select('-password');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    return successResponse(res, user, 'Profile fetched');
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, email } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (req.file) updateData.profileImage = '/uploads/' + req.file.filename;

    if (req.body.wallet) {
        const walletData = typeof req.body.wallet === 'string' ? JSON.parse(req.body.wallet) : req.body.wallet;
        
        if (walletData.bankDetails !== undefined) {
            updateData['wallet.bankDetails'] = walletData.bankDetails;
        }
        
        if (walletData.upiId !== undefined) {
            updateData['wallet.upiId'] = walletData.upiId === null ? '' : walletData.upiId;
        }
    }

    if (req.body.profileImageBase64) {
        const fs = require('fs');
        const path = require('path');
        const matches = req.body.profileImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        if (matches && matches.length === 3) {
            buffer = Buffer.from(matches[2], 'base64');
        } else {
            buffer = Buffer.from(req.body.profileImageBase64, 'base64');
        }
        const filename = 'profile-' + Date.now() + '.jpg';
        const filepath = path.join(__dirname, '../../../public/uploads', filename);
        if (!fs.existsSync(path.dirname(filepath))) fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, buffer);
        updateData.profileImage = '/uploads/' + filename;
    }

    if (Object.keys(updateData).length === 0) {
        return errorResponse(res, 'No data provided', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true }).select('-password');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    await delCache(`session:${req.user._id}`);
    
    notifyUser({
        userId: req.user._id,
        title: 'Profile Updated',
        message: 'Your profile has been successfully updated.',
        action: 'UPDATE',
        entityType: 'CUSTOMER',
        entityId: user._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, user, 'Profile updated');
});

exports.deleteAccount = catchAsync(async (req, res) => {
    const { password } = req.body;
    const bcrypt = require('bcryptjs');
    const user = await Customer.findById(req.user._id).select('+password');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    if (user.password) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return errorResponse(res, 'Invalid password', StatusCodes.UNAUTHORIZED);
    }

    user.isVerified = false;
    await user.save();
    await delCache(`session:${user._id}`);
    return successResponse(res, null, 'Account deactivated');
});

exports.getActiveJob = catchAsync(async (req, res) => {
    const job = await Job.findOne({
        customerId: req.user._id,
        status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'] }
    })
    .populate('workerId', 'name phone profileImage rating activeLocation')
    .sort('-createdAt')
    .lean();

    return successResponse(res, job, 'Active job fetched');
});

exports.getWorkerProfile = catchAsync(async (req, res) => {
    const worker = await Customer.findById(req.params.id)
        .select('name phone profileImage rating services city kyc.status isOnline')
        .populate('services.category', 'name icon')
        .lean();

    if (!worker || worker.role !== 'WORKER') {
        return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);
    }

    const completedJobs = await Job.countDocuments({ workerId: req.params.id, status: { $in: ['COMPLETED', 'PAID'] } });

    return successResponse(res, { ...worker, completedJobs }, 'Worker profile fetched');
});

exports.updateNotificationPreferences = catchAsync(async (req, res) => {
    const { jobUpdates, promotions } = req.body;
    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: { notificationPreferences: { jobUpdates, promotions } } },
        { new: true }
    ).select('-password');
    return successResponse(res, user, 'Notification preferences updated');
});

exports.getJobReceipt = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('workerId', 'name phone')
        .populate('customerId', 'name phone email')
        .lean();

    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (String(job.customerId._id) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    const receipt = {
        jobId: job._id,
        category: job.category,
        subcategory: job.subcategory,
        description: job.description,
        workerName: job.workerId?.name,
        amount: job.payment?.amount || 0,
        platformFee: job.payment?.platformFee || 0,
        workerPayout: job.payment?.workerPayout || 0,
        status: job.payment?.status,
        completedAt: job.completionDetails?.completedAt,
        createdAt: job.createdAt
    };

    return successResponse(res, receipt, 'Receipt fetched');
});

exports.addAddress = catchAsync(async (req, res) => {
    const { label, street, city, pincode, location, isPrimary } = req.body;
    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    if (isPrimary || user.addresses.length === 0) {
        user.addresses.forEach(a => a.isPrimary = false);
    }
    
    user.addresses.push({ label, street, city, pincode, location, isPrimary: isPrimary || user.addresses.length === 0 });
    await user.save();
    
    await notifyUser({ userId: req.user._id, entityType: 'OTHER', action: 'SYSTEM', title: 'Address Added', message: `New address '${label || 'Home'}' has been saved successfully.` });
    
    return successResponse(res, user, 'Address added successfully');
});

exports.updateAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const { label, street, city, pincode, location, isPrimary } = req.body;
    
    const user = await Customer.findById(req.user._id);
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    if (isPrimary) {
        user.addresses.forEach(a => a.isPrimary = false);
    }

    if (label) address.label = label;
    if (street) address.street = street;
    if (city) address.city = city;
    if (pincode) address.pincode = pincode;
    if (location) address.location = location;
    if (isPrimary !== undefined) address.isPrimary = isPrimary;

    await user.save();
    
    await notifyUser({ userId: req.user._id, entityType: 'OTHER', action: 'SYSTEM', title: 'Address Updated', message: `Address '${address.label}' has been updated.` });

    return successResponse(res, user, 'Address updated successfully');
});

exports.deleteAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user._id);
    
    user.addresses.pull({ _id: addressId });
    if (user.addresses.length > 0 && !user.addresses.some(a => a.isPrimary)) {
        user.addresses[0].isPrimary = true;
    }
    
    await user.save();
    
    await notifyUser({ userId: req.user._id, entityType: 'OTHER', action: 'SYSTEM', title: 'Address Deleted', message: `Your address has been removed successfully.` });

    return successResponse(res, user, 'Address deleted successfully');
});

exports.setPrimaryAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user._id);
    
    const addressExists = user.addresses.id(addressId);
    if (!addressExists) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.forEach(a => {
        a.isPrimary = String(a._id) === String(addressId);
    });

    await user.save();
    return successResponse(res, user, 'Primary address updated');
});

exports.triggerNotification = catchAsync(async (req, res) => {
    const { title, message } = req.body;
    await notifyUser({ userId: req.user._id, entityType: 'OTHER', action: 'SYSTEM', title, message });
    return successResponse(res, null, 'Notification triggered');
});
