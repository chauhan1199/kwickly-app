const { StatusCodes } = require('http-status-codes');
const Job = require('./job.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const logger = require('../../helpers/logger.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToRoom, emitToAll, triggerDashboardUpdate } = require('../../helpers/socket.helper');
const { setCache, delCache } = require('../../helpers/redis.helper');
const { uploadImage } = require('../../services/cloudinary.service');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const { findEligibleWorkers } = require('../../helpers/worker.helper');
const { haversineDistance, calculateETA } = require('../../helpers/geo.helper');
const { MAX_ACTIVE_JOBS, MAX_AVAILABLE_JOBS, GEOFENCE_MAX_METERS, JOB_ELIGIBLE_WORKERS_TTL, OTP_MIN, OTP_MAX } = require('../../constants/business');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const crypto = require('crypto');

// Each OTP proves the *other* party was present: the customer reads out the arrival
// OTP to the worker, and the worker reads out the completion OTP to the customer.
// So a worker must never receive the arrival OTP, nor a customer the completion OTP.
const hideOtpsFor = (doc, role) => {
    const job = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (!job || !job.security) return job;
    const security = { ...job.security };
    if (role === 'WORKER') {
        delete security.arrivalOtp;
        // The completion PIN only matters once work has started; before that the worker
        // could hand it over without ever verifying arrival
        if (!['IN_PROGRESS', 'COMPLETED'].includes(job.status)) delete security.completionOtp;
    }
    else if (role === 'CUSTOMER') delete security.completionOtp;
    else if (role !== 'ADMIN') return { ...job, security: undefined };
    return { ...job, security };
};

const timingSafeEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * ─── WORKER ELIGIBILITY CRITERIA (ALL must be true) ─────────────────────────
 *  1. role === 'WORKER'
 *  2. isVerified === true
 *  3. kyc.status === 'APPROVED'
 *  4. isOnline === true
 *  5. Subscription valid (trial active OR expiryDate > now)
 *  6. wallet.balance >= minimumBalance (from settings, default ₹100)
 *  7. Worker has the job's CATEGORY in their active services
 *  8. Job location is within the WORKER'S OWN serviceRadius (not global maxKm)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── POST /api/v1/jobs ────────────────────────────────────────────────────────
exports.createJob = catchAsync(async (req, res) => {
    const {
        category,
        subcategory,
        description,
        media,
        preferredDate,
        timeSlot,
        location,
        addressDetails
    } = req.body;

    // Extract city if provided
    let targetCity = req.body.city;
    if (!targetCity && typeof addressDetails === 'object' && addressDetails.city) {
        targetCity = addressDetails.city;
    }

    // Validate coordinates are present
    if (!location?.coordinates || location.coordinates.length !== 2) {
        return errorResponse(res, 'Job location coordinates are required', StatusCodes.BAD_REQUEST);
    }

    // Check maximum active jobs limit (max 5)
    const activeJobsCount = await Job.countDocuments({
        customerId: req.user._id,
        status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS'] }
    });

    if (activeJobsCount >= MAX_ACTIVE_JOBS) {
        return errorResponse(res, 'You can only have up to 5 ongoing requests at a time. Please wait for them to complete or cancel an existing request.', StatusCodes.BAD_REQUEST);
    }

    // ── Step 1: Load platform settings (Redis cached, 10 min TTL) ──────────────
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();

    if (settings?.maintenance?.mode) {
        const msg = settings.maintenance.message || 'The platform is currently undergoing maintenance. Please try again later.';
        return errorResponse(res, msg, StatusCodes.SERVICE_UNAVAILABLE);
    }
    const minBalance = settings?.wallet?.minimumBalance || 100;

    // Initial radius is the first round or maxKm
    const initialRadiusKm = settings?.radius?.rounds?.[0]?.maxKm || settings?.radius?.maxKm || 25;
    const preferredWorkerId = req.body.preferredWorkerId || req.body.workerId || undefined;

    // Create the job
    let job;
    try {
        job = await Job.create({
            customerId: req.user._id,
            preferredWorkerId: preferredWorkerId ? preferredWorkerId : undefined,
            category,
            subcategory,
            description,
            budget: req.body.budget ? Number(req.body.budget) : undefined,
            media,
            preferredDate,
            timeSlot,
            location,
            addressDetails: typeof addressDetails === 'string'
                ? { fullAddress: addressDetails, city: targetCity }
                : { ...addressDetails, city: targetCity },
            status: 'BROADCASTING',
            payment: { amount: 0, status: 'PENDING' },
            broadcast: { round: 0, lastAttemptAt: new Date(), radiusKm: initialRadiusKm }
        });

        // Race condition guard: re-check count after creation, delete if exceeded
        const postCount = await Job.countDocuments({
            customerId: req.user._id,
            status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS'] }
        });
        if (postCount > MAX_ACTIVE_JOBS) {
            await Job.deleteOne({ _id: job._id });
            return errorResponse(res, 'You can only have up to 5 ongoing requests at a time. Please wait for them to complete or cancel an existing request.', StatusCodes.BAD_REQUEST);
        }
    } catch (err) {
        logger.error('[createJob] Failed to create job', err);
        throw err;
    }

    // Return response immediately to customer with zero latency
    successResponse(
        res,
        job.toObject(),
        'Job created successfully.',
        StatusCodes.CREATED
    );

    // ─── Background async worker discovery & broadcasting ─────────────────────
    setImmediate(async () => {
        try {
            const eligibleWorkerIds = await findEligibleWorkers(job, initialRadiusKm, minBalance);

            // Update job to broadcast round 1
            job.broadcast.round = 1;
            await job.save();

            // ─── Load customer info for the notification payload ─────────────
            const customer = await Customer.findById(req.user._id)
                .select('name phone profileImage')
                .lean();

            const alertPayload = {
                jobId: job._id,
                category: job.category,
                subcategory: job.subcategory,
                description: job.description,
                budget: job.budget,
                location: job.location,
                addressDetails: job.addressDetails,
                timeSlot: job.timeSlot,
                preferredDate: job.preferredDate,
                notifiedWorkers: eligibleWorkerIds.length,
                isDirectBooking: !!job.preferredWorkerId,
                customer: {
                    _id: customer?._id,
                    name: customer?.name,
                    profileImage: customer?.profileImage
                }
            };

            // ─── If preferred worker was chosen, notify them directly with top priority ─
            if (job.preferredWorkerId) {
                emitToRoom(`worker_${job.preferredWorkerId}`, 'NEW_JOB_ALERT', {
                    ...alertPayload,
                    customerRequestedYou: true
                });
                notifyUser({
                    userId: job.preferredWorkerId,
                    title: 'Direct Job Request from Customer!',
                    message: `${customer?.name || 'A customer'} specifically selected you for ${job.category}${job.subcategory ? ' (' + job.subcategory + ')' : ''}. Respond now!`,
                    action: 'DIRECT_JOB_REQUEST',
                    entityType: 'JOB',
                    entityId: job._id,
                    targetRole: 'WORKER'
                });
            }

            // ─── Emit to all eligible workers' personal rooms ───────────────
            if (eligibleWorkerIds.length > 0) {
                eligibleWorkerIds.forEach(workerId => {
                    if (!job.preferredWorkerId || workerId.toString() !== job.preferredWorkerId.toString()) {
                        emitToRoom(`worker_${workerId}`, 'NEW_JOB_ALERT', alertPayload);
                    }
                });
            }

            // ─── Cache eligible worker IDs for this job ───────────────────────
            await setCache(`job:${job._id}:eligible_workers`, eligibleWorkerIds, JOB_ELIGIBLE_WORKERS_TTL);

            // ─── Invalidate admin dashboard cache + notify admin room ────────
            await delCache('admin_dashboard_stats');
            await delCache('admin_badge_counts');
            emitToRoom('admin_dashboard', 'DASHBOARD_UPDATE', {
                type: 'NEW_JOB',
                id: job._id,
                category: job.category,
                notifiedWorkers: eligibleWorkerIds.length
            });

            // ─── Notify customer that job was posted successfully ─────────────
            notifyUser({
                userId: req.user._id,
                title: 'Job Posted Successfully',
                message: job.preferredWorkerId 
                    ? `Your direct request for ${job.category}${job.subcategory ? ' (' + job.subcategory + ')' : ''} has been sent to your selected professional with priority dispatch!`
                    : `Your request for ${job.category}${job.subcategory ? ' (' + job.subcategory + ')' : ''} has been broadcasted. Finding verified workers near you!`,
                action: 'JOB_CREATED',
                entityType: 'JOB',
                entityId: job._id,
                targetRole: 'CUSTOMER'
            });
        } catch (bgError) {
            logger.error('[createJob] Background broadcast error:', bgError);
        }
    });
});


