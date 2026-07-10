const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const Customer   = require('../customer/customer.model');
const Job        = require('../job/job.model');
const WalletTxn  = require('../wallet/wallet.model');
const Payout     = require('../payout/payout.model');
const Dispute    = require('../dispute/dispute.model');
const Suggestion = require('../suggestion/suggestion.model');
const Category   = require('../category/category.model');
const Shop       = require('../shop/shop.model');
const Product    = require('../product/product.model');
const ShopOrder  = require('../shoporder/shoporder.model');
const Notification = require('../notification/notification.model');
const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
const catchAsync = require('../../helpers/async.helper');
const { ADMIN, AUTH } = require('../../constants/messages');
const { successResponse, errorResponse, extractPagination } = require('../../helpers/response.helper');
const { uploadImage } = require('../../services/cloudinary.service');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate, getIO, emitToAll, emitToRoom } = require('../../helpers/socket.helper');
const bcrypt = require('bcryptjs');

const { logAdminActivity } = require('../../helpers/adminActivity.helper');

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
exports.getBadgeCounts = catchAsync(async (req, res) => {
    const cacheKey = 'admin_badge_counts';
    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, 'Badges fetched');

    const [kyc, payouts, disputes, suggestions, shopKyc] = await Promise.all([
        Customer.countDocuments({ role: 'WORKER', 'kyc.status': 'PENDING' }),
        Payout.countDocuments({ status: 'PENDING' }),
        Dispute.countDocuments({ status: 'open' }),
        Suggestion.countDocuments({ status: 'pending' }),
        Shop.countDocuments({ 'kyc.status': 'PENDING' })
    ]);

    const data = { kyc, payouts, disputes, suggestions, shopKyc };
    await setCache(cacheKey, data, 60); // 1 min TTL for real-time feel
    return successResponse(res, data, 'Badges fetched');
});

exports.getStats = catchAsync(async (req, res) => {
    const range = req.query.range || 'week';

    const rangeStart = () => {
        const d = new Date();
        if (range === 'today') { d.setHours(0,0,0,0); }
        else if (range === 'week') { d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); }
        else if (range === 'month') { d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); }
        else if (range === 'quarter') { d.setMonth(d.getMonth() - 3); d.setHours(0,0,0,0); }
        else if (range === 'year') { d.setFullYear(d.getFullYear() - 1); d.setHours(0,0,0,0); }
        else { d.setFullYear(2000); }
        return d;
    };

    const matchDate = rangeStart();

    const [totalCustomers, totalWorkers, totalShops, activeJobsCount, revenueData] = await Promise.all([
        Customer.countDocuments({ role: 'CUSTOMER' }),
        Customer.countDocuments({ role: 'WORKER' }),
        Shop.countDocuments(),
        Job.countDocuments({ status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'IN_PROGRESS'] } }),
        Job.aggregate([
            { $match: { createdAt: { $gte: matchDate }, status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, total: { $sum: '$payment.amount' } } }
        ])
    ]);

    const totalRevenue = revenueData[0]?.total || 0;

    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const chartDataRaw = await Job.aggregate([
        { $match: { createdAt: { $gte: last7Days[0] }, status: { $ne: 'CANCELLED' } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            jobs: { $sum: 1 },
            revenue: { $sum: '$payment.amount' }
        }}
    ]);

    const chartData = last7Days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        const record = chartDataRaw.find(r => r._id === dateStr);
        return { day: dayStr, jobs: record?.jobs || 0, revenue: record?.revenue || 0 };
    });

    const recentJobs = await Job.find()
        .populate('customerId', 'name')
        .sort('-createdAt')
        .limit(10)
        .lean();

    const activities = recentJobs.map(job => ({
        color: job.status === 'COMPLETED' || job.status === 'PAID' ? 'green' : job.status === 'CANCELLED' ? 'red' : 'blue',
        text: `Job #${job._id.toString().slice(-6)} — ${job.category} [${job.status}]${job.customerId?.name ? ' by ' + job.customerId.name : ''}`,
        time: job.createdAt
    }));

    const topWorkersRaw = await Job.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'PAID'] } } },
        { $group: { _id: '$workerId', totalJobs: { $sum: 1 }, totalEarnings: { $sum: '$payment.workerPayout' } } },
        { $sort: { totalJobs: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'worker' } },
        { $unwind: '$worker' }
    ]);

    const topWorkers = topWorkersRaw.map(row => ({
        name:     row.worker.name || 'Unknown',
        category: (row.worker.services?.[0]?.category) || 'Service',
        jobs:     row.totalJobs,
        rating:   row.worker.rating?.average?.toFixed(1) || '0.0',
        earned:   `₹${(row.totalEarnings || 0).toFixed(0)}`,
        status:   row.worker.isOnline ? 'online' : 'offline'
    }));

    let connectedClients = 0;
    try {
        const io = getIO();
        connectedClients = io.engine.clientsCount;
    } catch (e) { /* Socket not ready */ }

    const responseData = {
        totalCustomers, totalWorkers, totalShops,
        activeJobs: activeJobsCount, totalRevenue,
        connectedClients, activities, topWorkers, chartData
    };

    const cacheKey = `admin_dashboard_stats_${range}`;
    await setCache(cacheKey, responseData, 300);
    return successResponse(res, responseData, ADMIN.STATS_FETCHED);
});

// ─── User Management ──────────────────────────────────────────────────────────
exports.getCustomers = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'CUSTOMER' };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
        .select('-password')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { customers, total, page: Number(page), totalPages: Math.ceil(total / limit) }, ADMIN.CUSTOMERS_FETCHED);
});

exports.getWorkers = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search, kycStatus } = req.query;
    const query = { role: 'WORKER' };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
    if (kycStatus) query['kyc.status'] = kycStatus.toUpperCase();

    const total = await Customer.countDocuments(query);
    const workers = await Customer.find(query)
        .select('-password')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { workers, total, page: Number(page), totalPages: Math.ceil(total / limit) }, ADMIN.WORKERS_FETCHED);
});

