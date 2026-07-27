const { StatusCodes } = require('http-status-codes');
const Job = require('./job.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const logger = require('../../helpers/logger.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll, emitToRoom } = require('../../helpers/socket.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { uploadImage } = require('../../services/cloudinary.service');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const { findEligibleWorkers } = require('../../helpers/worker.helper');
const { haversineDistance, calculateETA } = require('../../helpers/geo.helper');
const { MAX_ACTIVE_JOBS, MAX_AVAILABLE_JOBS, GEOFENCE_MAX_METERS, JOB_ELIGIBLE_WORKERS_TTL } = require('../../constants/business');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');
const crypto = require('crypto');

const timingSafeEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * â”€â”€â”€ WORKER ELIGIBILITY CRITERIA (ALL must be true) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  1. role === 'WORKER'
 *  2. isVerified === true
 *  3. kyc.status === 'APPROVED'
 *  4. isOnline === true
 *  5. Subscription valid (trial active OR expiryDate > now)
 *  6. wallet.balance >= minimumBalance (from settings, default â‚¹100)
 *  7. Worker has the job's CATEGORY in their active services
 *  8. Job location is within the WORKER'S OWN serviceRadius (not global maxKm)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

// â”€â”€â”€ POST /api/v1/jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Step 1: Load platform settings (Redis cached, 10 min TTL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const SettingsService = require('../settings/settings.service');
    const settings = await SettingsService.getAppSettings();

    if (settings?.maintenance?.mode) {
        const msg = settings.maintenance.message || 'The platform is currently undergoing maintenance. Please try again later.';
        return errorResponse(res, msg, StatusCodes.SERVICE_UNAVAILABLE);
    }
    const minBalance = settings?.wallet?.minimumBalance || 100;

    // Initial radius is the first round or maxKm
    const initialRadiusKm = settings?.radius?.rounds?.[0]?.maxKm || settings?.radius?.maxKm || 15;

    // Create the job
    let job;
    try {
        job = await Job.create({
            customerId: req.user._id,
            category,
            subcategory,
            description,
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

    // â”€â”€ Step 2 & 3: Find ALL eligible workers using server-side criteria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const eligibleWorkerIds = await findEligibleWorkers(job, initialRadiusKm, minBalance);

    // Update job to broadcast round 1
    job.broadcast.round = 1;
    await job.save();
    // â”€â”€ Step 4: Load customer info for the notification payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const customer = await Customer.findById(req.user._id)
        .select('name phone profileImage')
        .lean();

    const alertPayload = {
        jobId: job._id,
        category: job.category,
        subcategory: job.subcategory,
        description: job.description,
        location: job.location,
        addressDetails: job.addressDetails,
        timeSlot: job.timeSlot,
        preferredDate: job.preferredDate,
        notifiedWorkers: eligibleWorkerIds.length,
        customer: {
            _id: customer?._id,
            name: customer?.name,
            profileImage: customer?.profileImage
        }
    };

    // â”€â”€ Step 5: Emit ONLY to eligible workers' personal Socket.io rooms â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //
    // Each worker joins 'worker_{userId}' on app open.
    // We emit to EACH room individually â€” no broadcast-to-all.
    // Workers who are offline or haven't joined their room won't receive it.

    if (eligibleWorkerIds.length > 0) {
        eligibleWorkerIds.forEach(workerId => {
            emitToRoom(`worker_${workerId}`, 'NEW_JOB_ALERT', alertPayload);
        });
    }

    // â”€â”€ Step 6: Cache eligible worker IDs for this job (for quick re-broadcast) â”€
    //  Key: job:{jobId}:eligible_workers  TTL: 30 min (job broadcast window)
    await setCache(`job:${job._id}:eligible_workers`, eligibleWorkerIds, JOB_ELIGIBLE_WORKERS_TTL);

    // â”€â”€ Step 7: Invalidate admin dashboard cache + notify admin room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await delCache('admin_dashboard_stats');
    await delCache('admin_badge_counts');
    emitToRoom('admin_dashboard', 'DASHBOARD_UPDATE', {
        type: 'NEW_JOB',
        id: job._id,
        category: job.category,
        notifiedWorkers: eligibleWorkerIds.length
    });

    // â”€â”€ Notify customer that job was posted successfully â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    notifyUser({
        userId: req.user._id,
        title: 'âœ… Job Posted Successfully',
        message: `Your ${job.category} job has been posted. We're finding the best workers for you!`,
        action: 'JOB_CREATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(
        res,
        { ...job.toObject(), notifiedWorkers: eligibleWorkerIds.length },
        `Job created. ${eligibleWorkerIds.length} eligible worker(s) notified.`,
        StatusCodes.CREATED
    );
});


// â”€â”€â”€ GET /api/v1/jobs (Admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ GET /api/v1/jobs/my (Customer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ GET /api/v1/jobs/available (Worker) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Returns jobs that the requesting worker is eligible to bid on.
// All 8 eligibility criteria are enforced here as well.
exports.getAvailableJobs = catchAsync(async (req, res) => {
    // â”€â”€ Fetch worker with populated category names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const worker = await Customer.findById(req.user._id)
        .populate('services.category', 'name')
        .lean();

    if (!worker) {
        return errorResponse(res, 'Worker not found', StatusCodes.NOT_FOUND);
    }

    // â”€â”€ Criteria 3: KYC approved â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (worker.kyc?.status !== 'APPROVED') {
        return errorResponse(
            res,
            'Your KYC is not approved yet. Please upload your documents and wait for admin review.',
            StatusCodes.FORBIDDEN
        );
    }

    // â”€â”€ Criteria 4: Online â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!worker.isOnline) {
        return errorResponse(
            res,
            'You must be online to view available jobs. Toggle your online status.',
            StatusCodes.FORBIDDEN
        );
    }

    // â”€â”€ Criteria 5: Subscription valid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Criteria 6: Wallet balance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const minBalance = settings?.wallet?.minimumBalance || 100;
    if ((worker.wallet?.balance || 0) < minBalance) {
        return errorResponse(
            res,
            `Minimum wallet balance of â‚¹${minBalance} is required to view jobs. Please top up.`,
            StatusCodes.PAYMENT_REQUIRED
        );
    }

    // â”€â”€ Criteria 7: Active service categories (worker's own selection) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Criteria 8: Worker's own serviceRadius + location check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Exclude jobs this worker has already quoted on â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const Quote = require('../quote/quote.model');
    const quotedJobIds = await Quote.distinct('jobId', { workerId: req.user._id });

    // â”€â”€ Fetch active jobs matching worker's categories within their radius â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Attach distance info to each job (for display in worker's app) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [wLng, wLat] = workerCoords;
    const jobsWithDistance = jobs.map(job => {
        const [jLng, jLat] = job.location?.coordinates || [0, 0];
        const distanceKm = parseFloat(haversineDistance([wLng, wLat], [jLng, jLat]).toFixed(2));
        const etaMins = calculateETA(distanceKm);
        return { ...job, distanceKm, etaMins };
    });

    // Sort by distance (nearest first)
    jobsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return successResponse(
        res,
        jobsWithDistance,
        `${jobsWithDistance.length} available job(s) found within ${workerRadiusKm} km`
    );
});

