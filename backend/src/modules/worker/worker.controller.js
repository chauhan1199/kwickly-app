const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { COMMON } = require('../../constants/messages');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const Suggestion = require('../suggestion/suggestion.model');
const { delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
const Job = require('../job/job.model');
const { uploadImage, cleanupImage } = require('../../services/cloudinary.service');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');

exports.getStats = catchAsync(async (req, res) => {
    const workerId = req.user._id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayJobs, completed, inProgress, cancelled] = await Promise.all([
        Job.countDocuments({ 
            workerId, 
            createdAt: { $gte: startOfDay }
        }),
        Job.countDocuments({ 
            workerId, 
            status: 'COMPLETED' 
        }),
        Job.countDocuments({
            workerId,
            status: { $in: ['ALLOCATED', 'ARRIVING', 'IN_PROGRESS'] }
        }),
        Job.countDocuments({ 
            workerId, 
            status: 'CANCELLED' 
        })
    ]);

    return successResponse(res, {
        todayJobs,
        completed,
        inProgress,
        cancelled
    }, 'Worker stats fetched');
});

exports.updateKyc = catchAsync(async (req, res) => {
    const { documentType } = req.body;
    const validDocTypes = ['AADHAR', 'PAN', 'LICENSE', 'OTHER'];
    const validatedDocType = validDocTypes.includes(documentType) ? documentType : 'OTHER';
    const user = await Customer.findById(req.user._id);

    if (req.file) {
        const { url, public_id } = await uploadImage(req.file.buffer, 'kwickly/kyc');
        user.kyc.documents.push({
            type: validatedDocType,
            url,
            public_id
        });
        user.kyc.status = 'PENDING';
        await user.save();
    } else if (req.body.documentBase64) {
        const base64Data = req.body.documentBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const { url, public_id } = await uploadImage(buffer, 'kwickly/kyc');
        user.kyc.documents.push({
            type: validatedDocType,
            url,
            public_id
        });
        user.kyc.status = 'PENDING';
        await user.save();
    } else if (req.body.documentUrl) {
        user.kyc.documents.push({
            type: validatedDocType,
            url: req.body.documentUrl
        });
        user.kyc.status = 'PENDING';
        await user.save();
    }
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    return successResponse(res, user.kyc, 'KYC document uploaded successfully');
});

