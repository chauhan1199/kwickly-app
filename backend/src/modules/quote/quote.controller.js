const { StatusCodes } = require('http-status-codes');
const Quote       = require('./quote.model');
const Job         = require('../job/job.model');
const Customer    = require('../customer/customer.model');
const catchAsync  = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');
const { getCache, setCache } = require('../../helpers/redis.helper');

/**
 * POST /api/v1/quotes
 * Worker places a quote on a job
 */
exports.placeQuote = catchAsync(async (req, res) => {
    const { jobId, amount, description, timeToReach, workerLocation } = req.body;
    const workerId = req.user._id;

    if (!amount || amount <= 0) {
        return errorResponse(res, 'Quote amount must be a positive number', StatusCodes.BAD_REQUEST);
    }

    const worker = await Customer.findById(workerId).lean();

    // Guard: KYC check
    if (!worker || worker.kyc?.status !== 'APPROVED') {
        return errorResponse(res, 'KYC must be approved before you can place quotes.', StatusCodes.FORBIDDEN);
    }

    // Guard: Subscription check
    const now = new Date();
    const isSubscriptionValid = worker.subscription?.isTrial ||
        (worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > now);
    if (!isSubscriptionValid) {
        return errorResponse(res, 'Subscription expired. Please renew to place quotes.', StatusCodes.PAYMENT_REQUIRED);
    }

    // Guard: Minimum wallet balance (from cache or DB)
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const minBalance = settings?.wallet?.minimumBalance || 100;
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(res, `Minimum wallet balance of ₹${minBalance} required to quote.`, StatusCodes.PAYMENT_REQUIRED);
    }

    const job = await Job.findById(jobId);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    // P0 FIX: Self-quote guard — worker cannot quote on a job they created
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
        const R = 6371;
        const dLat = (workerLat - jobLat) * Math.PI / 180;
        const dLon = (workerLon - jobLon) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(jobLat * Math.PI/180) * Math.cos(workerLat * Math.PI/180) * Math.sin(dLon/2)**2;
        const distanceKm = +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
        const estMins = Math.max(5, Math.ceil(distanceKm * 2) + 5);
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
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const feeConfig = settings?.fees || { type: 'flat', amount: 50, gstPercentage: 18 };

    const jobLat = job.location?.coordinates?.[1];
    const jobLon = job.location?.coordinates?.[0];

    quotes = quotes.map(quote => {
        let distanceKm = null;
        const wLat = quote.workerLocation?.coordinates?.[1] || quote.workerId?.activeLocation?.coordinates?.[1];
        const wLon = quote.workerLocation?.coordinates?.[0] || quote.workerId?.activeLocation?.coordinates?.[0];

        if (jobLat && jobLon && wLat && wLon) {
            const R = 6371;
            const dLat = (wLat - jobLat) * Math.PI / 180;
            const dLon = (wLon - jobLon) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 +
                      Math.cos(jobLat * Math.PI/180) * Math.cos(wLat * Math.PI/180) * Math.sin(dLon/2)**2;
            distanceKm = +(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
        }

        // --- NEW PRICING MODEL ---
        // Worker quote is their exact payout. Platform fee and GST added on top.
        const workerPayout = quote.amount;
        const platformFee = feeConfig.type === 'percent'
            ? (workerPayout * (feeConfig.amount || 10)) / 100
            : (feeConfig.amount || 50);
        
        const gst = (platformFee * (feeConfig.gstPercentage || 18)) / 100;
        const customerPayable = workerPayout + platformFee + gst;

        return { 
            ...quote, 
            distanceKm, 
            platformFee, 
            gst, 
            customerPayable 
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
 */
exports.acceptQuote = catchAsync(async (req, res) => {
    const quote = await Quote.findById(req.params.id).populate('jobId');
    if (!quote) return errorResponse(res, 'Quote not found', StatusCodes.NOT_FOUND);

    const job = quote.jobId;
    if (String(job.customerId) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    // P0 FIX: Atomic job update with status guard AND Quote Updates inside a single Transaction
    const arrivalOtp    = Math.floor(1000 + Math.random() * 9000).toString();
    const completionOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Calculate final pricing model 
    const { getCache, setCache } = require('../../helpers/redis.helper');
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const feeConfig = settings?.fees || { type: 'flat', amount: 50, gstPercentage: 18 };
    
    const workerPayout = quote.amount;
    const platformFee = feeConfig.type === 'percent'
        ? (workerPayout * (feeConfig.amount || 10)) / 100
        : (feeConfig.amount || 50);
    const gst = (platformFee * (feeConfig.gstPercentage || 18)) / 100;
    const customerPayable = workerPayout + platformFee + gst;

    const mongoose = require('mongoose');
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

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
            { new: true, session }
        );

        if (!updatedJob) {
            if (session) await session.abortTransaction();
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

        if (session) await session.commitTransaction();
        if (session) session.endSession();

    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }

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

    return successResponse(res, { job: updatedJob, quote }, 'Quote accepted, worker assigned');
});

/**
 * PATCH /api/v1/quotes/:id/withdraw
 */
exports.withdrawQuote = catchAsync(async (req, res) => {
    const quote = await Quote.findOneAndUpdate(
        { _id: req.params.id, workerId: req.user._id, status: 'PENDING' },
        { status: 'WITHDRAWN' },
        { new: true }
    );

    if (!quote) return errorResponse(res, 'Quote not found or cannot be withdrawn', StatusCodes.NOT_FOUND);
    return successResponse(res, quote, 'Quote withdrawn');
});