exports.getPendingKYC = catchAsync(async (req, res) => {
    const workers = await Customer.find({ role: 'WORKER', 'kyc.status': 'PENDING' })
        .select('-password')
        .sort('createdAt')
        .limit(100)
        .lean();

    const shops = await Shop.find({ 'kyc.status': 'PENDING' })
        .populate('ownerId', 'name phone')
        .sort('createdAt')
        .limit(100)
        .lean();

    const items = [
        ...workers.map(w => ({ ...w, kycType: 'WORKER' })),
        ...shops.map(s => ({ ...s, kycType: 'SHOP', name: s.name, phone: s.ownerId?.phone }))
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return successResponse(res, items, ADMIN.WORKERS_FETCHED);
});

exports.updateKYC = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const worker = await Customer.findById(id);
    if (!worker || worker.role !== 'WORKER') return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    if (status === 'APPROVED' && (!worker.kyc.documents || worker.kyc.documents.length === 0)) {
        return errorResponse(res, 'Cannot approve KYC. No documents uploaded.', StatusCodes.BAD_REQUEST);
    }

    worker.kyc.status = status;
    if (status === 'APPROVED') worker.isVerified = true;
    await worker.save();

    await delCache('admin_workers_list');
    await delCache('admin_dashboard_stats');
    await delCache('admin_badge_counts');
    await delCache(`session:${worker._id}`);
    triggerDashboardUpdate();

    logAdminActivity('KYC', 'KYC', id, `KYC ${status}`, `KYC for worker "${worker.name}" was ${status.toLowerCase()}`, req.user?._id);

    const title = `KYC ${status.toLowerCase()}`;
    const message = status === 'APPROVED'
        ? `Your KYC has been approved. You can now accept jobs.`
        : `Your KYC has been rejected. Please resubmit your documents.`;

    try {
        const notification = await Notification.create({
            userId: worker._id,
            title,
            message,
            type: 'DIRECT',
            action: 'KYC',
            entityType: 'WORKER',
            entityId: worker._id,
            performedBy: req.user?._id,
            targetRole: 'WORKER'
        });
        try {
            const io = getIO();
            if (io) {
                io.to(`customer_${worker._id}`).emit('NEW_NOTIFICATION', notification);
                io.to(`worker_${worker._id}`).emit('NEW_NOTIFICATION', notification);
            }
        } catch (_) {}
    } catch (_) {}

    return successResponse(res, worker, ADMIN.KYC_UPDATED);
});

exports.addKycDocument = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { docType } = req.body;

    const worker = await Customer.findById(id);
    if (!worker || worker.role !== 'WORKER') return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    if (!req.file) return errorResponse(res, 'No file uploaded', StatusCodes.BAD_REQUEST);

    const { url } = await uploadImage(req.file.buffer, 'kwickly/kyc');
    worker.kyc.documents.push({
        type: docType || 'OTHER',
        url,
        uploadedAt: new Date()
    });
    worker.kyc.status = 'PENDING';
    await worker.save();

    await delCache(`session:${id}`);

    logAdminActivity('KYC', 'KYC', id, 'KYC Document Added', `Admin added ${docType || 'document'} for worker "${worker.name}"`, req.user?._id);

    return successResponse(res, worker, 'Document uploaded successfully');
});

exports.removeKycDocument = catchAsync(async (req, res) => {
    const { id, docIndex } = req.params;

    const worker = await Customer.findById(id);
    if (!worker || worker.role !== 'WORKER') return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    if (!worker.kyc.documents || !worker.kyc.documents[docIndex]) {
        return errorResponse(res, 'Document not found', StatusCodes.NOT_FOUND);
    }

    worker.kyc.documents.splice(Number(docIndex), 1);
    await worker.save();
    
    await delCache(`session:${id}`);

    return successResponse(res, worker, 'Document removed');
});

exports.createUser = catchAsync(async (req, res) => {
    const { name, phone, role, password, email, city, bio, profileImage, address, location, services, serviceRadius, wallet } = req.body;

    const existing = await Customer.findOne({ phone, role });
    if (existing) return errorResponse(res, 'User with this phone and role already exists', StatusCodes.BAD_REQUEST);

    const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined;

    const userData = { name, phone, role, email, city, bio, profileImage, isVerified: true, password: hashedPassword };

    if (address) {
        userData.addresses = [{
            isPrimary: true,
            label: address.label || 'Home',
            street: address.street || '',
            area: address.area || '',
            city: address.city || city || '',
            pincode: address.pincode || '',
            location: { type: 'Point', coordinates: [0, 0] }
        }];
        userData.activeLocation = {
            type: 'Point',
            coordinates: [0, 0],
            addressDetails: { city: address.city || city || '', pincode: address.pincode || '', area: address.area || '' }
        };
    }

    if (location && location.latitude && location.longitude) {
        const coords = [location.longitude, location.latitude];
        if (userData.addresses && userData.addresses[0]) {
            userData.addresses[0].location = { type: 'Point', coordinates: coords };
        }
        userData.activeLocation = {
            type: 'Point',
            coordinates: coords,
            addressDetails: { city: address?.city || city || '', pincode: address?.pincode || '', area: address?.area || '' }
        };
    }

    if (services && services.length > 0) {
        userData.services = services.map(s => ({
            category: s.category,
            subcategories: s.subcategories || [],
            isActive: s.isActive !== false
        }));
    }
    if (serviceRadius) userData.serviceRadius = serviceRadius;
    if (wallet) {
        if (wallet.bankDetails) {
            userData.wallet = userData.wallet || {};
            userData.wallet.bankDetails = wallet.bankDetails;
        }
        if (wallet.upiId !== undefined) {
            userData.wallet = userData.wallet || {};
            userData.wallet.upiId = wallet.upiId;
        }
    }

    const user = await Customer.create(userData);

    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    const entityType = role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
    logAdminActivity('CREATE', entityType, user._id, `${entityType.charAt(0) + entityType.slice(1).toLowerCase()} Created`, `New ${entityType.toLowerCase()} "${name}" (${phone}) was added to the platform`, req.user?._id);

    const { notifyUser } = require('../../helpers/notifyUser.helper');
    notifyUser({
        userId: user._id,
        title: 'Account Created',
        message: `Welcome! Your ${entityType.toLowerCase()} account has been created by the admin.`,
        action: 'OTHER',
        entityType,
        entityId: user._id,
        targetRole: entityType
    });

    return successResponse(res, user, 'User created successfully', StatusCodes.CREATED);
});