// â”€â”€â”€ GET /api/v1/jobs/worker (Worker's own jobs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ PATCH /api/v1/jobs/:id/start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// LOOPHOLE FIX #3 â€” GPS Spoofing Mitigation
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

    // GPS Spoofing Check: Geofence verification (â‰¤200 meters)
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
    job.security = { ...job.security, arrivalOtp: undefined };
    await job.save();

    emitToRoom(`customer_${job.customerId}`, 'JOB_STARTED', { jobId: job._id });
    emitToRoom(`worker_${job.workerId}`, 'START_TIMER', { jobId: job._id });

    notifyUser({
        userId: job.customerId,
        title: 'ðŸ› ï¸ Work Started',
        message: `The worker has started your ${job.category} job.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, job, 'Job started successfully');
});

// â”€â”€â”€ PATCH /api/v1/jobs/:id/complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    await delCache(`job:${job._id}:assigned_worker`);

    emitToRoom(`customer_${job.customerId}`, 'JOB_COMPLETED', { jobId: job._id });

    notifyUser({
        userId: job.customerId,
        title: 'âœ… Job Completed',
        message: `The worker has marked your ${job.category} job as completed. Please review and process payment.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'CUSTOMER'
    });

    return successResponse(res, job, 'Job completed successfully');
});