// ─── GET /api/v1/jobs (Admin) ─────────────────────────────────────────────────
exports.getJobs = catchAsync(async (req, res) => {
    const { status, search, limit = 20, page = 1 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status.toUpperCase();
    // e.g. ?paymentStatus=PENDING_VERIFICATION for UPI payments awaiting approval
    if (req.query.paymentStatus) query['payment.status'] = String(req.query.paymentStatus).toUpperCase();

    if (search && search.trim()) {
        const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const matchingUsers = await Customer.find({
            $or: [{ name: regex }, { phone: regex }]
        }).select('_id').lean();
        const userIds = matchingUsers.map(u => u._id);

        const searchOr = [
            { category: regex },
            { description: regex },
            { 'addressDetails.city': regex },
            { 'addressDetails.fullAddress': regex },
            { customerId: { $in: userIds } },
            { workerId: { $in: userIds } }
        ];

        if (mongoose.Types.ObjectId.isValid(search.trim())) {
            searchOr.push({ _id: search.trim() });
        }
        query.$or = searchOr;
    }

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { jobs, totalPages: Math.ceil(total / Number(limit)) || 1, currentPage: Number(page), totalJobs: total }, 'Jobs fetched');
});

// ─── GET /api/v1/jobs/my (Customer) ──────────────────────────────────────────
exports.getMyJobs = catchAsync(async (req, res) => {
    const { status } = req.query;
    const query = { customerId: req.user._id };
    if (status) query.status = status.toUpperCase();

    const jobs = await Job.find(query)
        .populate('workerId', 'name phone profileImage rating activeLocation')
        .sort('-createdAt')
        .limit(100)
        .lean();

    return successResponse(res, jobs.map(j => hideOtpsFor(j, 'CUSTOMER')), 'My jobs fetched successfully');
});

// ─── GET /api/v1/jobs/available (Worker) ─────────────────────────────────────
//
// Returns jobs that the requesting worker is eligible to bid on.
// All 8 eligibility criteria are enforced here as well.
exports.getAvailableJobs = catchAsync(async (req, res) => {
    // ── Fetch worker with populated category names ──────────────────────────────
    const worker = await Customer.findById(req.user._id)
        .populate('services.category', 'name')
        .lean();

    if (!worker) {
        return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);
    }

    // ── Criteria 3: KYC approved ────────────────────────────────────────────────
    if (worker.kyc?.status !== 'APPROVED') {
        return errorResponse(
            res,
            'Your KYC is not approved yet. Please upload your documents and wait for admin review.',
            StatusCodes.FORBIDDEN
        );
    }

    // ── Criteria 4: Online ──────────────────────────────────────────────────────
    if (!worker.isOnline) {
        return errorResponse(
            res,
            'You must be online to view available jobs. Toggle your online status.',
            StatusCodes.FORBIDDEN
        );
    }

    // ── Criteria 5: Subscription valid ─────────────────────────────────────────
    const now = new Date();
    const isTrialActive = worker.subscription?.isTrial === true &&
        worker.subscription?.trialEndDate &&
        new Date(worker.subscription.trialEndDate) > now;
    const isPaidSubActive = worker.subscription?.expiryDate &&
        new Date(worker.subscription.expiryDate) > now;

    // Fallback: Use freeTrialDays from registration
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const freeTrialDays = settings?.subscription?.freeTrialDays || 14;
    const isFallbackTrialActive = worker.createdAt && new Date(worker.createdAt).getTime() + freeTrialDays * 24 * 60 * 60 * 1000 > now.getTime();

    const isSubscriptionValid = isTrialActive || isPaidSubActive || isFallbackTrialActive;

    if (!isSubscriptionValid) {
        return errorResponse(
            res,
            'Your subscription has expired. Please purchase a plan to view and bid on jobs.',
            StatusCodes.PAYMENT_REQUIRED
        );
    }

    // ── Criteria 6: Wallet balance ──────────────────────────────────────────────
    const minBalance = settings?.wallet?.minimumBalance || 100;
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(
            res,
            `Minimum wallet balance of ₹${minBalance} is required to view jobs. Please top up.`,
            StatusCodes.PAYMENT_REQUIRED
        );
    }

    // ── Criteria 7: Active service categories (worker's own selection) ──────────
    const activeCategoryNames = (worker.services || [])
        .filter(s => s.isActive && s.category?.name)
        .map(s => s.category.name.trim());

    if (activeCategoryNames.length === 0) {
        return errorResponse(
            res,
            'Please set at least one active service category in your profile.',
            StatusCodes.FORBIDDEN
        );
    }

    // ─── Criteria 8: Worker's own serviceRadius + location check ──────────────────
    const workerRadiusKm = worker.serviceRadius || (settings?.radius?.maxKm || 15);
    const workerCoords = worker.activeLocation?.coordinates;

    if (!workerCoords || workerCoords.length !== 2) {
        return errorResponse(
            res,
            'Your current location is not set. Please enable GPS and update your location.',
            StatusCodes.FORBIDDEN
        );
    }

    const workerRadiusRadians = workerRadiusKm / 6371;

    // ─── Exclude jobs this worker has a live quote on ────────────────────────────
    // A withdrawn quote frees the job again so the worker can re-quote (placeQuote allows it)
    const Quote = require('../quote/quote.model');
    const quotedJobIds = await Quote.distinct('jobId', { workerId: req.user._id, status: { $ne: 'WITHDRAWN' } });

    // ─── Fetch active jobs matching worker's categories within their radius ──────
    const query = {
        status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] },
        category: { $in: activeCategoryNames },        // Criteria 7: category match
        _id: { $nin: quotedJobIds },               // Exclude already-quoted
        location: {                                     // Criteria 8: worker's radius
            $geoWithin: {
                $centerSphere: [workerCoords, workerRadiusRadians]
            }
        }
    };

    if (worker.city) {
        const escapedCity = worker.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
            { 'addressDetails.city': { $exists: false } },
            { 'addressDetails.city': null },
            { 'addressDetails.city': '' },
            { 'addressDetails.city': { $regex: new RegExp('^' + escapedCity + '$', 'i') } }
        ];
    }

    const jobs = await Job.find(query)
        .populate('customerId', 'name phone profileImage')
        .sort('-createdAt')
        .limit(MAX_AVAILABLE_JOBS)
        .lean();

    // ─── Attach distance info to each job (for display in worker's app) ─────────
    const [wLng, wLat] = workerCoords;
    const jobsWithDistance = jobs.map(job => {
        const [jLng, jLat] = job.location?.coordinates || [0, 0];
        const distanceKm = parseFloat(haversineDistance([wLng, wLat], [jLng, jLat]).toFixed(2));
        const etaMins = calculateETA(distanceKm);
        return { ...job, security: undefined, distanceKm, etaMins };
    });

    // Sort by distance (nearest first)
    jobsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return successResponse(
        res,
        jobsWithDistance,
        `${jobsWithDistance.length} available job(s) found within ${workerRadiusKm} km`
    );
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

    return successResponse(res, jobs.map(j => hideOtpsFor(j, 'WORKER')), 'Worker jobs fetched');
});

