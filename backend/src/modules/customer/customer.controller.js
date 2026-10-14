const { StatusCodes } = require('http-status-codes');
const Customer = require('./customer.model');
const Job = require('../job/job.model');
const catchAsync = require('../../helpers/async.helper');
const { uploadImage, cleanupImage } = require('../../services/cloudinary.service');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { setCache, getCache, delCache } = require('../../helpers/redis.helper');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const Suggestion = require('../suggestion/suggestion.model');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');

exports.getTopPros = catchAsync(async (req, res) => {
    const cacheKey = 'top_pros_list';
    const cached = await getCache(cacheKey);
    if (cached) {
        return successResponse(res, cached, 'Top pros fetched successfully (cached)');
    }

    // Public endpoint: never expose phone, live location or KYC documents
    const pros = await Customer.find({ role: 'WORKER', isVerified: true })
        .select('name profileImage rating jobs services bio kyc.status isVerified serviceRadius isOnline city createdAt')
        .populate('services.category', 'name icon basePrice description imageUrl subcategories')
        .sort('-rating.average -rating.count -jobs')
        .limit(20)
        .lean();

    // One grouped count instead of a countDocuments query per worker
    const counts = await Job.aggregate([
        { $match: { workerId: { $in: pros.map(p => p._id) }, status: { $in: ['COMPLETED', 'PAID'] } } },
        { $group: { _id: '$workerId', n: { $sum: 1 } } }
    ]);
    const completedByWorker = new Map(counts.map(c => [String(c._id), c.n]));

    const enrichedPros = pros.map((p) => {
        const completedJobs = completedByWorker.get(String(p._id)) || 0;
        return {
            ...p,
            jobs: completedJobs || p.jobs || 0,
            completedJobs: completedJobs || p.jobs || 0,
            verified: p.kyc?.status === 'APPROVED' || p.isVerified
        };
    });

    await setCache(cacheKey, enrichedPros, 120); // 2 min TTL for zero latency
    return successResponse(res, enrichedPros, 'Top pros fetched successfully');
});

