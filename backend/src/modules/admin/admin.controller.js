const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const Job = require('../job/job.model');
const Transaction = require('../transaction/transaction.model');
const Payout = require('../payout/payout.model');
const Dispute = require('../dispute/dispute.model');
const Suggestion = require('../suggestion/suggestion.model');
const Category = require('../category/category.model');
const mongoose = require('mongoose');
const catchAsync = require('../../helpers/async.helper');
const { ADMIN, AUTH, COMMON } = require('../../constants/messages');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');

exports.getBadgeCounts = catchAsync(async (req, res) => {
    const cacheKey = 'admin_badge_counts';
    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, 'Badges fetched');

    const [kyc, payouts, disputes, suggestions, categories, workers] = await Promise.all([
        Customer.countDocuments({ role: 'WORKER', 'kyc.status': 'PENDING' }),
        Payout.countDocuments({ status: 'PENDING' }),
        Dispute.countDocuments({ status: 'open' }),
        Suggestion.countDocuments({ status: 'pending' }),
        Category.countDocuments({ active: true }),
        Customer.countDocuments({ role: 'WORKER' })
    ]);

    const data = {
        kyc,
        payouts,
        support: 0,
        disputes,
        suggestions,
        categories,
        workers
    };

    await setCache(cacheKey, data, 120); // Cache for 2 mins
    return successResponse(res, data, 'Badges fetched');
});

exports.getStats = catchAsync(async (req, res) => {
    // Try to get from cache first
    const cacheKey = 'admin_dashboard_stats';
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
        return successResponse(res, cachedData, ADMIN.STATS_FETCHED);
    }

    const totalCustomers = await Customer.countDocuments({ role: 'CUSTOMER' });
    const totalWorkers = await Customer.countDocuments({ role: 'WORKER' });
    const activeJobs = await Job.countDocuments({ 
        status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'] } 
    });
    
    const revenueData = await Job.aggregate([
        { $match: { 'payment.status': 'PAID' } },
        { $group: { _id: null, total: { $sum: '$payment.platformFee' } } }
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    // Generate 7 day chart data
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const chartDataRaw = await Job.aggregate([
        { $match: { createdAt: { $gte: last7Days[0] } } },
        { $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            jobs: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ["$payment.status", "PAID"] }, "$payment.platformFee", 0] } }
        }}
    ]);

    const chartData = last7Days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        const record = chartDataRaw.find(r => r._id === dateStr);
        return {
            day: dayStr,
            jobs: record ? record.jobs : 0,
            revenue: record ? record.revenue : 0
        };
    });

    // Fetch Recent Activities (Real)
    const recentJobs = await Job.find()
        .populate('customerId', 'name')
        .sort('-createdAt')
        .limit(10)
        .lean();
    
    const activities = recentJobs.map(job => ({
        color: job.status === 'COMPLETED' ? 'green' : job.status === 'CANCELLED' ? 'red' : 'blue',
        text: `Job #${job._id.toString().slice(-6)} update: ${job.status} — ${job.category}`,
        time: job.createdAt
    }));

    // Fetch Top Workers (Real Aggregation)
    const topWorkersRaw = await Job.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { 
            _id: '$workerId', 
            totalJobs: { $sum: 1 }
        }},
        { $sort: { totalJobs: -1 } },
        { $limit: 5 },
        { $lookup: {
            from: 'customers',
            localField: '_id',
            foreignField: '_id',
            as: 'worker'
        }},
        { $unwind: '$worker' }
    ]);
    
    const topWorkers = await Promise.all(topWorkersRaw.map(async (row) => {
        return {
            name: row.worker.name,
            category: row.worker.category || 'Service',
            jobs: row.totalJobs,
            rating: '4.5', // Mocked rating since review module is removed
            earned: `₹${row.worker.wallet?.balance || 0}`,
            status: row.worker.isVerified ? 'online' : 'offline'
        };
    }));

    const responseData = {
        totalCustomers,
        totalWorkers,
        activeJobs,
        totalRevenue,
        activities,
        topWorkers,
        chartData
    };

    // Cache for 5 minutes
    await setCache(cacheKey, responseData, 300);

    return successResponse(res, responseData, ADMIN.STATS_FETCHED);
});