// ─── PATCH /api/v1/jobs/:id/start ─────────────────────────────────────────────
//
// LOOPHOLE FIX #3 — GPS Spoofing Mitigation
// ─── POST /api/v1/jobs/:id/arrive (WORKER) ─────────────────────────────────
// B1 FIX: Adds the ALLOCATED → ARRIVING transition that was previously missing.
// Worker calls this when they start heading to the customer.
// Triggers JOB_STATUS_CHANGED so LiveTrackingScreen shows "Worker En Route".
exports.arriveJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'ALLOCATED') {
        return errorResponse(res, `Cannot mark as arriving — job is currently ${job.status}`, StatusCodes.BAD_REQUEST);
    }

    job.status = 'ARRIVING';
    await job.save();
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

    emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', {
        jobId: job._id, status: 'ARRIVING', message: 'Your worker is on the way!'
    });

    notifyUser({
        userId: job.customerId,
        title: '🚗 Worker On The Way',
        message: `Your worker is heading to your location for the ${job.category} service. Track them in real-time.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Job marked as ARRIVING');
});

//   Verifies worker is within 200 meters of job location using Haversine distance
//   This prevents workers from using GPS spoofing apps to fake arrival
exports.startJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { arrivalOtp, currentCoordinates } = req.body;

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (!['ALLOCATED', 'ARRIVING'].includes(job.status)) {
        return errorResponse(res, 'Job cannot be started in this status', StatusCodes.BAD_REQUEST);
    }
    if (job.security?.arrivalOtp != null) {
        if (!arrivalOtp || !timingSafeEqual(job.security.arrivalOtp, arrivalOtp)) {
            return errorResponse(res, 'Invalid Arrival OTP', StatusCodes.BAD_REQUEST);
        }
    }

    // GPS Spoofing Check: Geofence verification (≤200 meters)
    const jobCoords = job.location?.coordinates;
    if (!currentCoordinates || currentCoordinates.length !== 2) {
        return errorResponse(
            res,
            'Current location coordinates are required to start the job. Please enable GPS.',
            StatusCodes.BAD_REQUEST
        );
    }
    if (jobCoords && jobCoords.length === 2) {
        const [jobLon, jobLat] = jobCoords;
        const [curLon, curLat] = currentCoordinates;
        const distanceMeters = haversineDistance([jobLon, jobLat], [curLon, curLat]) * 1000;

        if (distanceMeters > GEOFENCE_MAX_METERS) {
            return errorResponse(
                res,
                `You are ${Math.round(distanceMeters)}m away from the job location. Please arrive within ${GEOFENCE_MAX_METERS}m to start the job.`,
                StatusCodes.FORBIDDEN
            );
        }
    }

    job.status = 'IN_PROGRESS';
    job.startedAt = new Date();
    job.security = { ...job.security, arrivalOtp: undefined };
    await job.save();
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

    emitToRoom(`customer_${job.customerId}`, 'JOB_STARTED', { jobId: job._id });
    emitToRoom(`worker_${job.workerId}`, 'START_TIMER', { jobId: job._id });

    notifyUser({
        userId: job.customerId,
        title: 'Work Started',
        message: `The assigned worker has arrived and started your ${job.category} service.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Job started successfully');
});