// â”€â”€â”€ PATCH /api/v1/jobs/:id/pay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.payJob = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { method, completionOtp, promoCode } = req.body;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Job is not completed yet', StatusCodes.BAD_REQUEST);
    if (job.security?.completionOtp && !timingSafeEqual(job.security.completionOtp, completionOtp)) {
        return errorResponse(res, 'Invalid Completion OTP', StatusCodes.BAD_REQUEST);
    }

    let platformFee = job.payment?.platformFee || 0;
    const workerPayout = job.payment?.workerPayout || 0;
    const gst = job.payment?.gst || 0;
    let promoDiscount = 0;

    // Validate and apply promo code
    if (promoCode) {
        const { Promotion } = require('../promotion/promotion.model');
        const promo = await Promotion.findOne({ code: promoCode.toUpperCase(), isActive: true });
        if (promo && (!promo.endAt || new Date(promo.endAt) > new Date())) {
            const amount = job.payment?.amount || 0;
            if (amount >= (promo.minOrderAmount || 0)) {
                if (promo.type === 'FLAT_DISCOUNT') promoDiscount = promo.value;
                if (promo.type === 'PERCENTAGE_DISCOUNT') promoDiscount = Math.round((amount * promo.value) / 100);
                if (promo.maxDiscountCap && promoDiscount > promo.maxDiscountCap) promoDiscount = promo.maxDiscountCap;
                if (promoDiscount > amount) promoDiscount = amount;

                // Track usage atomically with conditional check to prevent race condition
                const incremented = await Promotion.findOneAndUpdate(
                    { _id: promo._id, isActive: true, $or: [{ maxUses: { $exists: false } }, { maxUses: null }, { $expr: { $lt: ['$usesCount', '$maxUses'] } }] },
                    { $inc: { usesCount: 1 } },
                    { returnDocument: 'after' }
                );
                if (!incremented) {
                    return errorResponse(res, 'This promo code has reached its usage limit', StatusCodes.BAD_REQUEST);
                }

                // Save promo info on job
                job.promoCode = promoCode;
                job.promoDiscount = promoDiscount;
            }
        }
    }

    const adminTotalRevenue = (platformFee + gst) - promoDiscount;

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
        const worker = await Customer.findById(job.workerId).session(session);

        if (worker) {
            if (method === 'CASH') {
                // Worker got cash â€” Kwickly deducts commission from worker wallet
                const updated = await Customer.findOneAndUpdate(
                    { _id: worker._id, 'wallet.balance': { $gte: adminTotalRevenue } },
                    { $inc: { 'wallet.balance': -adminTotalRevenue } },
                    { returnDocument: 'after', session }
                );
                if (!updated) {
                    // LOOPHOLE FIX #1 â€” Cash Payment Evasion Mitigation
                    // Worker doesn't have enough balance â€” create debt record
                    const debtUpdated = await Customer.findOneAndUpdate(
                        { _id: worker._id, 'wallet.balance': { $gt: -500 } },
                        { $inc: { 'wallet.balance': -adminTotalRevenue } },
                        { returnDocument: 'after', session }
                    );

                    const txnType = adminTotalRevenue < 0 ? 'PROMO_CREDIT' : 'JOB_DEBIT';
                    
                    if (debtUpdated && debtUpdated.wallet?.balance < 0) {
                        await Customer.findByIdAndUpdate(worker._id, { isOnline: false }, { session });
                        logger.warn(`[Cash Evasion] Worker ${worker._id} locked offline â€” wallet at â‚¹${debtUpdated.wallet.balance}`);
                        emitToRoom(`worker_${worker._id}`, 'FORCED_OFFLINE', {
                            reason: 'Negative wallet balance from cash job. Please top-up to continue receiving jobs.',
                            walletBalance: debtUpdated.wallet.balance
                        });
                    }

                    await WalletTxn.create([{
                        userId: worker._id, type: txnType, amount: Math.abs(adminTotalRevenue),
                        balance: debtUpdated?.wallet?.balance || 0,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: adminTotalRevenue < 0 ? `Promo reimbursement for job #${job._id.toString().slice(-6)}` : `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                    }], { session });
                } else {
                    const txnType = adminTotalRevenue < 0 ? 'PROMO_CREDIT' : 'JOB_DEBIT';
                    await WalletTxn.create([{
                        userId: worker._id, type: txnType, amount: Math.abs(adminTotalRevenue),
                        balance: updated.wallet.balance,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: adminTotalRevenue < 0 ? `Promo reimbursement for job #${job._id.toString().slice(-6)}` : `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                    }], { session });
                }
            } else {
                const creditedWorker = await Customer.findByIdAndUpdate(worker._id, { $inc: { 'wallet.balance': workerPayout } }, { returnDocument: 'after', session });
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
        job.security = { ...job.security, completionOtp: undefined };
        await job.save({ session });

        // Collect platform fee inside the transaction so it's atomic with the payment
        const { collectPlatformFee } = require('../adminWallet/adminWallet.controller');
        await collectPlatformFee(
                adminTotalRevenue,
                `Platform fee + GST ${promoDiscount > 0 ? `(less â‚¹${promoDiscount} promo discount)` : ''} from job #${job._id.toString().slice(-6)} (${method})`,
                job._id,
                'Job',
                { workerId: job.workerId, customerId: job.customerId, method },
                { session }
            );

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

        await delCache(`session:${job.workerId}`);
        emitToRoom(`worker_${job.workerId}`, 'JOB_PAID', { jobId: job._id });

        notifyUser({
            userId: job.workerId,
            title: 'ðŸ’¸ Payment Received',
            message: `You have received payment for job #${String(job._id).slice(-6)}.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'WORKER'
        });

        return successResponse(res, job, 'Payment completed successfully');
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// â”€â”€â”€ POST /api/v1/jobs/:id/rate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            
            notifyUser({
                userId: job.workerId,
                title: 'â­ New Rating Received',
                message: `You received a ${score}-star rating for your recent job.`,
                action: 'RATING_RECEIVED',
                entityType: 'JOB',
                entityId: job._id,
                targetRole: 'WORKER'
            });
        }
    }

    return successResponse(res, job, 'Job rated successfully');
});

// â”€â”€â”€ PATCH /api/v1/jobs/:id/cancel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    await job.save();

    await delCache(`job:${job._id}:assigned_worker`);
    await delCache('admin_dashboard_stats');
    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_CANCELLED', id: job._id });

    if (job.customerId) {
        notifyUser({
            userId: job.customerId,
            title: 'âŒ Job Cancelled',
            message: `Your job #${String(job._id).slice(-6)} has been cancelled.`,
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
            title: 'âŒ Job Cancelled',
            message: `Job #${String(job._id).slice(-6)} assigned to you has been cancelled.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'WORKER'
        });
    } else if (previousStatus === 'QUOTES_RECEIVED' || previousStatus === 'BROADCASTING') {
        // Find if anyone quoted and notify them
        const Quote = require('../quote/quote.model');
        const quotes = await Quote.find({ jobId: job._id });
        quotes.forEach(q => {
            emitToRoom(`worker_${q.workerId}`, 'JOB_STATUS_CHANGED', { 
                jobId: job._id, 
                status: 'CANCELLED', 
                reason: req.user.role === 'CUSTOMER' ? 'Cancelled by customer' : 'Cancelled by admin'
            });
            notifyUser({
                userId: q.workerId,
                title: 'âŒ Job Cancelled',
                message: `Job #${String(job._id).slice(-6)} you bid on has been cancelled.`,
                action: 'JOB_UPDATED',
                entityType: 'JOB',
                entityId: job._id,
                targetRole: 'WORKER'
            });
        });
    }

    return successResponse(res, job, 'Job cancelled successfully');
});