exports.removeKycDocument = catchAsync(async (req, res) => {
    const { docIndex } = req.params;
    const user = await Customer.findById(req.user._id);

    if (!user.kyc.documents || !user.kyc.documents[docIndex]) {
        return errorResponse(res, 'Document not found', StatusCodes.NOT_FOUND);
    }

    const doc = user.kyc.documents[docIndex];
    cleanupImage(doc);

    user.kyc.documents.splice(Number(docIndex), 1);
    await user.save();
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${user._id}`);

    return successResponse(res, user.kyc, 'Document removed');
});

exports.updateProfile = catchAsync(async (req, res) => {
    const { name, city, bio, email } = req.body;
    const updateData = {};
    if (req.file) {
        const existing = await Customer.findById(req.user._id).select('profileImage');
        const { url, public_id } = await uploadImage(req.file.buffer, 'kwickly/profiles');
        updateData.profileImage = url;
        if (existing?.profileImage && existing.profileImage !== url) {
            cleanupImage(existing.profileImage);
        }
    } else if (req.body.profileImageBase64) {
        const base64Data = req.body.profileImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const existing = await Customer.findById(req.user._id).select('profileImage');
        const { url } = await uploadImage(buffer, 'kwickly/profiles');
        updateData.profileImage = url;
        if (existing?.profileImage && existing.profileImage !== url) {
            cleanupImage(existing.profileImage);
        }
    } else if (req.body.profileImage !== undefined) {
        updateData.profileImage = req.body.profileImage;
    }
    if (name !== undefined) updateData.name = name;
    if (city !== undefined) updateData.city = city;
    if (bio !== undefined) updateData.bio = bio;
    if (email !== undefined) updateData.email = email;
    
    if (Object.keys(updateData).length === 0) {
        return errorResponse(res, 'No data provided', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { returnDocument: 'after' }
    ).select('-password');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    triggerDashboardUpdate();
    
    notifyUser({
        userId: req.user._id,
        title: 'Profile Updated',
        message: 'Your profile has been successfully updated.',
        action: 'UPDATE',
        entityType: 'WORKER',
        entityId: user._id,
        targetRole: 'WORKER'
    });

    return successResponse(res, user, 'Profile updated successfully');
});

exports.updateBank = catchAsync(async (req, res) => {
    const { bankDetails, upiId } = req.body;
    const updateData = {};
    if (bankDetails) updateData['wallet.bankDetails'] = bankDetails;
    if (upiId) updateData['wallet.upiId'] = upiId;
    
    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { returnDocument: 'after' }
    );
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    triggerDashboardUpdate();
    const wallet = user.wallet?.toObject ? user.wallet.toObject() : { ...user.wallet };
    if (wallet.bankDetails?.accountNumber) {
        const acct = String(wallet.bankDetails.accountNumber);
        wallet.bankDetails.accountNumber = '****' + acct.slice(-4);
    }
    return successResponse(res, wallet, 'Bank details updated successfully');
});

exports.updateServices = catchAsync(async (req, res) => {
    const { services } = req.body;
    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: { services } },
        { returnDocument: 'after' }
    );
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    triggerDashboardUpdate();
    return successResponse(res, user.services, 'Services updated successfully');
});

exports.updateLocation = catchAsync(async (req, res) => {
    if (!req.isVerifiedWorker) {
        return errorResponse(res, 'You must be verified by an admin to update your broadcast location.', StatusCodes.FORBIDDEN);
    }
    const { city, pincode, area, radius, coordinates } = req.body;
    if (radius !== undefined && (radius < 1 || radius > 100)) {
        return errorResponse(res, 'Service radius must be between 1 and 100 km', StatusCodes.BAD_REQUEST);
    }
    const updateData = {};
    if (radius !== undefined) updateData.serviceRadius = radius;
    if (city || pincode || area) {
        updateData['activeLocation.addressDetails'] = { city, pincode, area };
    }
    if (coordinates) {
        updateData['activeLocation.type'] = 'Point';
        updateData['activeLocation.coordinates'] = coordinates;
    }
    
    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { returnDocument: 'after' }
    );
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    triggerDashboardUpdate();
    
    return successResponse(res, { 
        serviceRadius: user.serviceRadius, 
        activeLocation: user.activeLocation 
    }, 'Location updated successfully');
});

exports.toggleOnlineStatus = catchAsync(async (req, res) => {
    if (!req.isVerifiedWorker) {
        return errorResponse(res, 'You must be verified by an admin to go online and receive jobs.', StatusCodes.FORBIDDEN);
    }
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
        return errorResponse(res, 'isOnline (boolean) is required', StatusCodes.BAD_REQUEST);
    }

    if (isOnline) {
        const currentUser = await Customer.findById(req.user._id).select('activeLocation');
        const loc = currentUser?.activeLocation?.coordinates;
        if (!loc || (loc[0] === 0 && loc[1] === 0)) {
            return errorResponse(res, 'You must set your location before going online', StatusCodes.BAD_REQUEST);
        }
    }

    const user = await Customer.findByIdAndUpdate(
        req.user._id,
        { $set: { isOnline } },
        { returnDocument: 'after' }
    );
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    triggerDashboardUpdate();
    
    return successResponse(res, { isOnline: user.isOnline }, `You are now ${user.isOnline ? 'online' : 'offline'}`);
});

exports.submitCategorySuggestion = catchAsync(async (req, res) => {
    const { name, type, parentCategory } = req.body;
    
    if (!name || !type) {
        return errorResponse(res, 'Name and type are required', StatusCodes.BAD_REQUEST);
    }
    
    if (type === 'SUBCATEGORY' && !parentCategory) {
        return errorResponse(res, 'Parent category is required for a subcategory', StatusCodes.BAD_REQUEST);
    }
    
    const suggestion = await Suggestion.create({
        workerId: req.user._id,
        workerName: req.user.name || 'Worker',
        workerCity: req.user.city || '',
        type: type === 'SUBCATEGORY' ? 'new_subcategory' : 'new_category',
        source: 'worker',
        payload: {
            parentCategory: type === 'SUBCATEGORY' ? parentCategory : undefined,
            name,
            description: 'Suggested via worker app',
        }
    });
    
    await delCache('admin_suggestions_list');
    triggerDashboardUpdate();
    
    return successResponse(res, suggestion, 'Suggestion submitted successfully', StatusCodes.CREATED);
});

// -- Address Management --

// Keeps the worker's activeLocation a valid GeoJSON point for the 2dsphere
// index. Previously, setting activeLocation.addressDetails without ensuring
// type/coordinates existed made the document fail index extraction on save
// ("Can't extract geo keys ... unknown GeoJSON type") → 500 for workers adding
// an address without coordinates.
const syncActiveLocation = (user, addressDetails, addressLocation) => {
    const coords = addressLocation?.coordinates;
    const previous = user.activeLocation?.coordinates;
    const coordinates = (coords && coords.length === 2)
        ? coords
        : (previous && previous.length === 2 ? previous : [0, 0]);
    user.activeLocation = { type: 'Point', coordinates, addressDetails };
};

exports.addAddress = catchAsync(async (req, res) => {
    const { label, street, city, area, pincode, isPrimary, location } = req.body;
    const user = await Customer.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    if (user.addresses.length >= 10) {
        return errorResponse(res, 'Maximum of 10 addresses allowed', StatusCodes.BAD_REQUEST);
    }

    const newAddress = { label, street, city, area, pincode, isPrimary: !!isPrimary };
    if (location && location.coordinates) {
        newAddress.location = { type: 'Point', coordinates: location.coordinates };
    }

    // If this is the first address, or isPrimary is true, unset others and set activeLocation
    if (newAddress.isPrimary || user.addresses.length === 0) {
        newAddress.isPrimary = true;
        user.addresses.forEach(a => a.isPrimary = false);
        syncActiveLocation(user, { city, area, pincode }, newAddress.location);
    }

    user.addresses.push(newAddress);
    await user.save();
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    return successResponse(res, user.addresses, 'Address added successfully');
});

exports.updateAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const { label, street, city, area, pincode, location } = req.body;
    
    const user = await Customer.findById(req.user._id);
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    if (label) address.label = label;
    if (street) address.street = street;
    if (city) address.city = city;
    if (area) address.area = area;
    if (pincode) address.pincode = pincode;
    if (location && location.coordinates) {
        address.location = { type: 'Point', coordinates: location.coordinates };
    }

    if (address.isPrimary) {
        syncActiveLocation(user, { city: address.city, area: address.area, pincode: address.pincode }, address.location);
    }

    await user.save();
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    return successResponse(res, user.addresses, 'Address updated successfully');
});

exports.deleteAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user._id);
    
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.pull(addressId);
    
    // If we deleted the primary address and there are others left, make the first one primary
    if (address.isPrimary && user.addresses.length > 0) {
        user.addresses[0].isPrimary = true;
        const newPrim = user.addresses[0];
        syncActiveLocation(user, { city: newPrim.city, area: newPrim.area, pincode: newPrim.pincode }, newPrim.location);
    }
    
    await user.save();
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    return successResponse(res, user.addresses, 'Address deleted successfully');
});

exports.setPrimaryAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user._id);
    
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.forEach(a => a.isPrimary = false);
    address.isPrimary = true;
    
    syncActiveLocation(user, { city: address.city, area: address.area, pincode: address.pincode }, address.location);

    await user.save();
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    return successResponse(res, user.addresses, 'Primary address updated successfully');
});

exports.getProfile = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.user._id).select('-password').populate('services.category');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    return successResponse(res, user, 'Profile fetched successfully');
});

exports.updateFullProfile = catchAsync(async (req, res) => {
    const { name, bio, city, primary_category, secondary_categories, working_days, availability_hours, email } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (email !== undefined) updateData.email = email;
    if (working_days !== undefined) updateData.working_days = working_days;
    if (availability_hours !== undefined) updateData.availability_hours = availability_hours;

    if (req.file) {
        const existing = await Customer.findById(req.user._id).select('profileImage');
        const { url } = await uploadImage(req.file.buffer, 'kwickly/profiles');
        updateData.profileImage = url;
        if (existing?.profileImage && existing.profileImage !== url) {
            cleanupImage(existing.profileImage);
        }
    }

    const user = await Customer.findByIdAndUpdate(req.user._id, { $set: updateData }, { returnDocument: 'after' }).select('-password');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    
    await user.save();
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user._id}`);
    triggerDashboardUpdate();

    notifyUser({
        userId: req.user._id,
        title: 'Profile Updated',
        message: 'Your profile has been successfully updated.',
        action: 'UPDATE',
        entityType: 'WORKER',
        entityId: user._id,
        targetRole: 'WORKER'
    });

    return successResponse(res, user, 'Profile updated');
});

