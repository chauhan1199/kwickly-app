const { StatusCodes } = require('http-status-codes');
const Job = require('./job.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll } = require('../../helpers/socket.helper');
const { setCache, getCache, delCache } = require('../../helpers/redis.helper');

exports.createJob = catchAsync(async (req, res) => {
    const { category, subcategory, description, media, preferredDate, timeSlot, location, addressDetails } = req.body;
    
    // Create the job in BROADCASTING status
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
        status: 'BROADCASTING'
    });

    // Find eligible workers: 
    // Optimization: Cache this query in Redis for 5 minutes since active worker list changes frequently but caching helps bursts
    let eligibleWorkers = await getCache('eligible_workers_pool');
    
    if (!eligibleWorkers) {
        eligibleWorkers = await Customer.find({
            role: 'WORKER',
            isVerified: true,
            'kyc.status': 'APPROVED',
            'wallet.balance': { $gte: 100 }
        }).select('_id'); // only select ID to reduce payload
        
        await setCache('eligible_workers_pool', eligibleWorkers, 300); // Cache for 5 mins
    }

    // Broadcast via Socket.io
    emitToAll('NEW_JOB_ALERT', {
        jobId: job._id,
        category: job.category,
        subcategory: job.subcategory,
        description: job.description,
        location: job.location,
        workerCount: eligibleWorkers.length,
        timeSlot: job.timeSlot,
        preferredDate: job.preferredDate
    });

    await delCache('admin_dashboard_stats');
    emitToAll('DASHBOARD_UPDATE', { type: 'NEW_JOB', id: job._id });

    return successResponse(res, job, 'Job created and broadcasted to eligible workers');
});

exports.getJobs = catchAsync(async (req, res) => {
    const { status, limit = 50, page = 1 } = req.query;
    const query = {};
    if (status && status !== 'all') {
        query.status = status.toUpperCase();
    }

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    return successResponse(res, {
        jobs,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        totalJobs: total
    }, 'Jobs fetched successfully');
});

exports.getDisputes = catchAsync(async (req, res) => {
    // In a real app, disputes might be a separate model or a sub-status.
    // For this implementation, we'll assume any job with a payment status 'REFUNDED' or specific flag is a dispute.
    // However, the admin panel expects a specific 'disputes' list.
    // Let's assume for now disputes are jobs with status 'CANCELLED' but with specific notes (mocking for now).
    const disputes = await Job.find({ status: 'CANCELLED' })
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-updatedAt');
    
    return successResponse(res, disputes, 'Disputes fetched successfully');
});

exports.cancelJob = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    job.status = 'CANCELLED';
    await job.save();

    // Invalidate dashboard stats cache and emit update
    await delCache('admin_dashboard_stats');
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_CANCELLED', id: job._id });

    return successResponse(res, job, 'Job cancelled successfully');
});

exports.reassignWorker = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { workerId } = req.body;
    
    const job = await Job.findById(id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    job.workerId = workerId;
    job.status = 'ACCEPTED'; // Or stay as current
    await job.save();

    emitToAll('DASHBOARD_UPDATE', { type: 'WORKER_REASSIGNED', id: job._id });

    return successResponse(res, job, 'Worker reassigned successfully');
});

exports.getMyJobs = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { customerId: req.user._id };
    if (status) query.status = status.toUpperCase();

    const jobs = await Job.find(query)
        .populate('workerId', 'name phone profileImage')
        .sort('-createdAt');

    return successResponse(res, jobs, 'My jobs fetched successfully');
});

exports.getAvailableJobs = catchAsync(async (req, res) => {
    // Enforce KYC and Wallet constraints
    const worker = await Customer.findById(req.user._id);
    if (!worker || worker.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'KYC must be approved to view jobs', StatusCodes.FORBIDDEN);
    }
    if (!worker.isOnline) {
        return errorResponse(res, 'You must be online to view available jobs', StatusCodes.FORBIDDEN);
    }
    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    const minBalance = settings?.wallet?.minimumBalance || 100;
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(res, `Minimum wallet balance of Rs ${minBalance} required to view jobs`, StatusCodes.PAYMENT_REQUIRED);
    }

    const activeCategoryIds = (worker.services || [])
        .filter(s => s.isActive)
        .map(s => s.category);

    const jobs = await Job.find({ 
        status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] },
        category: { $in: activeCategoryIds }
    })
        .populate('customerId', 'name phone')
        .sort('-createdAt');

    return successResponse(res, jobs, 'Available jobs fetched successfully');
});