// ─── PATCH /api/v1/jobs/:id/complete ─────────────────────────────────────────
exports.completeJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { media, report } = req.body;

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);
    if (job.status === 'ALLOCATED' || job.status === 'ARRIVING') {
        return errorResponse(res, "This job hasn't started yet. Enter the customer's arrival OTP to start it first.", StatusCodes.BAD_REQUEST);
    }
    if (job.status !== 'IN_PROGRESS') {
        return errorResponse(res, 'Only in-progress jobs can be completed', StatusCodes.BAD_REQUEST);
    }

    job.status = 'COMPLETED';
    job.completionDetails = { media: media || [], report: report || '', completedAt: new Date() };
    await job.save();
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

    await delCache(`job:${job._id}:assigned_worker`);

    emitToRoom(`customer_${job.customerId}`, 'JOB_COMPLETED', { jobId: job._id });

    notifyUser({
        userId: job.customerId,
        title: 'Job Completed',
        message: `Your ${job.category} service is complete! Please review the work and proceed with payment.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Job completed successfully');
});

// Validates a promo code for a job payment and claims one use of it. Returns
// { discount, claimed } or { error }. `claimed` means a use was recorded and must be
// given back (restorePromoUsage) if the payment does not go through.
const claimJobPromo = async ({ job, promoCode, userId }) => {
    const { Promotion, UserPromoUsage } = require('../promotion/promotion.model');
    const promo = await Promotion.findOne({ code: promoCode.toUpperCase(), isActive: true }).lean();
    if (promo && promo.maxUsesPerUser) {
        const usedByMe = await UserPromoUsage.countDocuments({ promoId: promo._id, userId });
        if (usedByMe >= promo.maxUsesPerUser) {
            return { error: 'You have reached the usage limit for this promo code' };
        }
    }
    let promoDiscount = 0;
    if (promo && (!promo.endAt || new Date(promo.endAt) > new Date())) {
        const amount = job.payment?.amount || 0;
        if (amount >= (promo.minOrderAmount || 0)) {
            if (promo.type === 'FLAT_DISCOUNT') promoDiscount = promo.value;
            if (promo.type === 'PERCENTAGE_DISCOUNT') promoDiscount = Math.round((amount * promo.value) / 100);
            if (promo.maxDiscountCap && promoDiscount > promo.maxDiscountCap) promoDiscount = promo.maxDiscountCap;
            if (promoDiscount > amount) promoDiscount = amount;

            // Track usage atomically with conditional check to prevent race condition
            const incremented = await Promotion.findOneAndUpdate(
                { _id: promo._id, isActive: true, $or: [{ maxUsesTotal: { $exists: false } }, { maxUsesTotal: null }, { $expr: { $lt: ['$usesCount', '$maxUsesTotal'] } }] },
                { $inc: { usesCount: 1 } },
                { returnDocument: 'after' }
            );
            if (!incremented) {
                return { error: 'This promo code has reached its usage limit' };
            }

            await UserPromoUsage.create({ promoId: promo._id, userId });
            // Save promo info on job
            job.promoCode = promoCode;
            job.promoDiscount = promoDiscount;
            return { discount: promoDiscount, claimed: true };
        }
    }
    return { discount: promoDiscount, claimed: false };
};

// Gives back a promo use taken for a job payment that did not go through.
const releaseJobPromo = async (job) => {
    if (!job?.promoCode) return;
    const { restorePromoUsage } = require('../shoporder/shoporder.controller');
    await restorePromoUsage({ _id: job._id, promoCode: String(job.promoCode).toUpperCase(), customerId: job.customerId });
};

/**
 * Confirms a direct-UPI job payment that is waiting in PENDING_VERIFICATION, once
 * the money is known to have arrived (bank-SMS match at submission, the bank-SMS
 * webhook, or an admin approval). The customer paid the platform's UPI ID directly,
 * so nothing is taken from their wallet: the worker is credited 100% of the quote,
 * the fee goes to the treasury and the GST to the liability (settleJobCompletion).
 *
 * Idempotent: only the caller that flips COMPLETED → PAID settles; any repeat call
 * returns { confirmed: false } without touching money.
 */
const confirmJobUpiPayment = async ({ jobId, how = 'admin' }) => {
    const claimed = await Job.findOneAndUpdate(
        { _id: jobId, status: 'COMPLETED', 'payment.status': 'PENDING_VERIFICATION', 'payment.method': 'UPI' },
        { $set: { status: 'PAID' } },
        { returnDocument: 'after' }
    );
    if (!claimed) {
        const current = await Job.findById(jobId).lean();
        return { confirmed: false, job: current };
    }

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
    const job = claimed;
    try {
        const { settleJobCompletion } = require('../../helpers/settlementEngine.helper');
        const { recordPromoCost } = require('../adminWallet/adminWallet.service');
        await settleJobCompletion({ job, session });

        // The worker is paid the full quote, so a promo discount is funded by the platform.
        const promoDiscount = Number(job.promoDiscount || 0);
        if (promoDiscount > 0) {
            await recordPromoCost(
                promoDiscount,
                `Promo ${job.promoCode} discount on UPI job #${job._id.toString().slice(-6)}`,
                job._id,
                'Job',
                { workerId: job.workerId, customerId: job.customerId, method: 'UPI' },
                { session }
            );
        }

        job.payment.status = 'PAID';
        job.payment.method = 'UPI';
        job.payment.escrowStatus = 'SETTLED';
        job.set('security.completionOtp', undefined);
        await job.save({ session });

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        // Put the job back so the payment can be confirmed again
        try { await Job.findOneAndUpdate({ _id: job._id, status: 'PAID', 'payment.status': 'PENDING_VERIFICATION' }, { status: 'COMPLETED' }); } catch (e) { /* best-effort revert */ }
        throw error;
    }

    logger.info(`[Job] UPI payment for job #${job._id} confirmed (${how}, UTR: ${job.payment?.utrNumber})`);

    await delCache(`session:${job.workerId}`);
    await delCache(`session:${job.customerId}`);
    emitToRoom(`worker_${job.workerId}`, 'JOB_PAID', { jobId: job._id });
    emitToRoom(`customer_${job.customerId}`, 'JOB_PAID', { jobId: job._id, paymentStatus: 'PAID', utr: job.payment?.utrNumber });
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

    notifyUser({
        userId: job.workerId,
        title: 'Payment Received',
        message: `You have received payment for job #${String(job._id).slice(-6)}.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'WORKER'
    });
    notifyUser({
        userId: job.customerId,
        title: 'Payment Confirmed',
        message: `Your UPI payment of ₹${job.payment?.upiAmount ?? job.payment?.amount} for job #${String(job._id).slice(-6)} has been confirmed.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return { confirmed: true, job };
};
exports.confirmJobUpiPayment = confirmJobUpiPayment;

// Customer submitted a UTR for a direct-UPI payment of a COMPLETED job (completion
// OTP already checked). The job waits in payment PENDING_VERIFICATION until a bank
// credit with this UTR and amount is found, or an admin approves it.
const submitUpiJobPayment = async (req, res, job) => {
    const { promoCode } = req.body;
    const { isValidUtr, findUtrUsage } = require('../../helpers/upi.helper');
    const ShopOrder = require('../shoporder/shoporder.model');
    const BankCredit = require('../payment/bankCredit.model');

    const utr = String(req.body.utrNumber || '').trim();
    if (!isValidUtr(utr)) {
        return errorResponse(res, 'Please enter the valid 12-digit UPI Reference (UTR) number.', StatusCodes.BAD_REQUEST);
    }
    // One bank transaction (UTR) can pay for exactly one thing on the platform.
    const [usage, usedByOrder, claimedCredit] = await Promise.all([
        findUtrUsage(utr),
        ShopOrder.exists({ 'payment.utrNumber': utr, 'payment.status': { $ne: 'FAILED' } }),
        BankCredit.exists({ utr, isClaimed: true })
    ]);
    if (usage || usedByOrder || claimedCredit) {
        return errorResponse(res, 'This UPI Reference / Transaction ID has already been redeemed on the platform.', StatusCodes.CONFLICT);
    }

    // Same payable as a wallet payment: amount − promo discount
    let promoDiscount = 0;
    let promoClaimed = false;
    if (promoCode) {
        const promoResult = await claimJobPromo({ job, promoCode, userId: req.user._id });
        if (promoResult.error) return errorResponse(res, promoResult.error, StatusCodes.BAD_REQUEST);
        promoDiscount = promoResult.discount;
        promoClaimed = promoResult.claimed;
    }
    const upiAmount = Math.round(Math.max(0, Number(job.payment?.amount || 0) - promoDiscount) * 100) / 100;

    let pending = null;
    try {
        if (upiAmount <= 0) {
            throw Object.assign(new Error('Nothing is left to pay by UPI for this job. Please pay from your wallet.'), { statusCode: StatusCodes.BAD_REQUEST });
        }
        pending = await Job.findOneAndUpdate(
            { _id: job._id, status: 'COMPLETED', 'payment.status': { $nin: ['PAID', 'PENDING_VERIFICATION'] } },
            promoClaimed
                ? { $set: { 'payment.status': 'PENDING_VERIFICATION', 'payment.method': 'UPI', 'payment.utrNumber': utr, 'payment.upiAmount': upiAmount, promoCode: job.promoCode, promoDiscount } }
                : { $set: { 'payment.status': 'PENDING_VERIFICATION', 'payment.method': 'UPI', 'payment.utrNumber': utr, 'payment.upiAmount': upiAmount }, $unset: { promoCode: 1, promoDiscount: 1 } },
            { returnDocument: 'after' }
        );
        if (!pending) {
            throw Object.assign(new Error('Payment is already being processed or has already been completed for this job'), { statusCode: StatusCodes.CONFLICT });
        }
    } catch (error) {
        if (promoClaimed) await releaseJobPromo(job);
        if (error.code === 11000) {
            return errorResponse(res, 'This UPI Reference / Transaction ID has already been redeemed on the platform.', StatusCodes.CONFLICT);
        }
        if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
        throw error;
    }

    // The bank SMS may already be here: claim the matching credit and settle now.
    const bankCredit = await BankCredit.findOneAndUpdate(
        { utr, isClaimed: false, amount: { $gte: upiAmount - 0.5, $lte: upiAmount + 0.5 } },
        { $set: { isClaimed: true, claimedBy: req.user._id, claimedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (bankCredit) {
        try {
            const result = await confirmJobUpiPayment({ jobId: job._id, how: 'matched to bank credit at submission' });
            if (result.confirmed) {
                return successResponse(res, hideOtpsFor(result.job, req.user.role), 'Payment completed successfully');
            }
        } catch (err) {
            // The credit stays claimed for this job's UTR; an admin can still approve it
            logger.error(`[payJob:UPI] Settling job ${job._id} after bank match failed: ${err.message}`);
        }
    }

    emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', { jobId: job._id, status: pending.status, paymentStatus: 'PENDING_VERIFICATION' });
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_UPI_PENDING_VERIFICATION', jobId: job._id, amount: upiAmount });
    const { logAdminActivity } = require('../../helpers/adminActivity.helper');
    logAdminActivity(
        'JOB_UPDATED', 'JOB', job._id,
        'Job UPI payment awaiting verification',
        `Job #${String(job._id).slice(-6)}: ₹${upiAmount} paid by UPI (UTR ${utr}). Approve or reject it in Jobs.`,
        req.user._id
    );

    return successResponse(res, hideOtpsFor(pending, req.user.role), 'UPI payment submitted. It will be confirmed once the bank credit is verified.');
};

// ─── PATCH /api/v1/jobs/:id/pay ───────────────────────────────────────────────
exports.payJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { method, completionOtp, promoCode } = req.body;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Job is not completed yet', StatusCodes.BAD_REQUEST);
    if (job.payment?.status === 'PENDING_VERIFICATION') {
        return errorResponse(res, 'Your UPI payment for this job is being verified. Please wait for the confirmation.', StatusCodes.CONFLICT);
    }
    if (job.security?.completionOtp && !timingSafeEqual(job.security.completionOtp, completionOtp)) {
        return errorResponse(res, 'Invalid Completion OTP', StatusCodes.BAD_REQUEST);
    }

    if (method === 'UPI') return submitUpiJobPayment(req, res, job);

    // P0 FIX: Atomic claim — exactly ONE concurrent payment wins.
    // Without this, two parallel requests both read status COMPLETED and both settle
    // (worker credited twice, ledger duplicated).
    const claimed = await Job.findOneAndUpdate(
        { _id: job._id, status: 'COMPLETED', 'payment.status': { $ne: 'PENDING_VERIFICATION' } },
        { status: 'PAID' },
        { returnDocument: 'after' }
    );
    if (!claimed) {
        return errorResponse(res, 'Payment is already being processed or has already been completed for this job', StatusCodes.CONFLICT);
    }
    let claimReverted = false;
    job.status = 'PAID';

    let platformFee = job.payment?.platformFee || 0;
    const gst = job.payment?.gst || 0;
    let promoDiscount = 0;

    // Validate and apply promo code
    if (promoCode) {
        const promoResult = await claimJobPromo({ job, promoCode, userId: req.user._id });
        if (promoResult.error) {
            // Release the PAID claim taken above so the customer can retry without the code
            await Job.findOneAndUpdate({ _id: job._id, status: 'PAID' }, { status: 'COMPLETED' });
            return errorResponse(res, promoResult.error, StatusCodes.BAD_REQUEST);
        }
        promoDiscount = promoResult.discount;
    }


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
        const WalletTxn = require('../wallet/wallet.model');
        const { recordPromoCost } = require('../adminWallet/adminWallet.service');
        const worker = await Customer.findById(job.workerId).session(session);

        if (worker) {
            if (method === 'CASH') {
                const feeToDeduct = (platformFee + gst) - promoDiscount;
                if (feeToDeduct > 0) {
                    const updated = await Customer.findOneAndUpdate(
                        { _id: worker._id, 'wallet.balance': { $gte: feeToDeduct } },
                        { $inc: { 'wallet.balance': -feeToDeduct } },
                        { returnDocument: 'after', session }
                    );
                    if (!updated) {
                        const debtUpdated = await Customer.findOneAndUpdate(
                            { _id: worker._id, 'wallet.balance': { $gt: -500 } },
                            { $inc: { 'wallet.balance': -feeToDeduct } },
                            { returnDocument: 'after', session }
                        );
                        if (!debtUpdated) {
                            // Worker is already at the -₹500 credit limit: collecting the fee is
                            // impossible, so refuse cash instead of silently waiving it.
                            throw Object.assign(
                                new Error('This worker has reached their credit limit and cannot accept cash. Please pay from your Kwickly wallet.'),
                                { statusCode: StatusCodes.PAYMENT_REQUIRED }
                            );
                        }
                        if (debtUpdated.wallet?.balance < 0) {
                            await Customer.findByIdAndUpdate(worker._id, { isOnline: false }, { session });
                            emitToRoom(`worker_${worker._id}`, 'FORCED_OFFLINE', {
                                reason: 'Negative wallet balance from cash job fee. Please top-up to continue receiving jobs.',
                                walletBalance: debtUpdated.wallet.balance
                            });
                        }
                        await WalletTxn.create([{
                            userId: worker._id, type: 'JOB_DEBIT', amount: feeToDeduct,
                            balance: debtUpdated.wallet.balance,
                            refId: job._id.toString(), status: 'COMPLETED',
                            description: `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                        }], { session });
                    } else {
                        await WalletTxn.create([{
                            userId: worker._id, type: 'JOB_DEBIT', amount: feeToDeduct,
                            balance: updated.wallet.balance,
                            refId: job._id.toString(), status: 'COMPLETED',
                            description: `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                        }], { session });
                    }
                }
                // Book the fee as revenue and the GST as a liability, with a ledger entry,
                // exactly like online jobs (the worker paid it from their wallet above).
                const { settleCashJob } = require('../../helpers/settlementEngine.helper');
                await settleCashJob({ job, session });
                // The worker was charged fee + GST less the promo, so the platform funds the promo.
                if (promoDiscount > 0) {
                    await recordPromoCost(
                        promoDiscount,
                        `Promo ${job.promoCode} discount on cash job #${job._id.toString().slice(-6)}`,
                        job._id,
                        'Job',
                        { workerId: job.workerId, customerId: job.customerId, method },
                        { session }
                    );
                }
            } else {
                // Online settlement via Centralized Settlement Engine (100% to worker, fee to treasury, GST to tax ledger)
                // P0 FIX: Actually debit the customer's wallet — funds must come from somewhere.
                const customerTotal = promoDiscount > 0
                    ? Math.max(0, (job.payment?.amount || 0) - promoDiscount)
                    : Number(job.payment?.amount || 0);

                if (customerTotal > 0) {
                    const debited = await Customer.findOneAndUpdate(
                        { _id: job.customerId, 'wallet.balance': { $gte: customerTotal } },
                        { $inc: { 'wallet.balance': -customerTotal } },
                        { returnDocument: 'after', session }
                    );
                    if (!debited) {
                        if (useTransaction && session) await session.abortTransaction();
                        if (session) session.endSession();
                        // Roll back the payment claim so the customer can retry after topping up
                        await Job.findByIdAndUpdate(job._id, { status: 'COMPLETED' });
                        claimReverted = true;
                        return errorResponse(res, `Insufficient wallet balance. ₹${customerTotal} required to pay for this job. Please top up your wallet.`, StatusCodes.PAYMENT_REQUIRED);
                    }
                    await WalletTxn.create([{
                        userId: job.customerId, type: 'JOB_PAYMENT', amount: customerTotal,
                        balance: debited.wallet.balance + customerTotal,
                        balanceAfter: debited.wallet.balance,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: `Payment for Service Job #${job._id.toString().slice(-6)}${promoDiscount > 0 ? ` (promo discount ₹${promoDiscount})` : ''}`
                    }], { session });
                }

                // The settlement engine books the platform fee to the treasury; collecting it
                // again here would count the same fee twice.
                const { settleJobCompletion } = require('../../helpers/settlementEngine.helper');
                await settleJobCompletion({ job, session });

                // The worker is still paid the full quote, so a promo discount is funded by the platform.
                if (promoDiscount > 0) {
                    await recordPromoCost(
                        promoDiscount,
                        `Promo ${job.promoCode} discount on job #${job._id.toString().slice(-6)}`,
                        job._id,
                        'Job',
                        { workerId: job.workerId, customerId: job.customerId, method },
                        { session }
                    );
                }
            }
        }

        job.status = 'PAID';
        if (!job.payment) job.payment = {};
        job.payment.status = 'PAID';
        job.payment.method = method === 'CASH' ? 'CASH' : 'WALLET';
        job.payment.escrowStatus = 'SETTLED';
        job.security = { ...job.security, completionOtp: undefined };
        await job.save({ session });

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

        await delCache(`session:${job.workerId}`);
        emitToRoom(`worker_${job.workerId}`, 'JOB_PAID', { jobId: job._id });
        emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

        notifyUser({
            userId: job.workerId,
            title: 'Payment Received',
            message: `You have received payment for job #${String(job._id).slice(-6)}.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'WORKER'
        });

        return successResponse(res, hideOtpsFor(job, req.user.role), 'Payment completed successfully');
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        // Roll back the payment claim so a transient failure doesn't strand the job as PAID-unpaid
        if (!claimReverted) {
            try { await Job.findByIdAndUpdate(job._id, { status: 'COMPLETED' }); } catch (e) { /* best-effort revert */ }
        }
        throw error;
    }
});

// ─── POST /api/v1/jobs/:id/verify-payment (Admin) ────────────────────────────
// Admin confirms that a job's direct-UPI payment (UTR) reached the bank account.
exports.verifyJobPayment = catchAsync(async (req, res) => {
    const exists = await Job.exists({ _id: req.params.id });
    if (!exists) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    const result = await confirmJobUpiPayment({ jobId: req.params.id, how: `approved by admin ${req.user._id}` });
    if (!result.confirmed) {
        return errorResponse(res, `This payment is not awaiting verification (current status: ${result.job?.payment?.status || 'unknown'})`, StatusCodes.CONFLICT);
    }
    return successResponse(res, result.job, 'UPI payment approved and job settled');
});

// ─── POST /api/v1/jobs/:id/reject-payment (Admin) ────────────────────────────
// The UTR could not be verified: the job stays COMPLETED with payment PENDING so
// the customer can pay again, and any promo use taken for it is given back.
exports.rejectJobPayment = catchAsync(async (req, res) => {
    const reason = String(req.body?.reason || 'The UPI payment could not be verified').trim().slice(0, 200);

    const before = await Job.findOneAndUpdate(
        { _id: req.params.id, status: 'COMPLETED', 'payment.status': 'PENDING_VERIFICATION' },
        { $set: { 'payment.status': 'PENDING' }, $unset: { 'payment.utrNumber': 1, 'payment.upiAmount': 1, promoCode: 1, promoDiscount: 1 } },
        { returnDocument: 'before' }
    );
    if (!before) {
        const current = await Job.findById(req.params.id).select('payment.status').lean();
        if (!current) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
        return errorResponse(res, `This payment is not awaiting verification (current status: ${current.payment?.status || 'unknown'})`, StatusCodes.CONFLICT);
    }
    await releaseJobPromo(before);

    emitToRoom(`customer_${before.customerId}`, 'JOB_STATUS_CHANGED', { jobId: before._id, status: 'COMPLETED', paymentStatus: 'PENDING' });
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_PAYMENT_REJECTED', jobId: before._id });
    notifyUser({
        userId: before.customerId,
        title: 'UPI Payment Not Verified',
        message: `Your UPI payment for job #${String(before._id).slice(-6)} (UTR ${before.payment?.utrNumber || '-'}) could not be verified: ${reason}. Please pay again.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: before._id,
        targetRole: 'CUSTOMER'
    });

    const job = await Job.findById(before._id).lean();
    return successResponse(res, job, `Payment rejected (${reason})`);
});

// ─── POST /api/v1/jobs/:id/rate ─────────────────────────────────────────────
exports.rateJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { score, review } = req.body;

    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
        return errorResponse(res, 'Rating score must be an integer between 1 and 5', StatusCodes.BAD_REQUEST);
    }

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);
    if (!['COMPLETED', 'PAID'].includes(job.status)) {
        return errorResponse(res, 'Only completed jobs can be rated', StatusCodes.BAD_REQUEST);
    }
    if (job.rating?.score) {
        return errorResponse(res, 'Job has already been rated', StatusCodes.CONFLICT);
    }

    job.rating = { score, review, createdAt: new Date() };
    // B2 FIX: Transition PAID → CLOSED to complete the lifecycle
    if (job.status === 'PAID') {
        job.status = 'CLOSED';
    }
    await job.save();
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

    if (job.workerId) {
        const worker = await Customer.findById(job.workerId);
        if (worker) {
            const total = worker.rating.average * worker.rating.count;
            worker.rating.count += 1;
            worker.rating.average = parseFloat(((total + score) / worker.rating.count).toFixed(2));
            await worker.save();
            await delCache(`session:${job.workerId}`);
            
            notifyUser({
                userId: job.workerId,
                title: '⭐ New Rating Received',
                message: `You received a ${score}-star rating for your recent job.`,
                action: 'RATING_RECEIVED',
                entityType: 'JOB',
                entityId: job._id,
                targetRole: 'WORKER'
            });
        }
    }

    // B2 FIX: Notify admin dashboard that the job lifecycle is fully complete
    if (job.status === 'CLOSED') {
        triggerDashboardUpdate({ type: 'JOB_CLOSED', id: job._id });
    }

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Job rated successfully');
});

