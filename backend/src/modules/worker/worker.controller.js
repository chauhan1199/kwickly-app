const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { COMMON } = require('../../constants/messages');

exports.updateKyc = catchAsync(async (req, res) => {
    const { documentType } = req.body;
    const user = await Customer.findById(req.user.id);
    
    if (req.file) {
        user.kyc.documents.push({
            type: documentType || 'OTHER',
            url: '/uploads/' + req.file.filename
        });
        user.kyc.status = 'PENDING';
        await user.save();
    }
    return successResponse(res, user.kyc, 'KYC document uploaded successfully');
});

exports.updateProfile = catchAsync(async (req, res) => {
    const { name, city, bio, email } = req.body;
    const updateData = {};
    if (req.file) {
        updateData.profileImage = '/uploads/' + req.file.filename;
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
        req.user.id,
        { $set: updateData },
        { new: true }
    ).select('-password');
    
    const { delCache } = require('../../helpers/redis.helper');
    await delCache(`session:${req.user.id}`);
    
    return successResponse(res, user, 'Profile updated successfully');
});

exports.updateBank = catchAsync(async (req, res) => {
    const { bankDetails, upiId } = req.body;
    const updateData = {};
    if (bankDetails) updateData['wallet.bankDetails'] = bankDetails;
    if (upiId) updateData['wallet.upiId'] = upiId;
    
    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true }
    );
    return successResponse(res, user.wallet, 'Bank details updated successfully');
});

exports.updateServices = catchAsync(async (req, res) => {
    const { services } = req.body;
    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: { services } },
        { new: true }
    );
    return successResponse(res, user.services, 'Services updated successfully');
});

exports.updateLocation = catchAsync(async (req, res) => {
    const { city, pincode, area, radius, coordinates } = req.body;
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
        req.user.id,
        { $set: updateData },
        { new: true }
    );
    return successResponse(res, { 
        serviceRadius: user.serviceRadius, 
        activeLocation: user.activeLocation 
    }, 'Location updated successfully');
});

exports.toggleOnlineStatus = catchAsync(async (req, res) => {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
        return errorResponse(res, 'isOnline (boolean) is required', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: { isOnline } },
        { new: true }
    );
    return successResponse(res, { isOnline: user.isOnline }, isOnline ? 'You are now online' : 'You are now offline');
});

exports.submitCategorySuggestion = catchAsync(async (req, res) => {
    const { name, type, parentCategory } = req.body;
    
    if (!name || !type) {
        return errorResponse(res, 'Name and type are required', StatusCodes.BAD_REQUEST);
    }
    
    if (type === 'SUBCATEGORY' && !parentCategory) {
        return errorResponse(res, 'Parent category is required for a subcategory', StatusCodes.BAD_REQUEST);
    }
    
    const suggestion = await CategorySuggestion.create({
        name,
        type,
        parentCategory: type === 'SUBCATEGORY' ? parentCategory : undefined,
        suggestedBy: req.user.id
    });
    
    return successResponse(res, suggestion, 'Suggestion submitted successfully', StatusCodes.CREATED);
});

// -- Address Management --

exports.addAddress = catchAsync(async (req, res) => {
    const { label, street, city, area, pincode, isPrimary, location } = req.body;
    const user = await Customer.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    const newAddress = { label, street, city, area, pincode, isPrimary: !!isPrimary };
    if (location && location.coordinates) {
        newAddress.location = { type: 'Point', coordinates: location.coordinates };
    }

    // If this is the first address, or isPrimary is true, unset others and set activeLocation
    if (newAddress.isPrimary || user.addresses.length === 0) {
        newAddress.isPrimary = true;
        user.addresses.forEach(a => a.isPrimary = false);
        user.activeLocation.addressDetails = { city, area, pincode };
        if (newAddress.location) {
            user.activeLocation.type = 'Point';
            user.activeLocation.coordinates = newAddress.location.coordinates;
        }
    }

    user.addresses.push(newAddress);
    await user.save();
    return successResponse(res, user.addresses, 'Address added successfully');
});

exports.updateAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const { label, street, city, area, pincode, location } = req.body;
    
    const user = await Customer.findById(req.user.id);
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
        user.activeLocation.addressDetails = { city: address.city, area: address.area, pincode: address.pincode };
        if (address.location) {
            user.activeLocation.coordinates = address.location.coordinates;
        }
    }

    await user.save();
    return successResponse(res, user.addresses, 'Address updated successfully');
});

exports.deleteAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user.id);
    
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.pull(addressId);
    
    // If we deleted the primary address and there are others left, make the first one primary
    if (address.isPrimary && user.addresses.length > 0) {
        user.addresses[0].isPrimary = true;
        const newPrim = user.addresses[0];
        user.activeLocation.addressDetails = { city: newPrim.city, area: newPrim.area, pincode: newPrim.pincode };
        if (newPrim.location) {
            user.activeLocation.coordinates = newPrim.location.coordinates;
        }
    }
    
    await user.save();
    return successResponse(res, user.addresses, 'Address deleted successfully');
});

exports.setPrimaryAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user.id);
    
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.forEach(a => a.isPrimary = false);
    address.isPrimary = true;
    
    user.activeLocation.addressDetails = { city: address.city, area: address.area, pincode: address.pincode };
    if (address.location) {
        user.activeLocation.type = 'Point';
        user.activeLocation.coordinates = address.location.coordinates;
    }

    await user.save();
    return successResponse(res, user.addresses, 'Primary address updated successfully');
});

exports.getProfile = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.user._id)
        .select('-password')
        .populate('services.category', 'name icon');
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);
    return successResponse(res, user, 'Profile fetched');
});

exports.updateFullProfile = catchAsync(async (req, res) => {
    const { name, bio, city, primary_category, secondary_categories, working_days, availability_hours, email } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData['wallet.bankDetails'] = req.body.bankDetails;
    if (email !== undefined) updateData.email = email;

    if (req.file) {
        updateData.profileImage = '/uploads/' + req.file.filename;
    }

    const user = await Customer.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true }).select('-password');
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
    const mongoose = require('mongoose');

    if (!amount || amount <= 0) return errorResponse(res, 'Invalid amount', StatusCodes.BAD_REQUEST);
    if (!payoutMethod) return errorResponse(res, 'Payout method required', StatusCodes.BAD_REQUEST);

    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
        const updated = await Customer.findOneAndUpdate(
            { _id: req.user._id, 'wallet.balance': { $gte: amount } },
            { $inc: { 'wallet.balance': -amount } },
            { new: true, session }
        );

        if (!updated) {
            if (session) await session.abortTransaction();
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

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        await delCache(`session:${req.user._id}`);
        return successResponse(res, txn, 'Withdrawal initiated');
    } catch (error) {
        if (session) await session.abortTransaction();
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
