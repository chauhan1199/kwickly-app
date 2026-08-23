const { StatusCodes } = require('http-status-codes');
const Quote       = require('./quote.model');
const Job         = require('../job/job.model');
const Customer    = require('../customer/customer.model');
const catchAsync  = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { getCache, setCache } = require('../../helpers/redis.helper');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const { haversineDistance, calculateETA } = require('../../helpers/geo.helper');
const { OTP_MIN, OTP_MAX } = require('../../constants/business');

/**
 * POST /api/v1/quotes
 * Worker places a quote on a job
 */
exports.placeQuote = catchAsync(async (req, res) => {
    const { jobId, amount, description, timeToReach, workerLocation } = req.body;
    const workerId = req.user._id;

    if (!amount || amount < 10) {
        return errorResponse(res, 'Quote amount must be at least ₹10', StatusCodes.BAD_REQUEST);
    }

    const worker = await Customer.findById(workerId).lean();

    // Guard: KYC check
    if (!worker || worker.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'KYC must be approved before you can place quotes.', StatusCodes.FORBIDDEN);
    }

    // Guard: Subscription check (matches getAvailableJobs fallback trial logic)
    const now = new Date();
    const isTrialActive = worker.subscription?.isTrial === true &&
        worker.subscription?.trialEndDate &&
        new Date(worker.subscription.trialEndDate) > now;
    const isPaidSubActive = worker.subscription?.expiryDate &&
        new Date(worker.subscription.expiryDate) > now;

    // Fallback: Use freeTrialDays from registration
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const freeTrialDays = Number(settings?.subscription?.freeTrialDays || 30);
    const isFallbackTrialActive = worker.createdAt && new Date(worker.createdAt).getTime() + freeTrialDays * 24 * 60 * 60 * 1000 > now.getTime();

    const isSubscriptionValid = isTrialActive || isPaidSubActive || isFallbackTrialActive;
    if (!isSubscriptionValid) {
        return errorResponse(res, 'Subscription expired. Please renew your subscription to place quotes.', StatusCodes.PAYMENT_REQUIRED);
    }

    // Guard: Minimum wallet balance (from admin settings)
    const minBalance = Number(settings?.wallet?.minimumBalance !== undefined ? settings.wallet.minimumBalance : 100);
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(res, `Minimum wallet balance of ₹${minBalance} required to quote.`, StatusCodes.PAYMENT_REQUIRED);
    }

    const job = await Job.findById(jobId);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    // P0 FIX: Self-quote guard â€” worker cannot quote on a job they created
    if (String(job.customerId) === String(workerId)) {
        return errorResponse(res, 'You cannot quote on your own job', StatusCodes.FORBIDDEN);
    }

    if (!['BROADCASTING', 'QUOTES_RECEIVED'].includes(job.status)) {
        return errorResponse(res, 'Job is not accepting quotes', StatusCodes.BAD_REQUEST);
    }

    // Guard: Prevent duplicate quotes
    const existing = await Quote.findOne({ jobId, workerId, status: { $in: ['PENDING', 'ACCEPTED'] } });
    if (existing) return errorResponse(res, 'You already placed a quote on this job', StatusCodes.CONFLICT);

    // Calculate ETA via Haversine
    let calculatedTimeToReach = timeToReach || '20 mins';
    const jobLat = job.location?.coordinates?.[1];
    const jobLon = job.location?.coordinates?.[0];
    const workerLat = workerLocation?.coordinates?.[1] || worker.activeLocation?.coordinates?.[1];
    const workerLon = workerLocation?.coordinates?.[0] || worker.activeLocation?.coordinates?.[0];

    if (jobLat && jobLon && workerLat && workerLon) {
        const distanceKm = +haversineDistance([jobLon, jobLat], [workerLon, workerLat]).toFixed(2);
        const estMins = calculateETA(distanceKm);
        calculatedTimeToReach = `${estMins} mins`;
    }

    const quote = await Quote.create({
        jobId,
        workerId,
        amount,
        description,
        timeToReach: calculatedTimeToReach,
        workerLocation
    });

    // Update job status (only if still broadcasting)
    if (job.status === 'BROADCASTING') {
        job.status = 'QUOTES_RECEIVED';
        await job.save();
    }

    // Notify customer in real-time
    emitToRoom(`customer_${job.customerId}`, 'NEW_QUOTE', {
        jobId:      job._id,
        quoteId:    quote._id,
        workerId: {
            _id:         worker._id,
            name:        worker.name,
            profileImage:worker.profileImage,
            rating:      worker.rating,
            kyc:         { status: worker.kyc?.status },
            activeLocation: worker.activeLocation
        },
        amount,
        description,
        timeToReach: calculatedTimeToReach
    });

    // Notify customer: new quote received
    notifyUser({
        userId: job.customerId,
        title: 'ðŸ’° New Quote Received',
        message: `A worker has quoted \u20b9${amount} for your ${job.category} job. Tap to view all quotes!`,
        action: 'QUOTE_RECEIVED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, quote, 'Quote placed successfully', StatusCodes.CREATED);
});