// ─── POST /api/v1/jobs/:id/rate-customer (WORKER rates CUSTOMER) ─────────────
// M2 FIX: Workers can now rate customers.
exports.rateCustomer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { score, review } = req.body;

    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
        return errorResponse(res, 'Rating score must be an integer between 1 and 5', StatusCodes.BAD_REQUEST);
    }

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found or unauthorized', StatusCodes.NOT_FOUND);
    if (!['COMPLETED', 'PAID', 'CLOSED'].includes(job.status)) {
        return errorResponse(res, 'Job must be completed before rating the customer', StatusCodes.BAD_REQUEST);
    }
    if (job.customerRating?.score) {
        return errorResponse(res, 'You have already rated this customer', StatusCodes.CONFLICT);
    }

    job.customerRating = { score, review, createdAt: new Date() };
    await job.save();
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_STATUS_CHANGED', jobId: job._id, status: job.status });

    const customer = await Customer.findById(job.customerId);
    if (customer) {
        if (!customer.customerRating) customer.customerRating = { average: 0, count: 0 };
        const total = (customer.customerRating.average || 0) * (customer.customerRating.count || 0);
        customer.customerRating.count = (customer.customerRating.count || 0) + 1;
        customer.customerRating.average = parseFloat(
            ((total + score) / customer.customerRating.count).toFixed(2)
        );
        await customer.save();
    }

    notifyUser({
        userId: job.customerId,
        title: '\u2b50 You Received a Review',
        message: `Your service provider left a ${score}-star review for job #${String(job._id).slice(-6)}.`,
        action: 'OTHER',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Customer rated successfully');
});