// â”€â”€â”€ PATCH /api/v1/jobs/:id/reassign (Admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.reassignWorker = catchAsync(async (req, res) => {
    const { workerId } = req.body;
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    job.workerId = workerId;
    job.status = 'ALLOCATED';
    await job.save();

    // Invalidate old assignment cache and set new one
    await delCache(`job:${job._id}:assigned_worker`);
    await setCache(`job:${job._id}:assigned_worker`, String(workerId), 7200);

    emitToAll('DASHBOARD_UPDATE', { type: 'WORKER_REASSIGNED', id: job._id });

    if (job.customerId) {
        notifyUser({
            userId: job.customerId,
            title: 'ðŸ‘· Worker Reassigned',
            message: `A new worker has been assigned to your job #${String(job._id).slice(-6)} by the admin.`,
            action: 'JOB_UPDATED',
            entityType: 'JOB',
            entityId: job._id,
            targetRole: 'CUSTOMER'
        });
    }

    notifyUser({
        userId: workerId,
        title: 'ðŸ‘· New Job Assigned',
        message: `You have been manually assigned to job #${String(job._id).slice(-6)} by the admin.`,
        action: 'JOB_UPDATED',
        entityType: 'JOB',
        entityId: job._id,
        targetRole: 'WORKER'
    });

    return successResponse(res, job, 'Worker reassigned successfully');
});