exports.getEarningsSummary = catchAsync(async (req, res) => {
    const WalletTxn = require('../wallet/wallet.model');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    const [allTime, thisMonth, thisWeek, jobCount] = await Promise.all([
        WalletTxn.aggregate([
            { $match: { userId: req.user._id, type: { $in: ['JOB_CREDIT', 'ORDER_CREDIT'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        WalletTxn.aggregate([
            { $match: { userId: req.user._id, type: { $in: ['JOB_CREDIT', 'ORDER_CREDIT'] }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        WalletTxn.aggregate([
            { $match: { userId: req.user._id, type: { $in: ['JOB_CREDIT', 'ORDER_CREDIT'] }, createdAt: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        require('../job/job.model').countDocuments({ workerId: req.user._id, status: { $in: ['COMPLETED', 'PAID'] } })
    ]);

    const totalEarned = allTime[0]?.total || 0;
    const avgPerJob = jobCount > 0 ? Math.round(totalEarned / jobCount) : 0;

    return successResponse(res, {
        totalEarned,
        thisMonth: thisMonth[0]?.total || 0,
        thisWeek: thisWeek[0]?.total || 0,
        avgPerJob,
        totalJobs: jobCount
    }, 'Earnings summary fetched');
});

exports.getEarningsChart = catchAsync(async (req, res) => {
    const WalletTxn = require('../wallet/wallet.model');
    const { period = 'week' } = req.query;

    let startDate;
    const now = new Date();
    if (period === 'week') {
        startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
        startDate = new Date(0);
    }
    startDate.setHours(0, 0, 0, 0);

    const chartData = await WalletTxn.aggregate([
        { $match: { userId: req.user._id, type: { $in: ['JOB_CREDIT', 'ORDER_CREDIT'] }, createdAt: { $gte: startDate } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
    ]);

    return successResponse(res, chartData, 'Chart data fetched');
});

exports.getEarningsTransactions = catchAsync(async (req, res) => {
    const WalletTxn = require('../wallet/wallet.model');
    const { page = 1, limit = 20, type } = req.query;

    const query = { userId: req.user._id };
    if (type) {
        query.type = type.toUpperCase();
    } else {
        query.type = { $in: ['JOB_CREDIT', 'ORDER_CREDIT', 'TOPUP', 'REFUND', 'JOB_DEBIT', 'WITHDRAWAL', 'SUBSCRIPTION', 'ADJUSTMENT'] };
    }
    const total = await WalletTxn.countDocuments(query);
    const txns = await WalletTxn.find(query)
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { txns, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Transactions fetched');
});

exports.requestEarningsWithdrawal = catchAsync(async (req, res) => {
    const { amount, payoutMethod } = req.body;
    const WalletTxn = require('../wallet/wallet.model');
    const Payout = require('../payout/payout.model');
    const { delCache } = require('../../helpers/redis.helper');

    if (!amount || amount <= 0) return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    if (amount > 100000) return errorResponse(res, 'Maximum withdrawal amount is ₹1,00,000', StatusCodes.BAD_REQUEST);
    if (!payoutMethod) return errorResponse(res, 'Payout method required', StatusCodes.BAD_REQUEST);

    let session = null;
    let useTransaction = false;
    if (supportsTransactions()) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) {
            session = null;
            useTransaction = false;
        }
    }

    try {
        const updated = await Customer.findOneAndUpdate(
            { _id: req.user._id, 'wallet.balance': { $gte: amount } },
            { $inc: { 'wallet.balance': -amount } },
            { returnDocument: 'after', session }
        );

        if (!updated) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
        }

        const [txn] = await WalletTxn.create([{
            userId: req.user._id, type: 'WITHDRAWAL', amount,
            balance: updated.wallet.balance, status: 'PENDING',
            description: `Withdrawal to ${payoutMethod}`
        }], { session });

        const paymentMethodType = payoutMethod.toLowerCase().includes('upi') ? 'UPI' : 'BANK';
        await Payout.create([{
            workerId: req.user._id, amount, paymentMethod: paymentMethodType,
            paymentDetails: payoutMethod, walletTxnId: txn._id
        }], { session });

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

        await delCache(`session:${req.user._id}`);
        return successResponse(res, txn, 'Withdrawal initiated');
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

exports.getSuggestions = catchAsync(async (req, res) => {
    const Suggestion = require('../suggestion/suggestion.model');
    const suggestions = await Suggestion.find({ workerId: req.user._id })
        .sort('-createdAt');
    return successResponse(res, suggestions, 'Suggestions fetched');
});