// ─── PATCH /api/v1/jobs/:id/cancel ───────────────────────────────────
exports.cancelJob = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    if (req.user.role === 'CUSTOMER' && String(job.customerId) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    const forbiddenStates = ['IN_PROGRESS', 'COMPLETED', 'PAID', 'CLOSED', 'CANCELLED', 'DISPUTED'];
    if (forbiddenStates.includes(job.status)) {
        return errorResponse(res, `Job cannot be cancelled because it is already ${job.status.toLowerCase()}`, StatusCodes.BAD_REQUEST);
    }

    const previousStatus = job.status;
    job.status = 'CANCELLED';
    job.cancelReason = req.body?.reason || (req.user.role === 'CUSTOMER' ? 'Cancelled by customer' : 'Cancelled by admin');
    await job.save();

    await delCache(`job:${job._id}:assigned_worker`);
    await delCache(`job:${job._id}:eligible_workers`);  // S7 FIX: clean up stale worker list cache
    await delCache('admin_dashboard_stats');
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_CANCELLED', id: job._id });

    if (job.customerId) {
        notifyUser({
            userId: job.customerId,
            title: 'Job Cancelled',
            message: `Your request for ${job.category || 'Service'} (#${String(job._id).slice(-6)}) has been cancelled successfully.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'CUSTOMER'
        });
    }

    if (job.workerId) { // ALLOCATED or ARRIVING
        emitToRoom(`worker_${job.workerId}`, 'JOB_STATUS_CHANGED', { 
            jobId: job._id, 
            status: 'CANCELLED', 
            reason: req.user.role === 'CUSTOMER' ? 'Cancelled by customer' : 'Cancelled by admin'
        });

        notifyUser({
            userId: job.workerId,
            title: 'Job Cancelled',
            message: `Job #${String(job._id).slice(-6)} (${job.category || 'Service'}) assigned to you was cancelled by the customer.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'WORKER'
        });
    } else if (previousStatus === 'QUOTES_RECEIVED' || previousStatus === 'BROADCASTING') {
        // Find if anyone quoted and notify them
        const Quote = require('../quote/quote.model');
        const quotes = await Quote.find({ jobId: job._id }).lean();
        quotes.forEach(q => {
            emitToRoom(`worker_${q.workerId}`, 'JOB_STATUS_CHANGED', { 
                jobId: job._id, 
                status: 'CANCELLED', 
                reason: req.user.role === 'CUSTOMER' ? 'Cancelled by customer' : 'Cancelled by admin'
            });
            notifyUser({
                userId: q.workerId,
                title: 'Job Cancelled',
                message: `Job #${String(job._id).slice(-6)} (${job.category || 'Service'}) you bid on was cancelled by the customer.`,
                action: 'JOB_UPDATED',
                entityType: 'JOB',
                entityId: job._id,
                targetRole: 'WORKER'
            });
        });
    }

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Job cancelled successfully');
});

// ─── PATCH /api/v1/jobs/:id/reassign (Admin) ─────────────────────────────────
exports.reassignWorker = catchAsync(async (req, res) => {
    const { workerId } = req.body;
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    // S6 FIX: Generate fresh OTPs — old ones are now cryptographically dead
    const newArrivalOtp    = crypto.randomInt(OTP_MIN, OTP_MAX).toString();
    const newCompletionOtp = crypto.randomInt(OTP_MIN, OTP_MAX).toString();

    job.workerId = workerId;
    job.status   = 'ALLOCATED';
    job.security = { arrivalOtp: newArrivalOtp, completionOtp: newCompletionOtp };
    await job.save();

    await delCache(`job:${job._id}:assigned_worker`);
    await setCache(`job:${job._id}:assigned_worker`, String(workerId), 7200);

    triggerDashboardUpdate({ type: 'WORKER_REASSIGNED', id: job._id });

    if (job.customerId) {
        notifyUser({
            userId: job.customerId,
            title: 'Worker Reassigned',
            message: `A new worker has been assigned to your job #${String(job._id).slice(-6)} by the admin.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'CUSTOMER'
        });
    }

    // S6 FIX: Deliver fresh OTPs to new worker via real-time socket
    emitToRoom(`worker_${workerId}`, 'QUOTE_ACCEPTED', {
        jobId:      job._id,
        arrivalOtp: newArrivalOtp,
        amount:     job.payment?.workerPayout || job.payment?.amount,
        address:    job.addressDetails
    });
    notifyUser({
        userId: workerId,
        title: 'New Job Assigned By Admin',
        message: `You have been assigned to job #${String(job._id).slice(-6)} by admin. Check app for OTP.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'WORKER'
    });

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Worker reassigned successfully');
});

// ─── POST /api/v1/jobs/:id/report-partial-payment ─────────────────────────────
//
// LOOPHOLE FIX #9 — Partial Cash Payment (Worker Short-Changing)
//   If a customer pays less than the agreed amount, the worker can report it
//   This shifts the job to DISPUTED status and freezes the commission deduction
exports.reportPartialPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { amountReceived, reason } = req.body;

    if (!amountReceived || amountReceived <= 0) {
        return errorResponse(res, 'Please provide the amount you actually received', StatusCodes.BAD_REQUEST);
    }

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Only completed jobs can be reported as partial payment', StatusCodes.BAD_REQUEST);
    if (job.payment?.status === 'PAID') return errorResponse(res, 'Job has already been paid', StatusCodes.BAD_REQUEST);
    if (job.payment?.status === 'PENDING_VERIFICATION') return errorResponse(res, "The customer's UPI payment for this job is being verified", StatusCodes.BAD_REQUEST);

    const agreedAmount = job.payment?.amount || 0;
    const shortAmount = agreedAmount - amountReceived;

    if (shortAmount <= 0) {
        return errorResponse(res, 'Amount received is equal to or greater than the agreed amount. Use normal payment flow instead.', StatusCodes.BAD_REQUEST);
    }

    // Mark job as DISPUTED — freezes commission deduction
    job.status = 'DISPUTED';
    // Store dispute info on the job
    job.dispute = {
        reportedBy: 'WORKER',
        amountReceived,
        shortAmount,
        reason: reason || 'Customer paid less than agreed amount',
        reportedAt: new Date(),
        status: 'OPEN'
    };
    await job.save();
    await delCache('admin_badge_counts');

    // Notify admin and customer
    emitToRoom('admin_dashboard', 'DASHBOARD_UPDATE', {
        type: 'NEW_DISPUTE',
        id: job._id,
        category: job.category,
        disputeReason: 'Partial Payment'
    });
    emitToRoom(`customer_${job.customerId}`, 'JOB_DISPUTED', {
        jobId: job._id,
        message: 'The worker has reported a partial payment dispute. Admin will review shortly.'
    });

    return successResponse(res, {
        jobId: job._id,
        status: 'DISPUTED',
        amountReceived,
        shortAmount,
        message: `Dispute reported. The remaining ₹${shortAmount} has been flagged. Admin will review and mediate.`
    }, 'Partial payment reported. Admin notified.');
});

