const { StatusCodes } = require('http-status-codes');
const Job = require('./job.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll, emitToRoom } = require('../../helpers/socket.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');

// ─── POST /api/v1/jobs ────────────────────────────────────────────────────────
exports.createJob = catchAsync(async (req, res) => {
    const { category, subcategory, description, media, preferredDate, timeSlot, location, addressDetails } = req.body;

    const job = await Job.create({
        customerId: req.user._id,
        category,
        subcategory,
        description,
        media,
        preferredDate,
        timeSlot,
        location,
        addressDetails,
        status: 'BROADCASTING',
        payment: { amount: 0, status: 'PENDING' }
    });

    // P1 FIX: Geospatial worker filtering — only notify workers near the job location
    // Get settings for radius from cache or DB
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const radiusKm = settings?.radius?.maxKm || 15;
    const radiusRadians = radiusKm / 6371;

    // Find eligible workers within geospatial radius with an active subscription
    const now = new Date();
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
                $centerSphere: [location.coordinates, radiusRadians]
            }
        }
    }).select('_id').lean();

    const customer = await Customer.findById(req.user._id).select('name phone profileImage').lean();

    // Broadcast to all connected sockets; workers filter by their own eligibility
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
        customerId: {
            _id: customer._id,
            name: customer.name,
            phone: customer.phone,
            profileImage: customer.profileImage
        }
    });

    await delCache('admin_dashboard_stats');
    await delCache('admin_badge_counts');
    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_JOB', id: job._id });

    return successResponse(res, job, 'Job created and broadcasted to eligible workers', StatusCodes.CREATED);
});

// ─── GET /api/v1/jobs (Admin) ─────────────────────────────────────────────────
exports.getJobs = catchAsync(async (req, res) => {
    const { status, limit = 20, page = 1 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { jobs, totalPages: Math.ceil(total / limit), currentPage: Number(page), totalJobs: total }, 'Jobs fetched');
});

// ─── GET /api/v1/jobs/my (Customer) ──────────────────────────────────────────
exports.getMyJobs = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { customerId: req.user._id };
    if (status) query.status = status.toUpperCase();

    const jobs = await Job.find(query)
        .populate('workerId', 'name phone profileImage rating')
        .sort('-createdAt')
        .lean();

    return successResponse(res, jobs, 'My jobs fetched successfully');
});

// ─── GET /api/v1/jobs/available (Worker) ─────────────────────────────────────
exports.getAvailableJobs = catchAsync(async (req, res) => {
    const worker = await Customer.findById(req.user._id)
        .populate('services.category', 'name')
        .lean();

    if (!worker || worker.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'KYC must be approved to view jobs', StatusCodes.FORBIDDEN);
    }
    if (!worker.isOnline) {
        return errorResponse(res, 'You must be online to view available jobs', StatusCodes.FORBIDDEN);
    }

    const now = new Date();
    const isSubscriptionValid = worker.subscription?.isTrial || (worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > now);
    if (!isSubscriptionValid) {
        return errorResponse(res, 'Subscription has expired. Please renew to view jobs.', StatusCodes.PAYMENT_REQUIRED);
    }

    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const minBalance = settings?.wallet?.minimumBalance || 100;
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(res, `Minimum wallet balance of ₹${minBalance} required to view jobs`, StatusCodes.PAYMENT_REQUIRED);
    }

    const activeCategoryNames = (worker.services || [])
        .filter(s => s.isActive && s.category)
        .map(s => s.category.name);

    const Quote = require('../quote/quote.model');
    const quotedJobIds = await Quote.distinct('jobId', { workerId: req.user._id });

    const categoryFilter = activeCategoryNames.length > 0
        ? { category: { $in: activeCategoryNames } }
        : {};

    const jobs = await Job.find({
        status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] },
        _id: { $nin: quotedJobIds }, // Exclude jobs already quoted on
        ...categoryFilter
    })
        .populate('customerId', 'name phone')
        .sort('-createdAt')
        .limit(50)
        .lean();

    return successResponse(res, jobs, 'Available jobs fetched');
});

// ─── GET /api/v1/jobs/worker (Worker's own jobs) ──────────────────────────────
exports.getWorkerJobs = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { workerId: req.user._id };
    if (status) query.status = status.toUpperCase();

    const jobs = await Job.find(query)
        .populate('customerId', 'name phone location')
        .sort('-createdAt')
        .lean();

    return successResponse(res, jobs, 'Worker jobs fetched');
});

// ─── PATCH /api/v1/jobs/:id/start ─────────────────────────────────────────────
exports.startJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { arrivalOtp } = req.body;

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (!['ALLOCATED', 'ARRIVING'].includes(job.status)) {
        return errorResponse(res, 'Job cannot be started in this status', StatusCodes.BAD_REQUEST);
    }
    if (job.security?.arrivalOtp && job.security.arrivalOtp !== arrivalOtp) {
        return errorResponse(res, 'Invalid Arrival OTP', StatusCodes.BAD_REQUEST);
    }

    job.status = 'IN_PROGRESS';
    await job.save();

    emitToRoom(`customer_${job.customerId}`, 'JOB_STARTED', { jobId: job._id });
    return successResponse(res, job, 'Job started successfully');
});

// ─── PATCH /api/v1/jobs/:id/complete ─────────────────────────────────────────
exports.completeJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { media, report } = req.body;

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);
    if (job.status !== 'IN_PROGRESS') {
        return errorResponse(res, 'Only in-progress jobs can be completed', StatusCodes.BAD_REQUEST);
    }

    job.status = 'COMPLETED';
    job.completionDetails = { media: media || [], report: report || '', completedAt: new Date() };
    await job.save();

    emitToRoom(`customer_${job.customerId}`, 'JOB_COMPLETED', { jobId: job._id });
    return successResponse(res, job, 'Job completed successfully');
});