exports.updateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, city, bio, profileImage, address, location, services, serviceRadius, wallet } = req.body;

    const user = await Customer.findById(id);
    if (!user) return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (email !== undefined) user.email = email;
    if (city) user.city = city;
    if (bio !== undefined) user.bio = bio;
    if (profileImage !== undefined) user.profileImage = profileImage;

    if (address) {
        const primaryIdx = user.addresses?.findIndex(a => a.isPrimary) ?? -1;
        const addrData = {
            label: address.label || 'Home',
            street: address.street || '',
            area: address.area || '',
            city: address.city || city || user.city || '',
            pincode: address.pincode || '',
            location: { type: 'Point', coordinates: user.activeLocation?.coordinates || [0, 0] }
        };
        if (primaryIdx >= 0) {
            user.addresses[primaryIdx] = { ...user.addresses[primaryIdx].toObject(), ...addrData };
        } else {
            user.addresses = user.addresses || [];
            user.addresses.push({ ...addrData, isPrimary: true });
        }
        user.activeLocation = {
            type: 'Point',
            coordinates: user.activeLocation?.coordinates || [0, 0],
            addressDetails: { city: address.city || city || user.city || '', pincode: address.pincode || '', area: address.area || '' }
        };
    }

    if (location && location.latitude && location.longitude) {
        const coords = [location.longitude, location.latitude];
        const existingAddrDetails = (user.activeLocation && user.activeLocation.addressDetails) ? user.activeLocation.addressDetails : {};
        user.activeLocation = {
            type: 'Point',
            coordinates: coords,
            addressDetails: address ? { city: address.city || city || '', pincode: address.pincode || '', area: address.area || '' } : existingAddrDetails
        };
        if (user.addresses && user.addresses.length > 0) {
            const primary = user.addresses.find(a => a.isPrimary) || user.addresses[0];
            primary.location = { type: 'Point', coordinates: coords };
        }
    }

    if (services !== undefined) {
        user.services = services.map(s => ({
            category: s.category,
            subcategories: s.subcategories || [],
            isActive: s.isActive !== false
        }));
    }
    if (serviceRadius !== undefined) user.serviceRadius = serviceRadius;
    if (wallet) {
        if (wallet.bankDetails) {
            user.wallet = user.wallet || {};
            user.wallet.bankDetails = { ...(user.wallet.bankDetails || {}), ...wallet.bankDetails };
        }
        if (wallet.upiId !== undefined) {
            user.wallet = user.wallet || {};
            user.wallet.upiId = wallet.upiId;
        }
    }

    await user.save();

    await delCache(`session:${id}`);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    const changes = [name && 'name', phone && 'phone', email !== undefined && 'email', city && 'city', bio !== undefined && 'bio', profileImage !== undefined && 'image', address && 'address', location && 'location', services && 'services', serviceRadius !== undefined && 'service radius', wallet && 'wallet'].filter(Boolean).join(', ');
    const entityType = user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER';
    logAdminActivity('UPDATE', entityType, user._id, `${entityType.charAt(0) + entityType.slice(1).toLowerCase()} Updated`, `${entityType.charAt(0) + entityType.slice(1).toLowerCase()} "${user.name}" was updated${changes ? ' (' + changes + ')' : ''}`, req.user?._id);
    const { notifyUser } = require('../../helpers/notifyUser.helper');
    notifyUser({
        userId: user._id,
        title: 'Profile Updated',
        message: `Your profile has been updated by the admin${changes ? ' (' + changes + ')' : ''}.`,
        action: 'UPDATE',
        entityType,
        entityId: user._id,
        targetRole: entityType
    });

    return successResponse(res, user, 'User updated successfully');
});

exports.toggleUserStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findById(id);
    if (!user) return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    user.isVerified = !user.isVerified;
    await user.save();

    // Invalidate the user's session so the status change takes effect immediately
    await delCache(`session:${id}`);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    const statusText = user.isVerified ? 'activated' : 'deactivated';
    logAdminActivity('TOGGLE_STATUS', 'CUSTOMER', user._id, `Customer ${statusText}`, `Customer "${user.name}" was ${statusText}`, req.user?._id);

    const { notifyUser } = require('../../helpers/notifyUser.helper');
    notifyUser({
        userId: user._id,
        title: `Account ${user.isVerified ? 'Activated' : 'Deactivated'}`,
        message: `Your account has been ${user.isVerified ? 'activated' : 'deactivated'} by the admin.`,
        action: 'OTHER',
        entityType: user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER',
        entityId: user._id,
        targetRole: user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER'
    });

    return successResponse(res, user, ADMIN.USER_UPDATED);
});

exports.deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date(), isOnline: false }, { new: true });

    if (!user) {
        return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);
    }

    await delCache(`session:${id}`);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('DELETE', 'CUSTOMER', id, 'Customer Deleted', `Customer "${user.name}" (${user.phone}) was permanently deleted`, req.user?._id);

    const { notifyUser } = require('../../helpers/notifyUser.helper');
    notifyUser({
        userId: user._id,
        title: 'Account Deleted',
        message: `Your account has been deleted by the admin.`,
        action: 'OTHER',
        entityType: user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER',
        entityId: user._id,
        targetRole: user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER'
    });

    return successResponse(res, null, ADMIN.USER_DELETED);
});

exports.impersonateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findById(id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
        { id: user._id, role: user.role, isImpersonated: true },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    logAdminActivity('IMPERSONATE', 'CUSTOMER', user._id, 'Admin Impersonation', `Admin impersonated user "${user.name}" (${user.phone})`, req.user?._id);

    return successResponse(res, { token, user: { name: user.name, role: user.role } }, 'Impersonation token generated');
});

// ─── Shop Management (P1 FIX: Missing admin shop visibility) ─────────────────
exports.getShops = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search, kycStatus } = req.query;
    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (kycStatus) query['kyc.status'] = kycStatus.toUpperCase();

    const total = await Shop.countDocuments(query);
    const shops = await Shop.find(query)
        .populate('ownerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { shops, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Shops fetched');
});