// ─── PATCH /api/v1/jobs/:id/resolve-dispute (Admin) ──────────────────────────
exports.resolveDispute = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { resolution, adminNote } = req.body; // resolution: 'DEDUCT_FROM_WORKER' | 'WAIVE_FEE' | 'REFUND_CUSTOMER' | 'CLOSE'

    const job = await Job.findById(id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'DISPUTED') return errorResponse(res, 'Job is not in disputed status', StatusCodes.BAD_REQUEST);

    const dispute = job.dispute;
    if (!dispute) return errorResponse(res, 'No dispute found on this job', StatusCodes.NOT_FOUND);

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
        const WalletTxn = require('../wallet/wallet.model');

        if (resolution === 'DEDUCT_FROM_WORKER') {
            // Charge commission from the amount they actually received
            const actualAmount = dispute.amountReceived || 0;
            const platformFee = job.payment?.platformFee || 0;
            const gst = job.payment?.gst || 0;
            const totalFee = platformFee + gst;

            // Only charge proportionate fee on what was received
            const actualFee = Math.min(totalFee, Math.round(actualAmount * (totalFee / job.payment?.amount || 1)));

            await Customer.findByIdAndUpdate(job.workerId, { $inc: { 'wallet.balance': -actualFee } }, { session });
            await WalletTxn.create([{
                userId: job.workerId, type: 'JOB_DEBIT', amount: actualFee,
                refId: job._id.toString(), status: 'COMPLETED',
                description: `Partial fee for disputed job #${job._id.toString().slice(-6)} (worker received ₹${actualAmount})`
            }], { session });

            job.status = 'CLOSED';
            job.payment.status = 'PAID';
        } else if (resolution === 'WAIVE_FEE') {
            // Platform waives the commission — worker keeps what they got
            job.status = 'CLOSED';
            job.payment.status = 'PAID';
        } else if (resolution === 'REFUND_CUSTOMER') {
            // Refund customer from worker's wallet
            if (dispute.shortAmount > 0) {
                await Customer.findByIdAndUpdate(job.customerId, { $inc: { 'wallet.balance': dispute.shortAmount } }, { session });
                await WalletTxn.create([{
                    userId: job.customerId, type: 'REFUND', amount: dispute.shortAmount,
                    refId: job._id.toString(), status: 'COMPLETED',
                    description: `Refund for partial payment dispute on job #${job._id.toString().slice(-6)}`
                }], { session });
            }
            job.status = 'CLOSED';
            job.payment.status = 'REFUNDED';
        } else {
            // CLOSE — just close without financial action
            job.status = 'CLOSED';
        }

        job.dispute.resolution = resolution;
        job.dispute.adminNote = adminNote || '';
        job.dispute.resolvedAt = new Date();
        job.dispute.status = 'RESOLVED';
        await job.save({ session });

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

        emitToRoom(`worker_${job.workerId}`, 'DISPUTE_RESOLVED', { jobId: job._id, resolution });
        emitToRoom(`customer_${job.customerId}`, 'DISPUTE_RESOLVED', { jobId: job._id, resolution });
        // S5 FIX: Update admin dashboard so dispute count decreases in real-time
        triggerDashboardUpdate({ type: 'DISPUTE_RESOLVED', id: job._id, resolution });

        return successResponse(res, hideOtpsFor(job, req.user.role), `Dispute resolved: ${resolution}`);
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// ─── GET /api/v1/jobs/:id/receipt ─────────────────────────────────────────────
exports.getJobReceipt = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('customerId', 'name phone email location')
        .populate('workerId', 'name phone email kyc')
        .lean();

    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    // Authorization check
    const isOwner = (req.user.role === 'CUSTOMER' && String(job.customerId._id) === String(req.user._id)) ||
                    (req.user.role === 'WORKER' && String(job.workerId?._id) === String(req.user._id));
    if (req.user.role !== 'ADMIN' && !isOwner) {
        return errorResponse(res, 'Forbidden to view this receipt', StatusCodes.FORBIDDEN);
    }

    if (!['COMPLETED', 'PAID', 'CLOSED'].includes(job.status)) {
        return errorResponse(res, 'Receipts are only available for completed or paid jobs', StatusCodes.BAD_REQUEST);
    }

    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();
    const gstPercentage = settings?.fees?.gstPercentage || 18;

    const receipt = {
        invoiceId: `INV-${String(job._id).toUpperCase().slice(-8)}`,
        date: job.payment?.status === 'PAID' ? job.updatedAt : job.completionDetails?.completedAt,
        status: job.payment?.status || 'PENDING',
        customer: {
            name: job.customerId?.name,
            phone: job.customerId?.phone,
            address: job.addressDetails?.fullAddress
        },
        worker: {
            name: job.workerId?.name,
            phone: job.workerId?.phone
        },
        jobDetails: {
            category: job.category,
            description: job.description
        },
        breakdown: {
            baseFare: job.payment?.workerPayout || 0,
            platformFee: job.payment?.platformFee || 0,
            gstPercentage: gstPercentage,
            gstAmount: job.payment?.gst || 0,
            totalAmount: job.payment?.amount || 0
        }
    };

    return successResponse(res, receipt, 'Job receipt generated successfully');
});

// ─── GET /api/v1/jobs/disputes (Admin) ───────────────────────────────────────
exports.getDisputes = catchAsync(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    const total = await Job.countDocuments({ status: 'DISPUTED' });
    const disputes = await Job.find({ status: 'DISPUTED' })
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-updatedAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

    return successResponse(res, { disputes, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Disputes fetched');
});

// ─── GET /api/v1/jobs/:id (Job detail) ──────────────────────────────────────
exports.getJobById = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('customerId', 'name phone profileImage')
        .populate('workerId', 'name phone profileImage rating activeLocation')
        .lean();

    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    if (req.user.role === 'CUSTOMER' && String(job.customerId._id) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }
    if (req.user.role === 'WORKER' && String(job.workerId?._id) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Job fetched');
});

// ─── POST /api/v1/jobs/upload-media ─────────────────────────────────────────
exports.uploadMedia = catchAsync(async (req, res) => {
    if (!req.file) return errorResponse(res, 'No file uploaded', StatusCodes.BAD_REQUEST);

    const result = await uploadImage(req.file.buffer, 'kwickly/jobs');
    return successResponse(res, { url: result.url }, 'Media uploaded');
});