exports.getWorkerJobs = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { workerId: req.user._id };
    if (status) query.status = status.toUpperCase();

    const jobs = await Job.find(query)
        .populate('customerId', 'name phone location')
        .sort('-createdAt');

    return successResponse(res, jobs, 'Worker jobs fetched successfully');
});

exports.startJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { arrivalOtp } = req.body;
    
    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    if (job.status !== 'ALLOCATED' && job.status !== 'ARRIVING') {
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

exports.completeJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { media, report } = req.body;
    
    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);

    job.status = 'COMPLETED';
    job.completionDetails = {
        media: media || [],
        report: report || '',
        completedAt: new Date()
    };
    await job.save();

    emitToRoom(`customer_${job.customerId}`, 'JOB_COMPLETED', { jobId: job._id });
    return successResponse(res, job, 'Job completed successfully, pending payment');
});

exports.payJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { method } = req.body; // e.g. 'ONLINE' or 'CASH'
    
    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    
    if (job.status !== 'COMPLETED') {
        return errorResponse(res, 'Job is not completed yet', StatusCodes.BAD_REQUEST);
    }

    // Platform fee calculation
    const AppSettings = require('../settings/settings.model');
    const settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    const feeConfig = settings?.fees || { fixedThreshold: 500, fixedAmount: 50, percentage: 10 };
    
    const jobAmount = job.payment?.amount || 0;
    let platformFee = 0;
    
    if (jobAmount <= feeConfig.fixedThreshold) {
        platformFee = feeConfig.fixedAmount;
    } else {
        platformFee = (jobAmount * feeConfig.percentage) / 100;
    }
    
    const workerPayout = jobAmount - platformFee;
    
    job.status = 'PAID';
    job.payment.status = 'PAID';
    job.payment.platformFee = platformFee;
    job.payment.workerPayout = workerPayout;
    
    await job.save();
    
    // Deduct platform fee from Worker's wallet (assuming Customer paid Worker directly, either online or cash)
    // If online, Kwickly collects the full amount and adds `workerPayout` to worker wallet.
    // If cash, Customer paid Worker the full amount. Kwickly deducts `platformFee` from worker wallet.
    // Assuming CASH for simplicity of MVP based on user request (worker gets service charge, platform fee to admin).
    
    const worker = await Customer.findById(job.workerId);
    if (worker) {
        worker.wallet.balance -= platformFee; // Deduct Kwickly's cut from their pre-paid wallet balance
        await worker.save();
    }
    
    // Log transaction for worker (fee deduction)
    const WalletTxn = require('../wallet/wallet.model');
    await WalletTxn.create({
        userId: worker._id,
        type: 'JOB_DEBIT',
        amount: platformFee,
        balance: worker.wallet.balance,
        refId: job._id.toString(),
        description: `Platform fee deduction for Job ${job._id}`
    });

    emitToRoom(`worker_${job.workerId}`, 'JOB_PAID', { jobId: job._id });
    return successResponse(res, job, 'Payment completed successfully');
});

exports.rateJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { score, review } = req.body;
    
    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);
    
    if (job.status !== 'COMPLETED') {
        return errorResponse(res, 'Only completed jobs can be rated', StatusCodes.BAD_REQUEST);
    }

    job.rating = {
        score,
        review,
        createdAt: new Date()
    };
    await job.save();

    // Update worker's average rating
    if (job.workerId) {
        const worker = await Customer.findById(job.workerId);
        if (worker) {
            const currentTotal = worker.rating.average * worker.rating.count;
            worker.rating.count += 1;
            worker.rating.average = (currentTotal + score) / worker.rating.count;
            await worker.save();
        }
    }

    return successResponse(res, job, 'Job rated successfully');
});