// â”€â”€â”€ POST /api/v1/jobs/:id/report-partial-payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// LOOPHOLE FIX #9 â€” Partial Cash Payment (Worker Short-Changing)
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

    const agreedAmount = job.payment?.amount || 0;
    const shortAmount = agreedAmount - amountReceived;

    if (shortAmount <= 0) {
        return errorResponse(res, 'Amount received is equal to or greater than the agreed amount. Use normal payment flow instead.', StatusCodes.BAD_REQUEST);
    }

    // Mark job as DISPUTED â€” freezes commission deduction
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
        message: `Dispute reported. The remaining â‚¹${shortAmount} has been flagged. Admin will review and mediate.`
    }, 'Partial payment reported. Admin notified.');
});

// â”€â”€â”€ PATCH /api/v1/jobs/:id/resolve-dispute (Admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                description: `Partial fee for disputed job #${job._id.toString().slice(-6)} (worker received â‚¹${actualAmount})`
            }], { session });

            job.status = 'CLOSED';
            job.payment.status = 'PAID';
        } else if (resolution === 'WAIVE_FEE') {
            // Platform waives the commission â€” worker keeps what they got
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
            // CLOSE â€” just close without financial action
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

        return successResponse(res, job, `Dispute resolved: ${resolution}`);
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});

// â”€â”€â”€ GET /api/v1/jobs/:id/receipt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getJobReceipt = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('customerId', 'name phone email location')
        .populate('workerId', 'name phone email kyc')
        .lean();

    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    // Authorization check
    if (
        req.user.role === 'CUSTOMER' && String(job.customerId._id) !== String(req.user._id) ||
        req.user.role === 'WORKER' && String(job.workerId?._id) !== String(req.user._id)
    ) {
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

// â”€â”€â”€ GET /api/v1/jobs/disputes (Admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ GET /api/v1/jobs/:id (Job detail) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getJobById = catchAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('customerId', 'name phone profileImage')
        .populate('workerId', 'name phone profileImage rating')
        .lean();

    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);

    if (req.user.role === 'CUSTOMER' && String(job.customerId._id) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }
    if (req.user.role === 'WORKER' && String(job.workerId?._id) !== String(req.user._id)) {
        return errorResponse(res, 'Forbidden', StatusCodes.FORBIDDEN);
    }

    return successResponse(res, job, 'Job fetched');
});

// â”€â”€â”€ POST /api/v1/jobs/upload-media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.uploadMedia = catchAsync(async (req, res) => {
    if (!req.file) return errorResponse(res, 'No file uploaded', StatusCodes.BAD_REQUEST);

    const result = await uploadImage(req.file.buffer, 'kwickly/jobs');
    return successResponse(res, { url: result.url }, 'Media uploaded');
});