// ─── POST /api/v1/jobs/:id/request-cash-payment (Customer) ────────────────────
// Customer initiates Cash Payment handshake by submitting the 4-digit completion OTP.
// Job enters payment.status = 'PENDING_CONFIRMATION', notifying the worker to verify & confirm receipt.
exports.requestCashPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { completionOtp, promoCode } = req.body;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Job is not completed yet', StatusCodes.BAD_REQUEST);
    if (job.payment?.status === 'PAID') return errorResponse(res, 'Job has already been paid', StatusCodes.CONFLICT);
    if (job.payment?.status === 'PENDING_VERIFICATION') {
        return errorResponse(res, 'Your UPI payment for this job is currently being verified.', StatusCodes.CONFLICT);
    }
    if (job.security?.completionOtp && !timingSafeEqual(job.security.completionOtp, completionOtp)) {
        return errorResponse(res, 'Invalid Completion OTP', StatusCodes.BAD_REQUEST);
    }

    // Verify worker credit limit: worker cannot accept cash if balance <= -500
    const worker = await Customer.findById(job.workerId).select('wallet isOnline name').lean();
    if (!worker || (worker.wallet?.balance || 0) <= -500) {
        return errorResponse(res, 'This worker has reached their credit limit and cannot accept cash. Please pay from your Kwickly wallet or UPI.', StatusCodes.PAYMENT_REQUIRED);
    }

    let promoDiscount = 0;
    if (promoCode) {
        const promoResult = await claimJobPromo({ job, promoCode, userId: req.user._id });
        if (promoResult.error) return errorResponse(res, promoResult.error, StatusCodes.BAD_REQUEST);
        promoDiscount = promoResult.discount;
    }

    const customerTotal = Math.max(0, (job.payment?.amount || 0) - promoDiscount);

    job.payment.status = 'PENDING_CONFIRMATION';
    job.payment.method = 'CASH';
    job.payment.cashPending = true;
    job.payment.cashRequestedAt = new Date();
    if (promoDiscount > 0) {
        job.promoCode = promoCode;
        job.promoDiscount = promoDiscount;
    }
    await job.save();

    emitToRoom(`worker_${job.workerId}`, 'CASH_PAYMENT_PENDING', {
        jobId: job._id,
        amount: customerTotal,
        customerName: req.user.name || 'Customer'
    });
    emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', {
        jobId: job._id,
        status: 'COMPLETED',
        paymentStatus: 'PENDING_CONFIRMATION',
        method: 'CASH'
    });
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_CASH_PENDING', jobId: job._id, amount: customerTotal });

    notifyUser({
        userId: job.workerId,
        title: '💵 Cash Payment Handshake',
        message: `Customer requested to pay ₹${customerTotal} in cash for job #${String(job._id).slice(-6)}. Please collect physical cash and tap 'Confirm Cash Received'.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'WORKER'
    });

    return successResponse(res, hideOtpsFor(job, req.user.role), `Cash payment requested. Please hand ₹${customerTotal} to your technician.`);
});

// ─── POST /api/v1/jobs/:id/confirm-cash-payment (Worker) ──────────────────────
// Worker confirms physical cash received in hand. Platform fee + GST debited from worker wallet,
// job marked PAID, and settled in PlatformLedger.
exports.confirmCashPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { completionOtp } = req.body;

    const job = await Job.findOne({ _id: id, workerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Only completed jobs can be settled', StatusCodes.BAD_REQUEST);
    if (job.payment?.status === 'PAID') return errorResponse(res, 'Job has already been paid', StatusCodes.CONFLICT);

    // If customer hadn't initiated handshake with OTP, worker must supply the 4-digit completionOtp
    if (!job.payment?.cashPending) {
        if (!completionOtp || !job.security?.completionOtp || !timingSafeEqual(job.security.completionOtp, completionOtp)) {
            return errorResponse(res, 'Invalid Completion OTP or cash payment was not initiated', StatusCodes.BAD_REQUEST);
        }
    }

    // Atomic status transition claim
    const claimed = await Job.findOneAndUpdate(
        { _id: job._id, status: 'COMPLETED', 'payment.status': { $ne: 'PAID' } },
        { status: 'PAID' },
        { returnDocument: 'after' }
    );
    if (!claimed) {
        return errorResponse(res, 'Payment is already being processed or completed for this job', StatusCodes.CONFLICT);
    }

    const platformFee = job.payment?.platformFee || 0;
    const gst = job.payment?.gst || 0;
    const promoDiscount = job.promoDiscount || 0;
    const feeToDeduct = (platformFee + gst) - promoDiscount;

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
        const WalletTxn = require('../wallet/wallet.model');
        const { recordPromoCost } = require('../adminWallet/adminWallet.service');
        const worker = await Customer.findById(job.workerId).session(session);

        if (feeToDeduct > 0 && worker) {
            const updated = await Customer.findOneAndUpdate(
                { _id: worker._id, 'wallet.balance': { $gte: feeToDeduct } },
                { $inc: { 'wallet.balance': -feeToDeduct } },
                { returnDocument: 'after', session }
            );
            if (!updated) {
                const debtUpdated = await Customer.findOneAndUpdate(
                    { _id: worker._id, 'wallet.balance': { $gt: -500 } },
                    { $inc: { 'wallet.balance': -feeToDeduct } },
                    { returnDocument: 'after', session }
                );
                if (!debtUpdated) {
                    if (useTransaction && session) await session.abortTransaction();
                    if (session) session.endSession();
                    await Job.findByIdAndUpdate(job._id, { status: 'COMPLETED' });
                    return errorResponse(res, 'Your wallet has reached the -₹500 credit limit. Please top up to confirm cash jobs.', StatusCodes.PAYMENT_REQUIRED);
                }
                if (debtUpdated.wallet?.balance < 0) {
                    await Customer.findByIdAndUpdate(worker._id, { isOnline: false }, { session });
                    emitToRoom(`worker_${worker._id}`, 'FORCED_OFFLINE', {
                        reason: 'Negative wallet balance from cash job fee. Please top-up to continue receiving jobs.',
                        walletBalance: debtUpdated.wallet.balance
                    });
                }
                await WalletTxn.create([{
                    userId: worker._id, type: 'JOB_DEBIT', amount: feeToDeduct,
                    balance: debtUpdated.wallet.balance,
                    refId: job._id.toString(), status: 'COMPLETED',
                    description: `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                }], { session });
            } else {
                await WalletTxn.create([{
                    userId: worker._id, type: 'JOB_DEBIT', amount: feeToDeduct,
                    balance: updated.wallet.balance,
                    refId: job._id.toString(), status: 'COMPLETED',
                    description: `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                }], { session });
            }
        }

        const { settleCashJob } = require('../../helpers/settlementEngine.helper');
        await settleCashJob({ job, session });

        if (promoDiscount > 0) {
            await recordPromoCost(
                promoDiscount,
                `Promo ${job.promoCode} discount on cash job #${job._id.toString().slice(-6)}`,
                job._id,
                'Job',
                { workerId: job.workerId, customerId: job.customerId, method: 'CASH' },
                { session }
            );
        }

        job.status = 'PAID';
        if (!job.payment) job.payment = {};
        job.payment.status = 'PAID';
        job.payment.method = 'CASH';
        job.payment.cashPending = false;
        job.payment.cashConfirmedAt = new Date();
        job.payment.escrowStatus = 'SETTLED';
        job.security = { ...job.security, completionOtp: undefined };
        await job.save({ session });

        if (useTransaction) await session.commitTransaction();
        if (session) session.endSession();

        await delCache(`session:${job.workerId}`);
        emitToRoom(`customer_${job.customerId}`, 'JOB_PAID', { jobId: job._id, method: 'CASH', paymentStatus: 'PAID' });
        emitToRoom(`worker_${job.workerId}`, 'JOB_PAID', { jobId: job._id, method: 'CASH', paymentStatus: 'PAID' });
        emitToAll('DASHBOARD_UPDATE', { type: 'JOB_SETTLED', jobId: job._id, status: 'PAID' });

        notifyUser({
            userId: job.customerId,
            title: '✅ Payment Confirmed',
            message: `Your technician has confirmed cash payment for job #${String(job._id).slice(-6)}. Thank you!`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'CUSTOMER'
        });

        return successResponse(res, hideOtpsFor(job, req.user.role), 'Cash payment confirmed and job settled successfully');
    } catch (err) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        await Job.findByIdAndUpdate(job._id, { status: 'COMPLETED' });
        throw err;
    }
});

// ─── POST /api/v1/jobs/:id/cancel-cash-payment (Customer) ────────────────────
// Customer cancels pending cash payment request to switch to UPI or Wallet.
exports.cancelCashPayment = catchAsync(async (req, res) => {
    const { id } = req.params;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Job is not completed', StatusCodes.BAD_REQUEST);
    if (job.payment?.status === 'PAID') return errorResponse(res, 'Job is already paid', StatusCodes.CONFLICT);

    job.payment.cashPending = false;
    job.payment.status = 'PENDING';
    job.payment.method = 'UPI';
    await job.save();

    emitToRoom(`worker_${job.workerId}`, 'JOB_STATUS_CHANGED', { jobId: job._id, status: 'COMPLETED', paymentStatus: 'PENDING' });
    emitToRoom(`customer_${job.customerId}`, 'JOB_STATUS_CHANGED', { jobId: job._id, status: 'COMPLETED', paymentStatus: 'PENDING' });

    return successResponse(res, hideOtpsFor(job, req.user.role), 'Cash payment request cancelled. You can now pay via UPI or Wallet.');
});