exports.updateShopKYC = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const shop = await Shop.findById(id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    if (status === 'APPROVED' && (!shop.kyc.documents || shop.kyc.documents.length === 0)) {
        return errorResponse(res, 'Cannot approve shop KYC. No documents uploaded.', StatusCodes.BAD_REQUEST);
    }

    shop.kyc.status = status;
    await shop.save();

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    await delCache('admin_shops_list');
    triggerDashboardUpdate();

    logAdminActivity('KYC', 'SHOP', shop._id, `Shop KYC ${status}`, `KYC for shop "${shop.name}" was ${status.toLowerCase()}`, req.user?._id);

    const title = `Shop KYC ${status.toLowerCase()}`;
    const message = status === 'APPROVED'
        ? `Your shop KYC has been approved. Your shop is now visible to customers.`
        : `Your shop KYC has been rejected. Please resubmit your documents.`;

    try {
        const notification = await Notification.create({
            userId: shop.ownerId,
            title,
            message,
            type: 'DIRECT',
            action: 'KYC',
            entityType: 'SHOP',
            entityId: shop._id,
            performedBy: req.user?._id,
            targetRole: 'SHOP'
        });
        try {
            const io = getIO();
            if (io) {
                io.to(`customer_${shop.ownerId}`).emit('NEW_NOTIFICATION', notification);
            }
        } catch (_) {}
    } catch (_) {}

    return successResponse(res, shop, 'Shop KYC updated');
});

exports.toggleShopStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const shop = await Shop.findById(id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    shop.isOnline = !shop.isOnline;
    await shop.save();

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    const statusText = shop.isOnline ? 'enabled' : 'disabled';
    logAdminActivity('TOGGLE_STATUS', 'SHOP', shop._id, `Shop ${statusText}`, `Shop "${shop.name}" was ${statusText}`, req.user?._id);

    return successResponse(res, shop, `Shop ${shop.isOnline ? 'enabled' : 'disabled'}`);
});

exports.createShopAdmin = catchAsync(async (req, res) => {
    const { ownerPhone, ownerName, ownerEmail, name, category, description, address, logoUrl, location, delivery, deliveryConfig, businessHours, subscription } = req.body;

    let owner = await Customer.findOne({ phone: ownerPhone, role: 'SHOP' });
    if (!owner) {
        const hashedPwd = await bcrypt.hash('shop123', 12);
        owner = await Customer.create({
            name: ownerName || 'Shop Owner',
            phone: ownerPhone,
            email: ownerEmail || undefined,
            role: 'SHOP',
            password: hashedPwd,
            isVerified: true
        });
    }

    const existingShop = await Shop.findOne({ ownerId: owner._id });
    if (existingShop) return errorResponse(res, 'This owner already has a registered shop', StatusCodes.CONFLICT);

    const shop = await Shop.create({
        ownerId: owner._id,
        name, category, description, address, logoUrl,
        location: location || { type: 'Point', coordinates: [0, 0] },
        delivery: delivery || { radiusKm: 3, fee: 40, freeAbove: 1000 },
        deliveryConfig: deliveryConfig || { deliveryRadiusKm: 3, deliveryCharge: 40, freeDeliveryAbove: 1000, minOrderAmount: 100, discountEnabled: false, discountAbove: 1000, discountType: 'flat', discountValue: 100, discountPct: 10, maxDiscountCap: 200, sameDayDelivery: true, deliverySlots: [] },
        businessHours: businessHours || { monFri: '9 AM - 10 PM', sat: '9 AM - 10 PM', sun: '9 AM - 10 PM' },
        subscription: subscription || { plan: 'FREE_TRIAL' },
        kyc: { status: 'PENDING' }
    });

    const populated = await shop.populate('ownerId', 'name phone email');

    const { delCacheByPattern } = require('../../helpers/redis.helper');
    await delCacheByPattern('*shops_list*');

    logAdminActivity('CREATE', 'SHOP', shop._id, 'Shop Created', `Admin created shop "${shop.name}" for owner "${owner.name}"`, req.user?._id);

    triggerDashboardUpdate();

    return successResponse(res, populated, 'Shop created successfully', StatusCodes.CREATED);
});

exports.updateShopAdminFull = catchAsync(async (req, res) => {
    const { name, category, description, address, logoUrl, location, delivery, deliveryConfig, businessHours, subscription, isOnline } = req.body;

    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    if (name) shop.name = name.trim();
    if (category) shop.category = category.trim();
    if (description !== undefined) shop.description = description.trim();
    if (address) shop.address = address.trim();
    if (logoUrl !== undefined) shop.logoUrl = logoUrl;
    if (isOnline !== undefined) shop.isOnline = isOnline;

    const safeParse = (val) => { if (!val) return null; if (typeof val === 'object') return val; try { return JSON.parse(val); } catch { return null; } };

    const parsedLocation = safeParse(location);
    if (parsedLocation) shop.location = parsedLocation;

    const parsedDelivery = safeParse(delivery);
    if (parsedDelivery) shop.delivery = { ...shop.delivery, ...parsedDelivery };

    const parsedDeliveryConfig = safeParse(deliveryConfig);
    if (parsedDeliveryConfig) {
        if (!shop.deliveryConfig) shop.deliveryConfig = {};
        for (const key in parsedDeliveryConfig) {
            shop.deliveryConfig[key] = parsedDeliveryConfig[key];
        }
    }

    const parsedHours = safeParse(businessHours);
    if (parsedHours) shop.businessHours = { ...shop.businessHours, ...parsedHours };

    const parsedSub = safeParse(subscription);
    if (parsedSub) shop.subscription = { ...shop.subscription, ...parsedSub };

    if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/shops');
        shop.logoUrl = url;
    }

    shop.markModified('delivery');
    shop.markModified('deliveryConfig');
    shop.markModified('businessHours');
    shop.markModified('subscription');

    await shop.save();
    const populated = await shop.populate('ownerId', 'name phone email');

    const { delCacheByPattern } = require('../../helpers/redis.helper');
    await delCacheByPattern('*shops_list*');

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('UPDATE', 'SHOP', shop._id, 'Shop Updated', `Admin updated shop "${shop.name}"`, req.user?._id);

    return successResponse(res, populated, 'Shop updated successfully');
});

exports.deleteShopAdmin = catchAsync(async (req, res) => {
    const shop = await Shop.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date(), isOnline: false }, { new: true });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const Product = require('../product/product.model');
    await Product.updateMany({ shopId: shop._id }, { isActive: false });

    const { delCacheByPattern } = require('../../helpers/redis.helper');
    await delCacheByPattern('*shops_list*');

    logAdminActivity('DELETE', 'SHOP', shop._id, 'Shop Deleted', `Admin deleted shop "${shop.name}"`, req.user?._id);

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, null, 'Shop and all products deleted');
});