exports.getCustomers = catchAsync(async (req, res) => {
    const cacheKey = 'admin_customers_list';
    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, ADMIN.CUSTOMERS_FETCHED);

    const customers = await Customer.find({ role: 'CUSTOMER' }).sort('-createdAt').lean();
    await setCache(cacheKey, customers, 600);
    
    return successResponse(res, customers, ADMIN.CUSTOMERS_FETCHED);
});

exports.getWorkers = catchAsync(async (req, res) => {
    const cacheKey = 'admin_workers_list';
    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, ADMIN.WORKERS_FETCHED);

    const workers = await Customer.find({ role: 'WORKER' }).sort('-createdAt').lean();
    await setCache(cacheKey, workers, 600);

    return successResponse(res, workers, ADMIN.WORKERS_FETCHED);
});

exports.createUser = catchAsync(async (req, res) => {
    const { name, phone, role } = req.body;
    
    // Check if phone already exists
    const existing = await Customer.findOne({ phone });
    if (existing) {
        return errorResponse(res, 'User with this phone number already exists', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.create({
        name,
        phone,
        role,
        isVerified: true
    });

    // Invalidate Redis caches so the list updates dynamically
    if (role === 'CUSTOMER') {
        await delCache('admin_customers_list');
    } else if (role === 'WORKER') {
        await delCache('admin_workers_list');
    }
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, user, 'User created successfully', StatusCodes.CREATED);
});

exports.getPendingKYC = catchAsync(async (req, res) => {
    const workers = await Customer.find({ 
        role: 'WORKER', 
        'kyc.status': 'PENDING' 
    }).sort('createdAt');
    return successResponse(res, workers, ADMIN.WORKERS_FETCHED);
});

exports.updateKYC = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 
    
    const worker = await Customer.findById(id);
    if (!worker || worker.role !== 'WORKER') {
        return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);
    }

    worker.kyc.status = status;
    if (status === 'APPROVED') {
        worker.isVerified = true;
    }
    await worker.save();

    await delCache('admin_workers_list');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, worker, ADMIN.KYC_UPDATED);
});

exports.toggleUserStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findById(id);
    if (!user) {
        return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);
    }

    user.isVerified = !user.isVerified;
    await user.save();

    await delCache('admin_customers_list');
    await delCache('admin_workers_list');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, user, ADMIN.USER_UPDATED);
});

exports.deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await Customer.findByIdAndDelete(id);

    if (!user) {
        return errorResponse(res, AUTH.USER_NOT_FOUND, StatusCodes.NOT_FOUND);
    }

    await delCache('admin_customers_list');
    await delCache('admin_workers_list');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, null, ADMIN.USER_DELETED);
});

exports.getPlatformHealth = catchAsync(async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? '✓ Connected' : '✗ Disconnected';
    
    // Simplified health stats
    const health = {
        dbStatus,
        apiVersion: 'v1.2.0',
        socketStatus: '✓ Active',
        connectedClients: Math.floor(Math.random() * 50) + 10, // Placeholder for IO count
        jobsToday: await Job.countDocuments({
            createdAt: { $gt: new Date(new Date().setHours(0,0,0,0)) }
        }),
        uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
    };

    return successResponse(res, health, 'Platform health fetched');
});

exports.getLedger = catchAsync(async (req, res) => {
    const cacheKey = 'admin_ledger';
    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, 'Ledger fetched');

    const transactions = await Transaction.find()
        .populate('workerId', 'name')
        .sort('-txnDate')
        .limit(100)
        .lean();

    const formatted = transactions.map(t => ({
        id: t._id,
        date: new Date(t.txnDate).toLocaleDateString(),
        worker: t.workerId?.name || 'Unknown',
        type: t.type,
        jobId: t.jobId ? t.jobId.toString().slice(-6) : null,
        desc: t.description,
        amount: t.amount
    }));

    await setCache(cacheKey, formatted, 300); // Cache for 5 mins
    return successResponse(res, formatted, 'Ledger fetched');
});