/**
 * GET /api/v1/quotes/job/:jobId
 * Customer lists all quotes for their job
 */
exports.getQuotesForJob = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.jobId);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    // Security: Only the job's customer can view quotes
    if (String(job.customerId) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    let quotes = await Quote.find({ jobId: req.params.jobId, status: { $in: ['PENDING', 'ACCEPTED'] } })
        .populate('workerId', 'name profileImage rating wallet kyc activeLocation jobsCompleted')
        .sort('amount')
        .lean();

    // Fetch Global Settings for fee calculation
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const { calculatePlatformFee } = require('../../helpers/feeCalculator.helper');
    const feeConfig = settings?.fees || { type: 'tiered', minFee: 50, threshold: 500, percentage: 12, gstPercentage: 18 };

    const jobLat = job.location?.coordinates?.[1];
    const jobLon = job.location?.coordinates?.[0];

    quotes = quotes.map(quote => {
        let distanceKm = null;
        const wLat = quote.workerLocation?.coordinates?.[1] || quote.workerId?.activeLocation?.coordinates?.[1];
        const wLon = quote.workerLocation?.coordinates?.[0] || quote.workerId?.activeLocation?.coordinates?.[0];

        if (jobLat && jobLon && wLat && wLon) {
            distanceKm = +haversineDistance([jobLon, jobLat], [wLon, wLat]).toFixed(2);
        }

        // --- UNIFIED PRICING MODEL ---
        // Worker quote is their exact payout. Platform fee and GST added on top dynamically.
        const feeBreakdown = calculatePlatformFee(quote.amount, feeConfig);

        return { 
            ...quote, 
            distanceKm, 
            platformFee: feeBreakdown.platformFee, 
            gst: feeBreakdown.gst, 
            customerPayable: feeBreakdown.customerPayable 
        };
    });

    return successResponse(res, quotes, 'Quotes fetched');
});

/**
 * GET /api/v1/quotes/worker
 */
exports.getWorkerQuotes = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { workerId: req.user._id };
    if (status && status !== 'all') query.status = status.toUpperCase();

    const quotes = await Quote.find(query)
        .populate('jobId', 'category subcategory description location addressDetails status createdAt payment')
        .sort('-createdAt')
        .lean();

    return successResponse(res, quotes, 'Worker quotes fetched');
});

/**
 * PATCH /api/v1/quotes/:id/accept
 * P0 FIX: Atomic acceptance using findOneAndUpdate with status guard to prevent double-acceptance
 * B8 FIX: Distributed Redis Locks to eliminate concurrent race conditions
 */