exports.getShopDetailAdmin = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone email');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const products = await Product.find({ shopId: shop._id }).sort('-createdAt');
    const walletTxns = shop.ownerId ? await WalletTxn.find({ userId: shop.ownerId._id }).sort('-createdAt').limit(20).lean() : [];

    return successResponse(res, { shop, products, walletTxns }, 'Shop detail fetched');
});

exports.creditShopWallet = catchAsync(async (req, res) => {
    const { amount, description } = req.body;
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    let adminWallet = await AdminWallet.findOne();
    if (!adminWallet) adminWallet = await AdminWallet.create({ balance: 0 });
    if (adminWallet.balance < amount) {
        return errorResponse(res, `Insufficient admin wallet balance. Available: ₹${adminWallet.balance}`, StatusCodes.BAD_REQUEST);
    }

    adminWallet.balance -= amount;
    await adminWallet.save();

    shop.wallet.balance += amount;
    await shop.save();

    await WalletTxn.create({
        userId: shop.ownerId._id,
        type: 'ADJUSTMENT',
        amount,
        balance: shop.wallet.balance,
        status: 'COMPLETED',
        description: description || `Admin credit to "${shop.name}"`,
        refId: shop._id.toString()
    });

    await AdminWalletTxn.create({
        type: 'SHOP_PAYOUT',
        amount,
        balanceAfter: adminWallet.balance,
        description: `₹${amount} credited to "${shop.name}" wallet`,
        referenceId: shop._id,
        referenceModel: 'Shop',
        meta: { performedBy: req.user?._id }
    });

    logAdminActivity('WALLET_CREDIT', 'SHOP', shop._id, 'Shop Wallet Credited', `₹${amount} credited to "${shop.name}" wallet from admin wallet`, req.user?._id);

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, { shop, adminBalance: adminWallet.balance }, `₹${amount} credited successfully`);
});

exports.debitShopWallet = catchAsync(async (req, res) => {
    const { amount, description } = req.body;
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone');
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    if (shop.wallet.balance < amount) {
        return errorResponse(res, `Insufficient balance. Available: ₹${shop.wallet.balance}`, StatusCodes.BAD_REQUEST);
    }

    shop.wallet.balance -= amount;
    await shop.save();

    let adminWallet = await AdminWallet.findOne();
    if (!adminWallet) adminWallet = await AdminWallet.create({ balance: 0 });
    adminWallet.balance += amount;
    await adminWallet.save();

    await WalletTxn.create({
        userId: shop.ownerId._id,
        type: 'ADJUSTMENT',
        amount,
        balance: shop.wallet.balance,
        status: 'COMPLETED',
        description: description || `Admin debit from "${shop.name}"`,
        refId: shop._id.toString()
    });

    await AdminWalletTxn.create({
        type: 'COMMISSION_COLLECTED',
        amount,
        balanceAfter: adminWallet.balance,
        description: `₹${amount} debited from "${shop.name}" wallet to admin`,
        referenceId: shop._id,
        referenceModel: 'Shop',
        meta: { performedBy: req.user?._id }
    });

    logAdminActivity('WALLET_DEBIT', 'SHOP', shop._id, 'Shop Wallet Debited', `₹${amount} debited from "${shop.name}" wallet to admin wallet`, req.user?._id);

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, { shop, adminBalance: adminWallet.balance }, `₹${amount} debited successfully`);
});

exports.uploadShopKycDoc = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    if (!req.file) return errorResponse(res, 'No file uploaded', StatusCodes.BAD_REQUEST);

    const { url: docUrl } = await uploadImage(req.file.buffer, 'kwickly/kyc');
    const docName = req.body.name || req.file.originalname;
    const docType = req.body.type || 'OTHER';

    shop.kyc.documents.push({ name: docName, url: docUrl, docType: docType });
    shop.kyc.status = 'PENDING';
    await shop.save();

    logAdminActivity('KYC_DOC', 'SHOP', shop._id, 'KYC Document Uploaded', `KYC document "${docName}" uploaded for "${shop.name}"`, req.user?._id);

    return successResponse(res, shop, 'KYC document uploaded');
});

exports.deleteShopKycDoc = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const docIndex = Number(req.params.docIndex);
    if (docIndex < 0 || docIndex >= shop.kyc.documents.length) {
        return errorResponse(res, 'Document not found', StatusCodes.NOT_FOUND);
    }

    const docName = shop.kyc.documents[docIndex].name;
    shop.kyc.documents.splice(docIndex, 1);
    await shop.save();

    logAdminActivity('KYC_DOC', 'SHOP', shop._id, 'KYC Document Deleted', `KYC document "${docName}" deleted from "${shop.name}"`, req.user?._id);

    return successResponse(res, shop, 'KYC document deleted');
});

exports.editShopKycDoc = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    const docIndex = Number(req.params.docIndex);
    if (docIndex < 0 || docIndex >= shop.kyc.documents.length) {
        return errorResponse(res, 'Document not found', StatusCodes.NOT_FOUND);
    }

    const { name, docType } = req.body;
    if (name) shop.kyc.documents[docIndex].name = name;
    if (docType) shop.kyc.documents[docIndex].docType = docType;

    if (req.file) {
        const { url: docUrl } = await uploadImage(req.file.buffer, 'kwickly/kyc');
        shop.kyc.documents[docIndex].url = docUrl;
    }

    await shop.save();
    logAdminActivity('KYC_DOC', 'SHOP', shop._id, 'KYC Document Updated', `KYC document updated on "${shop.name}"`, req.user?._id);
    return successResponse(res, shop, 'KYC document updated');
});

// ─── Platform Health (P1 FIX: Real socket count) ─────────────────────────────
exports.getPlatformHealth = catchAsync(async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? '✓ Connected' : '✗ Disconnected';

    let connectedClients = 0;
    let socketStatus = '✗ Not initialized';
    try {
        const io = getIO();
        connectedClients = io.engine.clientsCount;
        socketStatus = '✓ Active';
    } catch (e) { /* io not ready */ }

    const health = {
        dbStatus,
        socketStatus,
        apiVersion: '2.0.0',
        connectedClients,
        environment: process.env.NODE_ENV || 'development',
        jobsToday: await Job.countDocuments({
            createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
        }),
        ordersToday: await ShopOrder.countDocuments({
            createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
        }),
        uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
    };

    return successResponse(res, health, 'Platform health fetched');
});

