const { StatusCodes } = require('http-status-codes');
const Quote             = require('./quote.model');
const Job             = require('../job/job.model');
const Customer        = require('../customer/customer.model');
const AppSettings = require('../settings/settings.model');
const catchAsync      = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll } = require('../../helpers/socket.helper');

/**
 * POST /api/v1/quotes
 * Worker places a quote on a job
 */
exports.placeQuote = catchAsync(async (req, res) => {
    const { jobId, amount, description, timeToReach, workerLocation } = req.body;
    const workerId = req.user._id;

    const worker = await Customer.findById(workerId);
    
    // Check KYC
    if (!worker || worker.kyc.status !== 'APPROVED') {
        return errorResponse(res, 'KYC must be approved before you can place quotes.', StatusCodes.FORBIDDEN);
    }

    // Check Subscription
    if (!worker.subscription?.isTrial && (!worker.subscription?.expiryDate || new Date(worker.subscription.expiryDate) < new Date())) {
        return errorResponse(res, 'Subscription has expired. Please renew to place quotes.', StatusCodes.PAYMENT_REQUIRED);
    }
    
    // Check Minimum Balance
    let settings = await AppSettings.findOne({ isSingleton: 'CONFIG' });
    const minBalance = settings?.wallet?.minimumBalance || 100;
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(res, `Insufficient wallet balance. Minimum Rs ${minBalance} required.`, StatusCodes.PAYMENT_REQUIRED);
    }

    const job = await Job.findById(jobId);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'BROADCASTING' && job.status !== 'QUOTES_RECEIVED') {
        return errorResponse(res, 'Job is not accepting quotes', StatusCodes.BAD_REQUEST);
    }

    // Prevent duplicate quotes from same worker
    const existing = await Quote.findOne({ jobId, workerId, status: 'PENDING' });
    if (existing) return errorResponse(res, 'You already placed a quote on this job', StatusCodes.CONFLICT);

    const quote = await Quote.create({ jobId, workerId, amount, description, timeToReach, workerLocation });

    // Embedded redundancy update for client backward compatibility
    job.quotes.push({
        workerId,
        amount,
        description,
        timeToReach,
        status: 'PENDING'
    });

    // Update job status
    if (job.status === 'BROADCASTING') {
        job.status = 'QUOTES_RECEIVED';
    }
    await job.save();

    // Notify the customer in real-time
    emitToRoom(`customer_${job.customerId}`, 'NEW_QUOTE', {
        jobId:    job._id,
        quoteId:    quote._id,
        workerId: workerId,
        amount,
        description,
        timeToReach
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

    let quotes = await Quote.find({ jobId: req.params.jobId, status: 'PENDING' })
        .populate('workerId', 'name profileImage rating wallet kyc activeLocation')
        .sort('amount')
        .lean();

    const jobLat = job.location?.coordinates?.[1];
    const jobLon = job.location?.coordinates?.[0];

    quotes = quotes.map(quote => {
        let distanceKm = null;
        const workerLat = quote.workerLocation?.coordinates?.[1] || quote.workerId?.activeLocation?.coordinates?.[1];
        const workerLon = quote.workerLocation?.coordinates?.[0] || quote.workerId?.activeLocation?.coordinates?.[0];

        if (jobLat && jobLon && workerLat && workerLon) {
            const R = 6371;
            const dLat = (workerLat - jobLat) * Math.PI / 180;
            const dLon = (workerLon - jobLon) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(jobLat * Math.PI / 180) * Math.cos(workerLat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distanceKm = +(R * c).toFixed(2);
        }
        return { ...quote, distanceKm };
    });

    return successResponse(res, quotes, 'Quotes fetched');
});

/**
 * GET /api/v1/quotes/worker
 * Worker sees their own quotes with optional status filter
 */
exports.getWorkerQuotes = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { workerId: req.user._id };
    if (status && status !== 'all') query.status = status.toUpperCase();

    const quotes = await Quote.find(query)
        .populate('jobId', 'category description location addressDetails status createdAt')
        .sort('-createdAt');

    return successResponse(res, quotes, 'Worker quotes fetched');
});

/**
 * PATCH /api/v1/quotes/:id/accept
 * Customer accepts a quote → assigns worker, rejects all others
 */
exports.acceptQuote = catchAsync(async (req, res) => {
    const quote = await Quote.findById(req.params.id).populate('jobId');
    if (!quote) return errorResponse(res, 'Quote not found', StatusCodes.NOT_FOUND);

    const job = quote.jobId;
    if (String(job.customerId) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    // Generate 4-digit arrival OTP
    const arrivalOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Update job
    job.workerId          = quote.workerId;
    job.status            = 'ALLOCATED'; // as per new enum
    if (!job.security) job.security = {};
    job.security.arrivalOtp = arrivalOtp;
    if (!job.payment) job.payment = {};
    job.payment.amount    = quote.amount;
    
    // Update embedded quote status
    const embeddedQuote = job.quotes.find(q => String(q.workerId) === String(quote.workerId));
    if (embeddedQuote) embeddedQuote.status = 'ACCEPTED';

    await job.save();

    // Mark this quote accepted, reject all others
    quote.status = 'ACCEPTED';
    await quote.save();
    await Quote.updateMany(
        { jobId: job._id, _id: { $ne: quote._id }, status: 'PENDING' },
        { status: 'REJECTED' }
    );

    // Notify assigned worker
    emitToRoom(`worker_${quote.workerId}`, 'QUOTE_ACCEPTED', {
        jobId:      job._id,
        arrivalOtp,
        amount:     quote.amount
    });

    // Notify all other workers quoting on this job
    emitToRoom(`job_${job._id}`, 'JOB_TAKEN', { jobId: job._id });

    emitToAll('DASHBOARD_UPDATE', { type: 'QUOTE_ACCEPTED', id: job._id });

    return successResponse(res, { job, quote }, 'Quote accepted, worker assigned');
});

/**
 * PATCH /api/v1/quotes/:id/withdraw
 * Worker withdraws their own pending quote
 */
exports.withdrawQuote = catchAsync(async (req, res) => {
    const quote = await Quote.findOne({ _id: req.params.id, workerId: req.user._id });
    if (!quote) return errorResponse(res, 'Quote not found', StatusCodes.NOT_FOUND);
    if (quote.status !== 'PENDING') return errorResponse(res, 'Cannot withdraw — quote is no longer pending', StatusCodes.BAD_REQUEST);

    quote.status = 'WITHDRAWN';
    await quote.save();

    return successResponse(res, quote, 'Quote withdrawn');
});