// ─── PATCH /api/v1/jobs/:id/pay ───────────────────────────────────────────────
exports.payJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { method, completionOtp } = req.body;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Job is not completed yet', StatusCodes.BAD_REQUEST);
    if (job.security?.completionOtp && job.security.completionOtp !== completionOtp) {
        return errorResponse(res, 'Invalid Completion OTP', StatusCodes.BAD_REQUEST);
    }

    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const feeConfig = settings?.fees || { fixedThreshold: 500, fixedAmount: 50, percentage: 10 };
    const jobAmount = job.payment?.amount || 0;
    const platformFee = jobAmount <= (feeConfig.fixedThreshold || 500)
        ? (feeConfig.fixedAmount || 50)
        : (jobAmount * (feeConfig.percentage || 10)) / 100;
    const workerPayout = jobAmount - platformFee;

    const mongoose = require('mongoose');
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();
    try {
        const WalletTxn = require('../wallet/wallet.model');
        const worker = await Customer.findById(job.workerId).session(session);

        if (worker) {
            if (method === 'CASH') {
                // Worker got cash — Kwickly deducts commission from worker wallet
                const updated = await Customer.findOneAndUpdate(
                    { _id: worker._id, 'wallet.balance': { $gte: platformFee } },
                    { $inc: { 'wallet.balance': -platformFee } },
                    { new: true, session }
                );
                if (!updated) {
                    // If worker doesn't have enough, create a debt record
                    const debtUpdated = await Customer.findByIdAndUpdate(worker._id, { $inc: { 'wallet.balance': -platformFee } }, { new: true, session });
                    await WalletTxn.create([{
                        userId: worker._id, type: 'JOB_DEBIT', amount: platformFee,
                        balance: debtUpdated?.wallet?.balance || 0,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: `Platform fee for cash job #${job._id.toString().slice(-6)}`
                    }], { session });
                } else {
                    await WalletTxn.create([{
                        userId: worker._id, type: 'JOB_DEBIT', amount: platformFee,
                        balance: updated.wallet.balance,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: `Platform fee for cash job #${job._id.toString().slice(-6)}`
                    }], { session });
                }
            } else {
                const creditedWorker = await Customer.findByIdAndUpdate(worker._id, { $inc: { 'wallet.balance': workerPayout } }, { new: true, session });
                await WalletTxn.create([{
                    userId: worker._id, type: 'JOB_CREDIT', amount: workerPayout,
                    balance: creditedWorker?.wallet?.balance || 0,
                    refId: job._id.toString(), status: 'COMPLETED',
                    description: `Earnings for online job #${job._id.toString().slice(-6)}`
                }], { session });
            }
        }

        job.status = 'PAID';
        job.payment.status = 'PAID';
        job.payment.platformFee = platformFee;
        job.payment.workerPayout = workerPayout;
        await job.save({ session });

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        try {
            const { collectPlatformFee } = require('../adminWallet/adminWallet.controller');
            await collectPlatformFee(
                platformFee,
                `Platform fee from job #${job._id.toString().slice(-6)} (${method})`,
                job._id,
                'Job',
                { workerId: job.workerId, customerId: job.customerId, method }
            );
        } catch (e) {
            console.error('Failed to credit admin wallet for platform fee:', e.message);
        }

        await delCache(`session:${job.workerId}`);
        emitToRoom(`worker_${job.workerId}`, 'JOB_PAID', { jobId: job._id });
        return successResponse(res, job, 'Payment completed successfully');
    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// ─── POST /api/v1/jobs/:id/rate ───────────────────────────────────────────────
exports.rateJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { score, review } = req.body;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);
    if (!['COMPLETED', 'PAID'].includes(job.status)) {
        return errorResponse(res, 'Only completed jobs can be rated', StatusCodes.BAD_REQUEST);
    }
    if (job.rating?.score) {
        return errorResponse(res, 'Job has already been rated', StatusCodes.CONFLICT);
    }

    job.rating = { score, review, createdAt: new Date() };
    await job.save();

    if (job.workerId) {
        const worker = await Customer.findById(job.workerId);
        if (worker) {
            const total = worker.rating.average * worker.rating.count;
            worker.rating.count += 1;
            worker.rating.average = parseFloat(((total + score) / worker.rating.count).toFixed(2));
            await worker.save();
            await delCache(`session:${job.workerId}`);
        }
    }

    return successResponse(res, job, 'Job rated successfully');
});

// ─── DELETE /api/v1/jobs/:id (Admin cancel) ───────────────────────────────────
exports.cancelJob = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    job.status = 'CANCELLED';
    await job.save();

    await delCache('admin_dashboard_stats');
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_CANCELLED', id: job._id });

    return successResponse(res, job, 'Job cancelled successfully');
});

// ─── PATCH /api/v1/jobs/:id/reassign (Admin) ─────────────────────────────────
exports.reassignWorker = catchAsync(async (req, res) => {
    const { workerId } = req.body;
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    job.workerId = workerId;
    job.status = 'ALLOCATED';
    await job.save();

    emitToAll('DASHBOARD_UPDATE', { type: 'WORKER_REASSIGNED', id: job._id });
    return successResponse(res, job, 'Worker reassigned successfully');
});

// ─── GET /api/v1/jobs/disputes (Admin) ───────────────────────────────────────
exports.getDisputes = catchAsync(async (req, res) => {
    const disputes = await Job.find({ status: 'CANCELLED' })
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-updatedAt')
        .lean();

    return successResponse(res, disputes, 'Disputes fetched');
});