exports.acceptQuote = catchAsync(async (req, res) => {
    const { acquireLock, releaseLock } = require('../../helpers/redis.helper');
    const quote = await Quote.findById(req.params.id).populate('jobId');
    if (!quote) return errorResponse(res, 'Quote not found', StatusCodes.NOT_FOUND);

    const job = quote.jobId;
    if (String(job.customerId) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    // B8 FIX: Acquire distributed lock for this specific job to prevent race conditions
    // If two requests try to accept quotes for the same job simultaneously, the second one will fail to acquire the lock.
    const lockKey = `job_allocation_${job._id}`;
    const lockHolderId = await acquireLock(lockKey, 10);
    if (!lockHolderId) {
        return errorResponse(res, 'Job is currently being allocated. Please try again.', StatusCodes.CONFLICT);
    }

    try {
        // Guard: Verify the worker's subscription is still valid at acceptance time
        const worker = await Customer.findById(quote.workerId).lean();
        if (!worker) return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);

        const now = new Date();
        const isTrialActive = worker.subscription?.isTrial === true &&
            worker.subscription?.trialEndDate &&
            new Date(worker.subscription.trialEndDate) > now;
        const isPaidSubActive = worker.subscription?.expiryDate &&
            new Date(worker.subscription.expiryDate) > now;

        const SettingsService = require('../settings/settings.service');
        const settings = await SettingsService.getAppSettings();
        const freeTrialDays = settings?.subscription?.freeTrialDays || 14;
        const isFallbackTrialActive = worker.createdAt && new Date(worker.createdAt).getTime() + freeTrialDays * 24 * 60 * 60 * 1000 > now.getTime();

        if (!isTrialActive && !isPaidSubActive && !isFallbackTrialActive) {
            return errorResponse(res, 'Worker subscription has expired. Cannot accept this quote.', StatusCodes.PAYMENT_REQUIRED);
        }

        // P0 FIX: Atomic job update with status guard AND Quote Updates inside a single Transaction
        const arrivalOtp    = crypto.randomInt(OTP_MIN, OTP_MAX).toString();
        const completionOtp = crypto.randomInt(OTP_MIN, OTP_MAX).toString();

        // Calculate final pricing model
        const { calculatePlatformFee } = require('../../helpers/feeCalculator.helper');
        const feeConfig = settings?.fees || { type: 'tiered', minFee: 50, threshold: 500, percentage: 12, gstPercentage: 18 };
        
        const feeBreakdown = calculatePlatformFee(quote.amount, feeConfig);
        const workerPayout = feeBreakdown.workerPayout;
        const platformFee = feeBreakdown.platformFee;
        const gst = feeBreakdown.gst;
        const customerPayable = feeBreakdown.customerPayable;

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

    let updatedJob;
    let rejectedQuotes = [];
    try {
        updatedJob = await Job.findOneAndUpdate(
            {
                _id: job._id,
                status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] } // Guard: only accept if not already allocated
            },
            {
                workerId:                    quote.workerId,
                status:                      'ALLOCATED',
                'security.arrivalOtp':       arrivalOtp,
                'security.completionOtp':    completionOtp,
                'payment.amount':            customerPayable,
                'payment.workerPayout':      workerPayout,
                'payment.platformFee':       platformFee,
                'payment.gst':               gst
            },
            { returnDocument: 'after', session }
        );

        if (!updatedJob) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'This job has already been assigned to another worker', StatusCodes.CONFLICT);
        }

        // Mark quote accepted, reject all others
        quote.status = 'ACCEPTED';
        await quote.save({ session });
        
        rejectedQuotes = await Quote.find({ jobId: job._id, _id: { $ne: quote._id }, status: 'PENDING' }).session(session);
        
        await Quote.updateMany(
            { jobId: job._id, _id: { $ne: quote._id }, status: 'PENDING' },
            { status: 'REJECTED' },
            { session }
        );

        if (rejectedQuotes.length > 0) {
            const Notification = require('../notification/notification.model');
            const notificationsToInsert = rejectedQuotes.map(rq => ({
                userId: rq.workerId,
                title: 'Quote Rejected',
                message: `Your quote for job #${String(job._id).slice(-6)} was not selected. The job has been allocated to another worker.`,
                type: 'DIRECT',
                action: 'OTHER'
            }));
            await Notification.insertMany(notificationsToInsert, { session });
        }

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }

    // Cache jobâ†’worker assignment for socket location verification (TTL: 2 hours)
    await setCache(`job:${updatedJob._id}:assigned_worker`, String(quote.workerId), 7200);

    // Notify assigned worker
    emitToRoom(`worker_${quote.workerId}`, 'QUOTE_ACCEPTED', {
        jobId:      updatedJob._id,
        arrivalOtp,
        amount:     quote.amount,
        address:    updatedJob.addressDetails
    });

    // Notify other workers in the job room (for UI state update)
    emitToRoom(`job_${job._id}`, 'JOB_TAKEN', { jobId: job._id });
    
    // Also trigger the unread notification badge for the rejected workers
    if (rejectedQuotes && rejectedQuotes.length > 0) {
        rejectedQuotes.forEach(rq => {
            emitToRoom(`worker_${rq.workerId}`, 'NEW_NOTIFICATION', {
                title: 'Quote Rejected',
                message: `Your quote for job #${String(job._id).slice(-6)} was not selected.`
            });
        });
    }

    emitToAll('DASHBOARD_UPDATE', { type: 'QUOTE_ACCEPTED', id: job._id });

    // Notify customer: worker has been assigned
    notifyUser({
        userId: job.customerId,
        title: 'ðŸ‘· Worker Assigned to Your Job',
        message: `A worker has been assigned to your ${job.category} job. They will arrive shortly!`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: updatedJob._id,
        targetRole: 'CUSTOMER'
    });

        return successResponse(res, { job: updatedJob, quote }, 'Quote accepted, worker assigned');
    } finally {
        await releaseLock(lockKey, lockHolderId);
    }
});


/**
 * PATCH /api/v1/quotes/:id/withdraw
 */
exports.withdrawQuote = catchAsync(async (req, res) => {
    const quote = await Quote.findOneAndUpdate(
        { _id: req.params.id, workerId: req.user._id, status: 'PENDING' },
        { status: 'WITHDRAWN' },
        { returnDocument: 'after' }
    );

    if (!quote) return errorResponse(res, 'Quote not found or cannot be withdrawn', StatusCodes.NOT_FOUND);
    return successResponse(res, quote, 'Quote withdrawn');
});