exports.getProfile = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.user._id).select('-password').lean();
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    return successResponse(res, user, 'Profile fetched');
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, email } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (req.file) {
        const existing = await Customer.findById(req.user._id).select('profileImage').lean();
        const { url } = await uploadImage(req.file.buffer, 'kwickly/customers');
        updateData.profileImage = url;
        if (existing?.profileImage && existing.profileImage !== url) {
            cleanupImage(existing.profileImage);
        }
    }

    if (req.body.wallet) {
        let walletData;
        try {
            walletData = typeof req.body.wallet === 'string' ? JSON.parse(req.body.wallet) : req.body.wallet;
        } catch (e) {
            return errorResponse(res, 'Invalid wallet data format', StatusCodes.BAD_REQUEST);
        }
        
        if (walletData.bankDetails !== undefined) {
            if (walletData.bankDetails === null || walletData.bankDetails === '' || !walletData.bankDetails?.accountNumber) {
                updateData['wallet.bankDetails'] = { accountNumber: '', ifscCode: '', bankName: '' };
            } else {
                updateData['wallet.bankDetails'] = walletData.bankDetails;
            }
        }
        
        if (walletData.upiId !== undefined) {
            updateData['wallet.upiId'] = walletData.upiId === null ? '' : walletData.upiId.trim();
        }
    }

    if (req.body.profileImageBase64) {
        const base64Data = req.body.profileImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const existing = await Customer.findById(req.user._id).select('profileImage').lean();
        const { url } = await uploadImage(buffer, 'kwickly/customers');
        updateData.profileImage = url;
        if (existing?.profileImage && existing.profileImage !== url) {
            cleanupImage(existing.profileImage);
        }
    }

    if (Object.keys(updateData).length === 0) {
        return errorResponse(res, 'No data provided', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findByIdAndUpdate(req.user._id, { $set: updateData }, { returnDocument: 'after' }).select('-password');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    await delCache(`session:${req.user._id}`);
    await delCache('top_pros_list');
    
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

    // Cancel all active jobs for this customer
    const activeJobStatuses = ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'IN_PROGRESS'];
    await Job.updateMany(
        { customerId: req.user._id, status: { $in: activeJobStatuses } },
        { status: 'CANCELLED', $push: { statusHistory: { status: 'CANCELLED', timestamp: new Date(), note: 'Cancelled due to account deletion' } } }
    );

    // Cancel all pending shop orders for this customer
    const ShopOrder = require('../shoporder/shoporder.model');
    const pendingOrderStatuses = ['NEW', 'CONFIRMED', 'PACKING'];
    await ShopOrder.updateMany(
        { customerId: req.user._id, status: { $in: pendingOrderStatuses } },
        { status: 'CANCELLED', $push: { statusHistory: { status: 'CANCELLED', timestamp: new Date(), note: 'Cancelled due to account deletion' } } }
    );

    // Properly soft-delete the account
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.isVerified = false;
    user.isOnline = false;
    await user.save();
    await delCache(`session:${user._id}`);
    return successResponse(res, null, 'Account deleted successfully');
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
    const cacheKey = `worker_profile:${req.params.id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        return successResponse(res, cached, 'Worker profile fetched successfully (cached)');
    }

    const worker = await Customer.findById(req.params.id)
        .select('name profileImage rating services city kyc.status isOnline role bio serviceRadius createdAt')
        .populate('services.category', 'name icon basePrice description imageUrl subcategories')
        .lean();

    if (!worker || worker.role !== 'WORKER') {
        return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);
    }

    const completedJobs = await Job.countDocuments({ workerId: req.params.id, status: { $in: ['COMPLETED', 'PAID'] } });

    // Fetch real verified customer reviews for this worker
    const reviews = await Job.find({
        workerId: req.params.id,
        'rating.score': { $exists: true, $gt: 0 }
    })
    .populate('customerId', 'name profileImage')
    .select('rating customerId createdAt category subcategory')
    .sort('-rating.createdAt')
    .limit(10)
    .lean();

    const formattedReviews = reviews.map(r => ({
        id: r._id,
        reviewerName: r.customerId?.name || 'Verified Customer',
        reviewerImage: r.customerId?.profileImage || null,
        score: r.rating?.score || 5,
        reviewText: r.rating?.review || '',
        date: r.rating?.createdAt || r.createdAt,
        service: r.subcategory || r.category || 'Service'
    }));

    const responseData = {
        ...worker, 
        completedJobs,
        verified: worker.kyc?.status === 'APPROVED' || worker.isVerified,
        reviews: formattedReviews
    };

    await setCache(cacheKey, responseData, 120); // 2 min TTL for zero latency
    return successResponse(res, responseData, 'Worker profile fetched');
});

exports.updateNotificationPreferences = catchAsync(async (req, res) => {
    const { jobUpdates, promotions } = req.body;
    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: { notificationPreferences: { jobUpdates, promotions } } },
        { returnDocument: 'after' }
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
        gst: job.payment?.gst || job.payment?.gstAmount || 0,
        workerPayout: job.payment?.workerPayout || 0,
        method: job.payment?.method,
        status: job.payment?.status,
        completedAt: job.completionDetails?.completedAt,
        createdAt: job.createdAt
    };

    return successResponse(res, receipt, 'Receipt fetched');
});

exports.addAddress = catchAsync(async (req, res) => {
    const { label, street, area, city, pincode, location, isPrimary } = req.body;
    if (!label || !street || !city) {
        return errorResponse(res, 'label, street, and city are required', StatusCodes.BAD_REQUEST);
    }
    if (pincode !== undefined && pincode !== null && pincode !== '' && !/^\d{6}$/.test(pincode)) {
        return errorResponse(res, 'Pincode must be a 6-digit string', StatusCodes.BAD_REQUEST);
    }
    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    if (isPrimary || user.addresses.length === 0) {
        user.addresses.forEach(a => a.isPrimary = false);
    }
    
    user.addresses.push({ label, street, area, city, pincode, location, isPrimary: isPrimary || user.addresses.length === 0 });
    await user.save();
    
    await notifyUser({ userId: req.user._id, entityType: 'OTHER', action: 'SYSTEM', title: 'Address Added', message: `New address '${label || 'Home'}' has been saved successfully.` });
    
    return successResponse(res, user, 'Address added successfully');
});

exports.updateAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const { label, street, area, city, pincode, location, isPrimary } = req.body;
    
    const user = await Customer.findById(req.user._id);
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    if (isPrimary) {
        user.addresses.forEach(a => a.isPrimary = false);
    }

    // Use !== undefined to allow empty strings for clearing fields
    if (label !== undefined) {
        if (!label) return errorResponse(res, 'label must be a non-empty string', StatusCodes.BAD_REQUEST);
        address.label = label;
    }
    if (street !== undefined) {
        if (!street) return errorResponse(res, 'street must be a non-empty string', StatusCodes.BAD_REQUEST);
        address.street = street;
    }
    if (area !== undefined) {
        address.area = area;
    }
    if (city !== undefined) {
        if (!city) return errorResponse(res, 'city must be a non-empty string', StatusCodes.BAD_REQUEST);
        address.city = city;
    }
    if (pincode !== undefined) {
        if (pincode !== '' && !/^\d{6}$/.test(pincode)) {
            return errorResponse(res, 'Pincode must be a 6-digit string', StatusCodes.BAD_REQUEST);
        }
        address.pincode = pincode;
    }
    if (location !== undefined) address.location = location;
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
    if (title !== 'test' && title !== 'Test Notification') {
        return errorResponse(res, 'Only test notifications are allowed', StatusCodes.FORBIDDEN);
    }
    await notifyUser({ userId: req.user._id, entityType: 'OTHER', action: 'SYSTEM', title: 'Test Notification', message: message || 'This is a test notification.' });
    return successResponse(res, null, 'Notification triggered');
});

exports.submitCategorySuggestion = catchAsync(async (req, res) => {
    const { name, type, parentCategory, description } = req.body;
    
    if (!name || !type) {
        return errorResponse(res, 'Name and type are required', StatusCodes.BAD_REQUEST);
    }
    
    if (type === 'new_subcategory' && !parentCategory) {
        return errorResponse(res, 'Parent category is required for a subcategory', StatusCodes.BAD_REQUEST);
    }
    
    const suggestion = await Suggestion.create({
        workerId: req.user._id,
        workerName: req.user.name || 'Customer',
        workerCity: req.user.city || '',
        type: type,
        source: 'customer',
        payload: {
            parentCategory: type === 'new_subcategory' ? parentCategory : undefined,
            name,
            description: description || 'Suggested via customer app',
        }
    });
    
    await delCache('admin_suggestions_list');
    triggerDashboardUpdate();
    
    return successResponse(res, suggestion, 'Suggestion submitted successfully', StatusCodes.CREATED);
});