// ─── P1 FIX: Ledger now uses WalletTxn (not legacy Transaction model) ─────────
exports.getLedger = catchAsync(async (req, res) => {
    const { page = 1, limit = 50, type } = req.query;

    const query = {};
    if (type && type !== 'all') query.type = type.toUpperCase();

    const total = await WalletTxn.countDocuments(query);
    const transactions = await WalletTxn.find(query)
        .populate('userId', 'name phone role')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, {
        transactions, total,
        page: Number(page),
        totalPages: Math.ceil(total / limit)
    }, 'Ledger fetched');
});

// ─── Detail Views ────────────────────────────────────────────────────────────
exports.getUserDetail = catchAsync(async (req, res) => {
    const user = await Customer.findById(req.params.id).select('-password').lean();
    if (!user) return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    const jobStats = await Job.aggregate([
        { $match: { customerId: user._id } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalSpent: { $sum: '$payment.amount' } } }
    ]);

    const { page = 1, limit = 10 } = req.query;
    const recentJobs = await Job.find({ customerId: user._id })
        .populate('workerId', 'name phone profileImage')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { user, jobStats, recentJobs }, 'User detail fetched');
});

// ─── Admin manages customer activities (jobs & orders on behalf of customer) ───

exports.getCustomerJobs = catchAsync(async (req, res) => {
    const { id } = req.params;
    const customer = await Customer.findById(id).select('name phone').lean();
    if (!customer) return errorResponse(res, 'Customer not found', StatusCodes.NOT_FOUND);

    const { page = 1, limit = 20 } = req.query;
    const jobs = await Job.find({ customerId: id })
        .populate('workerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { customer, jobs }, 'Customer jobs fetched');
});

exports.getCustomerOrders = catchAsync(async (req, res) => {
    const { id } = req.params;
    const customer = await Customer.findById(id).select('name phone').lean();
    if (!customer) return errorResponse(res, 'Customer not found', StatusCodes.NOT_FOUND);

    const { page = 1, limit = 20 } = req.query;
    const orders = await ShopOrder.find({ customerId: id })
        .populate('shopId', 'name')
        .populate('items.product', 'name price image')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { customer, orders }, 'Customer orders fetched');
});

exports.adminCreateJob = catchAsync(async (req, res) => {
    const { customerId, category, subcategory, description, media, preferredDate, timeSlot, location, addressDetails } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return errorResponse(res, 'Customer not found', StatusCodes.NOT_FOUND);
    if (customer.role !== 'CUSTOMER') return errorResponse(res, 'Target user must be a customer', StatusCodes.BAD_REQUEST);

    const job = await Job.create({
        customerId,
        category,
        subcategory,
        description,
        media,
        preferredDate,
        timeSlot,
        location: location || { type: 'Point', coordinates: [0, 0] },
        addressDetails,
        status: 'BROADCASTING',
        payment: { amount: 0, status: 'PENDING' }
    });

    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const radiusKm = settings?.radius?.maxKm || 15;
    const radiusRadians = radiusKm / 6371;

    const now = new Date();
    const jobLocation = location || { type: 'Point', coordinates: [0, 0] };
    const eligibleWorkers = await Customer.find({
        role: 'WORKER',
        isVerified: true,
        'kyc.status': 'APPROVED',
        isOnline: true,
        $or: [
            { 'subscription.isTrial': true },
            { 'subscription.expiryDate': { $gt: now } }
        ],
        'wallet.balance': { $gte: settings?.wallet?.minimumBalance || 100 },
        activeLocation: {
            $geoWithin: {
                $centerSphere: [jobLocation.coordinates, radiusRadians]
            }
        }
    }).select('_id').lean();

    emitToAll('NEW_JOB_ALERT', {
        jobId: job._id,
        category: job.category,
        subcategory: job.subcategory,
        description: job.description,
        location: job.location,
        addressDetails: job.addressDetails,
        timeSlot: job.timeSlot,
        preferredDate: job.preferredDate,
        workerCount: eligibleWorkers.length,
        customerId: { _id: customer._id, name: customer.name, phone: customer.phone, profileImage: customer.profileImage }
    });

    await delCache('admin_dashboard_stats');
    await delCache('admin_badge_counts');
    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_JOB', id: job._id });

    logAdminActivity('CREATE', 'JOB', job._id, 'Job Created (Admin)', `Admin created job "${category}" for customer "${customer.name}"`, req.user?._id);

    return successResponse(res, job, 'Job created on behalf of customer', StatusCodes.CREATED);
});

exports.adminUpdateJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { category, subcategory, description, preferredDate, timeSlot, addressDetails } = req.body;

    const job = await Job.findById(id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    if (!['BROADCASTING', 'QUOTES_RECEIVED'].includes(job.status)) {
        return errorResponse(res, 'Only broadcasting or quotes-received jobs can be edited', StatusCodes.BAD_REQUEST);
    }

    if (category !== undefined) job.category = category;
    if (subcategory !== undefined) job.subcategory = subcategory;
    if (description !== undefined) job.description = description;
    if (preferredDate !== undefined) job.preferredDate = preferredDate;
    if (timeSlot !== undefined) job.timeSlot = timeSlot;
    if (addressDetails !== undefined) job.addressDetails = addressDetails;

    await job.save();

    await delCache('admin_dashboard_stats');
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_UPDATED', id: job._id });

    logAdminActivity('UPDATE', 'JOB', job._id, 'Job Updated (Admin)', `Admin updated job #${id.slice(-6)}`, req.user?._id);

    return successResponse(res, job, 'Job updated successfully');
});

