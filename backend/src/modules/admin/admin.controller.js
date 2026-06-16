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
const ShopOrder  = require('../shoporder/shoporder.model');
const Notification = require('../notification/notification.model');
const catchAsync = require('../../helpers/async.helper');
const { ADMIN, AUTH } = require('../../constants/messages');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate, getIO } = require('../../helpers/socket.helper');
const bcrypt = require('bcryptjs');

const logAdminActivity = async (action, entityType, entityId, title, message, adminId) => {
    try {
        const notification = await Notification.create({
            title,
            message,
            type: 'ADMIN_ACTIVITY',
            action,
            entityType,
            entityId,
            performedBy: adminId,
            targetRole: 'ADMIN'
        });
        try {
            const io = getIO();
            if (io) io.to('admin_dashboard').emit('NEW_NOTIFICATION', notification);
        } catch (_) {}
    } catch (e) { console.error('[logAdminActivity] Failed:', e.message); }
};

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
        .lean();
    return successResponse(res, workers, ADMIN.WORKERS_FETCHED);
});

exports.updateKYC = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const worker = await Customer.findById(id);
    if (!worker || worker.role !== 'WORKER') return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    worker.kyc.status = status;
    if (status === 'APPROVED') worker.isVerified = true;
    await worker.save();

    await delCache('admin_workers_list');
    await delCache('admin_dashboard_stats');
    await delCache('admin_badge_counts');
    await delCache(`session:${worker._id}`);
    triggerDashboardUpdate();

    logAdminActivity('KYC', 'KYC', id, `KYC ${status}`, `KYC for worker "${worker.name}" was ${status.toLowerCase()}`, req.user?._id);

    return successResponse(res, worker, ADMIN.KYC_UPDATED);
});

exports.createUser = catchAsync(async (req, res) => {
    const { name, phone, role, password, email, city, bio, profileImage, address, location } = req.body;

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

    const user = await Customer.create(userData);

    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('CREATE', 'CUSTOMER', user._id, 'Customer Created', `New customer "${name}" (${phone}) was added to the platform`, req.user?._id);

    return successResponse(res, user, 'User created successfully', StatusCodes.CREATED);
});

exports.updateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, city, bio, profileImage, address, location } = req.body;

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

    await user.save();

    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    const changes = [name && 'name', phone && 'phone', email !== undefined && 'email', city && 'city', bio !== undefined && 'bio', profileImage !== undefined && 'image', address && 'address', location && 'location'].filter(Boolean).join(', ');
    logAdminActivity('UPDATE', 'CUSTOMER', user._id, 'Customer Updated', `Customer "${user.name}" was updated${changes ? ' (' + changes + ')' : ''}`, req.user?._id);

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

    return successResponse(res, user, ADMIN.USER_UPDATED);
});

exports.deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findByIdAndDelete(id);
    if (!user) return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);

    await delCache(`session:${id}`);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('DELETE', 'CUSTOMER', id, 'Customer Deleted', `Customer "${user.name}" (${user.phone}) was permanently deleted`, req.user?._id);

    return successResponse(res, null, ADMIN.USER_DELETED);
});

exports.impersonateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findById(id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
        { _id: user._id, role: user.role, isImpersonated: true },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '1h' }
    );

    return successResponse(res, { token, user: { name: user.name, role: user.role } }, 'Impersonation token generated');

    logAdminActivity('IMPERSONATE', 'CUSTOMER', user._id, 'Admin Impersonation', `Admin impersonated user "${user.name}" (${user.phone})`, req.user?._id);
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

    const shop = await Shop.findByIdAndUpdate(
        id,
        { 'kyc.status': status },
        { new: true }
    );
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    await delCache('admin_badge_counts');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity('KYC', 'SHOP', shop._id, `Shop KYC ${status}`, `KYC for shop "${shop.name}" was ${status.toLowerCase()}`, req.user?._id);

    return successResponse(res, shop, 'Shop KYC updated');
});

exports.toggleShopStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const shop = await Shop.findById(id);
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);

    shop.isOnline = !shop.isOnline;
    await shop.save();

    const statusText = shop.isOnline ? 'enabled' : 'disabled';
    logAdminActivity('TOGGLE_STATUS', 'SHOP', shop._id, `Shop ${statusText}`, `Shop "${shop.name}" was ${statusText}`, req.user?._id);

    return successResponse(res, shop, `Shop ${shop.isOnline ? 'enabled' : 'disabled'}`);
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

    const recentJobs = await Job.find({ customerId: user._id })
        .populate('workerId', 'name phone')
        .sort('-createdAt')
        .limit(10)
        .lean();

    return successResponse(res, { user, jobStats, recentJobs }, 'User detail fetched');
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
const toCsv = (rows, headers) => {
    if (!rows.length) return '';
    const headerLine = headers.join(',');
    const lines = rows.map(row => headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','));
    return [headerLine, ...lines].join('\n');
};

exports.exportCustomers = catchAsync(async (req, res) => {
    const customers = await Customer.find({ role: 'CUSTOMER' }).select('-password').lean();
    const csv = toCsv(customers, ['_id', 'name', 'phone', 'email', 'isVerified', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.send(csv);
});

exports.exportWorkers = catchAsync(async (req, res) => {
    const workers = await Customer.find({ role: 'WORKER' }).select('-password').lean();
    const csv = toCsv(workers, ['_id', 'name', 'phone', 'email', 'city', 'isVerified', 'kyc.status', 'wallet.balance', 'rating.average', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=workers.csv');
    res.send(csv);
});

exports.exportJobs = catchAsync(async (req, res) => {
    const jobs = await Job.find().populate('customerId', 'name phone').populate('workerId', 'name phone').lean();
    const rows = jobs.map(j => ({
        _id: j._id,
        customer: j.customerId?.name || '',
        worker: j.workerId?.name || '',
        category: j.category,
        status: j.status,
        amount: j.payment?.amount || 0,
        platformFee: j.payment?.platformFee || 0,
        createdAt: j.createdAt
    }));
    const csv = toCsv(rows, ['_id', 'customer', 'worker', 'category', 'status', 'amount', 'platformFee', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=jobs.csv');
    res.send(csv);
});

exports.exportPayments = catchAsync(async (req, res) => {
    const txns = await WalletTxn.find().populate('userId', 'name phone role').sort('-createdAt').lean();
    const rows = txns.map(t => ({
        _id: t._id,
        user: t.userId?.name || '',
        phone: t.userId?.phone || '',
        role: t.userId?.role || '',
        type: t.type,
        amount: t.amount,
        status: t.status,
        description: t.description || '',
        createdAt: t.createdAt
    }));
    const csv = toCsv(rows, ['_id', 'user', 'phone', 'role', 'type', 'amount', 'status', 'description', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    res.send(csv);
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
    const mappedStatus = status === 'APPROVED' || status === 'TRANSFERRED' ? 'COMPLETED' : status;
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
            status: 'PENDING',
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
        targetRole: payout.shopId ? 'SHOP' : 'WORKER'
    });

    try {
        const { emitToUser } = require('../../helpers/socket.helper');
        emitToUser(wTxn ? wTxn.userId.toString() : entityId.toString(), 'NEW_NOTIFICATION', notification);
    } catch (e) { /* io not ready */ }

    await delCache('admin_badge_counts');
    triggerDashboardUpdate();

    logAdminActivity('PAYOUT', 'PAYOUT', payout._id, `Payout ${status}`, `Payout of ₹${payout.amount} was ${status.toLowerCase()}`, req.user?._id);

    return successResponse(res, payout, 'Payout status updated');
});