exports.adminCreateOrder = catchAsync(async (req, res) => {
    const { customerId, shopId, items, deliveryAddress, deliveryLocation, paymentMethod } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return errorResponse(res, 'Customer not found', StatusCodes.NOT_FOUND);
    if (customer.role !== 'CUSTOMER') return errorResponse(res, 'Target user must be a customer', StatusCodes.BAD_REQUEST);

    const shop = await Shop.findById(shopId);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    if (shop.kyc?.status !== 'APPROVED') return errorResponse(res, 'Shop is not approved to receive orders', StatusCodes.FORBIDDEN);

    const Product = require('../product/product.model');

    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
        for (const item of items) {
            if (!item.productId) continue;
            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, shopId, stock: { $gte: item.qty }, isActive: true },
                { $inc: { stock: -item.qty } },
                { new: true, session }
            );
            if (!updated) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, `Product "${item.name}" is out of stock or unavailable`, StatusCodes.CONFLICT);
            }
        }

        const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
        const deliveryFee = subtotal >= (shop.delivery?.freeAbove || 1000) ? 0 : (shop.delivery?.fee || 40);
        const total = subtotal + deliveryFee;

        let paymentStatus = 'PENDING';
        if (paymentMethod === 'WALLET') {
            const cust = await Customer.findOneAndUpdate(
                { _id: customerId, 'wallet.balance': { $gte: total } },
                { $inc: { 'wallet.balance': -total } },
                { new: true, session }
            );
            if (!cust) {
                if (session) await session.abortTransaction();
                if (session) session.endSession();
                return errorResponse(res, 'Customer has insufficient wallet balance', StatusCodes.PAYMENT_REQUIRED);
            }
            await WalletTxn.create([{
                userId: customerId,
                type: 'ORDER_PAYMENT',
                amount: total,
                balance: cust.wallet.balance,
                status: 'COMPLETED',
                description: `Order payment to ${shop.name} (placed by admin)`
            }], { session });
            paymentStatus = 'PAID';
            await delCache(`session:${customerId}`);
        }

        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const orderCount = await ShopOrder.countDocuments();
        const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

        const [order] = await ShopOrder.create([{
            orderNumber,
            shopId,
            customerId,
            items,
            subtotal,
            deliveryFee,
            total,
            deliveryAddress,
            deliveryLocation,
            deliveryOtp,
            payment: { amount: total, status: paymentStatus, method: paymentMethod || 'WALLET' },
            statusHistory: [{ status: 'NEW', timestamp: new Date(), note: 'Order placed by admin' }]
        }], { session });

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        emitToRoom(`shop_${shopId}`, 'NEW_ORDER', { orderId: order._id, total });
        emitToAll('DASHBOARD_UPDATE', { type: 'NEW_SHOP_ORDER', id: order._id });

        logAdminActivity('CREATE', 'ORDER', order._id, 'Order Created (Admin)', `Admin placed order #${orderNumber} for customer "${customer.name}" at "${shop.name}"`, req.user?._id);

        return successResponse(res, order, 'Order placed on behalf of customer', StatusCodes.CREATED);
    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

exports.getWorkerDetail = catchAsync(async (req, res) => {
    const worker = await Customer.findById(req.params.id).select('-password').lean();
    if (!worker || worker.role !== 'WORKER') return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);

    const jobStats = await Job.aggregate([
        { $match: { workerId: worker._id } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalEarned: { $sum: '$payment.workerPayout' } } }
    ]);

    const recentJobs = await Job.find({ workerId: worker._id })
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(10)
        .lean();

    const earnings = await WalletTxn.aggregate([
        { $match: { userId: worker._id, type: { $in: ['JOB_CREDIT', 'ORDER_CREDIT'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return successResponse(res, {
        worker, jobStats, recentJobs,
        totalEarnings: earnings[0]?.total || 0
    }, 'Worker detail fetched');
});

exports.getJobDetail = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('customerId', 'name phone email')
        .populate('workerId', 'name phone rating')
        .lean();

    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    const quotes = await require('../quote/quote.model').find({ jobId: job._id })
        .populate('workerId', 'name profileImage rating')
        .lean();

    const walletTxns = await WalletTxn.find({ refId: job._id.toString() })
        .sort('-createdAt')
        .lean();

    return successResponse(res, { job, quotes, walletTxns }, 'Job detail fetched');
});

// ─── CSV Export Helpers ──────────────────────────────────────────────────────

exports.exportCustomers = catchAsync(async (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.write('ID,Name,Phone,Email,Verified,CreatedAt\n');
    
    const cursor = Customer.find({ role: 'CUSTOMER' }).select('-password').lean().cursor();
    for await (const doc of cursor) {
        const row = [doc._id, doc.name || '', doc.phone || '', doc.email || '', doc.isVerified ? 'Yes' : 'No', doc.createdAt].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        res.write(row + '\n');
    }
    res.end();
});

exports.exportWorkers = catchAsync(async (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=workers.csv');
    res.write('ID,Name,Phone,KYC Status,Verified,CreatedAt\n');

    const cursor = Customer.find({ role: 'WORKER' }).select('-password').lean().cursor();
    for await (const doc of cursor) {
        const row = [doc._id, doc.name || '', doc.phone || '', doc.kyc?.status || 'PENDING', doc.isVerified ? 'Yes' : 'No', doc.createdAt].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        res.write(row + '\n');
    }
    res.end();
});

exports.exportJobs = catchAsync(async (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=jobs.csv');
    res.write('ID,Customer,Worker,Category,Status,Amount,CreatedAt\n');

    const cursor = Job.find().populate('customerId', 'name phone').populate('workerId', 'name phone').lean().cursor();
    for await (const doc of cursor) {
        const row = [doc._id, doc.customerId?.name || '', doc.workerId?.name || '', doc.category || '', doc.status || '', doc.payment?.amount || 0, doc.createdAt].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        res.write(row + '\n');
    }
    res.end();
});

exports.exportPayments = catchAsync(async (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    res.write('ID,User,Type,Amount,Status,RefId,CreatedAt\n');

    const cursor = WalletTxn.find().populate('userId', 'name phone role').sort('-createdAt').lean().cursor();
    for await (const doc of cursor) {
        const row = [doc._id, doc.userId?.name || '', doc.type || '', doc.amount || 0, doc.status || '', doc.refId || '', doc.createdAt].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        res.write(row + '\n');
    }
    res.end();
});

// ─── Payout Management ────────────────────────────────────────────────────────
exports.getPayouts = catchAsync(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();

    const total = await Payout.countDocuments(query);
    const payouts = await Payout.find(query)
        .populate('workerId', 'name phone city address wallet')
        .populate('shopId', 'name city address wallet')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { payouts, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Payouts fetched');
});

exports.updatePayoutStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, txnId, rejectReason } = req.body;

    const payout = await Payout.findById(id);
    if (!payout) return errorResponse(res, 'Payout not found', StatusCodes.NOT_FOUND);

    const isRejecting = payout.status !== 'REJECTED' && status === 'REJECTED';
    
    payout.status = status;
    if (txnId) payout.txnId = txnId;
    if (rejectReason) payout.rejectReason = rejectReason;
    payout.processedAt = new Date();
    await payout.save();

    if (isRejecting) {
        // Refund the deducted amount
        const Customer = require('../customer/customer.model');
        const Shop = require('../shop/shop.model');
        
        if (payout.shopId) {
            await Shop.findByIdAndUpdate(payout.shopId, { $inc: { 'wallet.balance': payout.amount } });
        } else if (payout.workerId) {
            await Customer.findByIdAndUpdate(payout.workerId, { $inc: { 'wallet.balance': payout.amount } });
        }
    }

    // Update corresponding WalletTxn if available
    const mappedStatus = status === 'TRANSFERRED' ? 'COMPLETED' : (status === 'APPROVED' ? 'PENDING' : status);
    const entityId = payout.workerId || payout.shopId;
    
    // In Kwickly Shop logic, WalletTxn userId is the owner's userId, but for shop it might be different. 
    // Usually Shop Owner ID created it, so we fallback to finding by amount if walletTxnId is missing.
    let wTxn;
    if (payout.walletTxnId) {
        wTxn = await WalletTxn.findByIdAndUpdate(payout.walletTxnId, { status: mappedStatus }, { new: true });
    } else {
        // Fallback for existing payouts
        wTxn = await WalletTxn.findOneAndUpdate({
            amount: payout.amount,
            status: { $in: ['PENDING', 'APPROVED'] },
            type: 'WITHDRAWAL',
            ...(payout.workerId ? { userId: payout.workerId } : {})
        }, { status: mappedStatus }, { new: true });
    }

    // Send Notification
    let title = 'Withdrawal Request Updated';
    let message = `Your withdrawal request of ₹${payout.amount} has been ${status.toLowerCase()}.`;
    if (status === 'REJECTED') message += ` Reason: ${rejectReason}`;
    if (status === 'TRANSFERRED') message += ` Txn ID: ${txnId}`;

    const notification = await Notification.create({
        userId: wTxn ? wTxn.userId : entityId,
        title,
        message,
        type: 'DIRECT',
        action: 'WALLET_UPDATE',
        targetRole: payout.shopId ? 'SHOP' : 'WORKER'
    });

    try {
        const { emitToUser } = require('../../helpers/socket.helper');
        emitToUser(wTxn ? wTxn.userId.toString() : entityId.toString(), 'NEW_NOTIFICATION', notification);
    } catch (e) { /* io not ready */ }

    await delCache('admin_badge_counts');
    triggerDashboardUpdate();

    logAdminActivity('PAYOUT', 'PAYOUT', payout._id, `Payout ${status}`, `Payout of ₹${payout.amount} was ${status.toLowerCase()}`, req.user?._id);

    if (status === 'TRANSFERRED') {
        try {
            const { debitForPayout } = require('../adminWallet/adminWallet.controller');
            const recipientName = payout.shopId ? 'shop' : 'worker';
            await debitForPayout(
                payout.amount,
                `Payout transferred to ${recipientName} — Txn: ${txnId || 'N/A'}`,
                payout._id,
                'Payout',
                { workerId: payout.workerId, shopId: payout.shopId }
            );
        } catch (e) {
            console.error('Failed to debit admin wallet for payout:', e.message);
        }
    }

    return successResponse(res, payout, 'Payout status updated');
});

exports.addShopPayoutMethod = catchAsync(async (req, res) => {
    const { type, detail, details, isPrimary, label } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    if (shop.payoutMethods.length === 0) req.body.isPrimary = true;
    shop.payoutMethods.push({ type, detail: detail || details, isPrimary, label });
    await shop.save();
    logAdminActivity('UPDATE', 'SHOP', shop._id, 'Payout Method Added', `Added ${type} payout method to "${shop.name}"`, req.user?._id);
    await delCache('admin_badge_counts');
    triggerDashboardUpdate();
    return successResponse(res, shop.payoutMethods, 'Payout method added');
});

exports.deleteShopPayoutMethod = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    shop.payoutMethods = shop.payoutMethods.filter(m => String(m._id) !== String(req.params.methodId));
    await shop.save();
    logAdminActivity('UPDATE', 'SHOP', shop._id, 'Payout Method Deleted', `Deleted payout method from "${shop.name}"`, req.user?._id);
    await delCache('admin_badge_counts');
    triggerDashboardUpdate();
    return successResponse(res, shop.payoutMethods, 'Payout method deleted');
});

exports.editShopPayoutMethod = catchAsync(async (req, res) => {
    const { type, detail, details, isPrimary, label } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    const method = shop.payoutMethods.id(req.params.methodId);
    if (!method) return errorResponse(res, 'Payout method not found', StatusCodes.NOT_FOUND);
    if (type) method.type = type;
    if (detail || details) method.detail = detail || details;
    if (label !== undefined) method.label = label;
    if (isPrimary !== undefined) {
        if (isPrimary) {
            shop.payoutMethods.forEach(m => { m.isPrimary = String(m._id) === String(method._id); });
        } else {
            method.isPrimary = false;
        }
    }
    await shop.save();
    logAdminActivity('UPDATE', 'SHOP', shop._id, 'Payout Method Updated', `Updated payout method on "${shop.name}"`, req.user?._id);
    await delCache('admin_badge_counts');
    triggerDashboardUpdate();
    return successResponse(res, shop.payoutMethods, 'Payout method updated');
});

exports.setShopPrimaryPayout = catchAsync(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    shop.payoutMethods.forEach(m => { m.isPrimary = String(m._id) === String(req.params.methodId); });
    await shop.save();
    logAdminActivity('UPDATE', 'SHOP', shop._id, 'Primary Payout Updated', `Updated primary payout for "${shop.name}"`, req.user?._id);
    await delCache('admin_badge_counts');
    triggerDashboardUpdate();
    return successResponse(res, shop.payoutMethods, 'Primary payout updated');
});

exports.updateShopOwner = catchAsync(async (req, res) => {
    const { name, phone, email } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    const customer = await Customer.findById(shop.ownerId);
    if (!customer) return errorResponse(res, 'Owner not found', StatusCodes.NOT_FOUND);
    if (name) customer.name = name.trim();
    if (phone) customer.phone = phone.trim();
    if (email !== undefined) customer.email = email || undefined;
    await customer.save();
    const populated = await shop.populate('ownerId', 'name phone email');
    logAdminActivity('UPDATE', 'SHOP', shop._id, 'Owner Updated', `Updated owner details for "${shop.name}"`, req.user?._id);
    await delCache('admin_badge_counts');
    triggerDashboardUpdate();
    return successResponse(res, populated, 'Owner updated successfully');
});
