const { StatusCodes } = require('http-status-codes');
const Job = require('./job.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const logger = require('../../helpers/logger.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { emitToAll, emitToRoom } = require('../../helpers/socket.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');

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

    // ── Step 1: Load platform settings (Redis cached, 10 min TTL) ──────────────
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }

    if (settings?.maintenance?.mode) {
        const msg = settings.maintenance.message || 'The platform is currently undergoing maintenance. Please try again later.';
        return errorResponse(res, msg, StatusCodes.SERVICE_UNAVAILABLE);
    }
    const minBalance = settings?.wallet?.minimumBalance || 100;

    // Initial radius is the first round or maxKm
    const initialRadiusKm = settings?.radius?.rounds?.[0]?.maxKm || settings?.radius?.maxKm || 15;

    // Create the job
    const job = await Job.create({
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

    const now = new Date();
    const [jobLng, jobLat] = location.coordinates;  // GeoJSON: [longitude, latitude]

    // ── Step 2: Find ALL eligible workers using server-side criteria ────────────

    const globalRadiusRadians = initialRadiusKm / 6371; // Earth radius 6371 km

    const workerQuery = {
        role: 'WORKER',
        isVerified: true,
        'kyc.status': 'APPROVED',
        isOnline: true,
        $or: [
            { 'subscription.isTrial': true },
            { 'subscription.expiryDate': { $gt: now } },
            { createdAt: { $gt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) } }
        ],
        'wallet.balance': { $gte: minBalance },
        activeLocation: {
            $geoWithin: {
                $centerSphere: [
                    location.coordinates,
                    globalRadiusRadians     // outer bound: current radius
                ]
            }
        }
    };

    if (targetCity) {
        workerQuery.city = { $regex: new RegExp('^' + targetCity + '$', 'i') }; // Case-insensitive exact match
    }

    // Fetch candidate workers within global max radius (coarse filter via index)
    const candidateWorkers = await Customer.find(workerQuery)
        .select('_id services serviceRadius activeLocation city')
        .lean();

    // ── Step 3: Fine-filter per worker — category match + own serviceRadius ─────
    //
    // MongoDB can't do per-document dynamic radius in a single query,
    // so we do the precise radius and category checks in JS (fast — only
    // workers already within globalMaxKm are in candidateWorkers array).

    const targetJobCategory = (category || '').trim().toLowerCase();

    const eligibleWorkerIds = candidateWorkers.filter(worker => {

        // ── Criteria 7: Category match ─────────────────────────────────────────
        // Worker must have an ACTIVE service whose category name matches the job
        const hasMatchingCategory = (worker.services || []).some(svc => {
            if (!svc.isActive) return false;
            // svc.category may be an ObjectId (not populated here) or a name string
            // We store it as ObjectId ref to Category, but we also match by name
            // stored in worker.services[].subcategories or directly.
            // Since we don't populate here, we match by the string field if present.
            // If category is stored as ObjectId, a separate pre-computed name cache
            // on the worker document is needed. We handle both cases:
            const catName = (svc.categoryName || svc.category?.name || '').toString().trim().toLowerCase();
            return catName === targetJobCategory;
        });

        if (!hasMatchingCategory) return false;

        // ── Criteria 8: Worker's OWN serviceRadius ─────────────────────────────
        const workerCoords = worker.activeLocation?.coordinates;
        if (!workerCoords || workerCoords.length !== 2) return false;

        const [wLng, wLat] = workerCoords;
        const workerRadiusKm = worker.serviceRadius || globalMaxKm;

        // Haversine distance calculation (km)
        const R = 6371;
        const dLat = ((jobLat - wLat) * Math.PI) / 180;
        const dLng = ((jobLng - wLng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((wLat * Math.PI) / 180) *
            Math.cos((jobLat * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return distanceKm <= workerRadiusKm; // Worker's own radius, not global
    }).map(w => w._id.toString());

    // ── Step 4: Load customer info for the notification payload ─────────────────
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

    // ── Step 5: Emit ONLY to eligible workers' personal Socket.io rooms ─────────
    //
    // Each worker joins 'worker_{userId}' on app open.
    // We emit to EACH room individually — no broadcast-to-all.
    // Workers who are offline or haven't joined their room won't receive it.

    if (eligibleWorkerIds.length > 0) {
        eligibleWorkerIds.forEach(workerId => {
            emitToRoom(`worker_${workerId}`, 'NEW_JOB_ALERT', alertPayload);
        });
    }

    // ── Step 6: Cache eligible worker IDs for this job (for quick re-broadcast) ─
    //  Key: job:{jobId}:eligible_workers  TTL: 30 min (job broadcast window)
    await setCache(`job:${job._id}:eligible_workers`, eligibleWorkerIds, 1800);

    // ── Step 7: Invalidate admin dashboard cache + notify admin room ────────────
    await delCache('admin_dashboard_stats');
    await delCache('admin_badge_counts');
    emitToRoom('admin_dashboard', 'DASHBOARD_UPDATE', {
        type: 'NEW_JOB',
        id: job._id,
        category: job.category,
        notifiedWorkers: eligibleWorkerIds.length
    });

    return successResponse(
        res,
        { ...job.toObject(), notifiedWorkers: eligibleWorkerIds.length },
        `Job created. ${eligibleWorkerIds.length} eligible worker(s) notified.`,
        StatusCodes.CREATED
    );
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

    // Fallback: 180 days from registration
    const isFallbackTrialActive = worker.createdAt && new Date(worker.createdAt).getTime() + 180 * 24 * 60 * 60 * 1000 > now.getTime();

    const isSubscriptionValid = isTrialActive || isPaidSubActive || isFallbackTrialActive;

    if (!isSubscriptionValid) {
        return errorResponse(
            res,
            'Your subscription has expired. Please purchase a plan to view and bid on jobs.',
            StatusCodes.PAYMENT_REQUIRED
        );
    }

    // ── Criteria 6: Wallet balance ──────────────────────────────────────────────
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
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

    // ── Criteria 8: Worker's own serviceRadius + location check ────────────────
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

    // ── Exclude jobs this worker has already quoted on ──────────────────────────
    const Quote = require('../quote/quote.model');
    const quotedJobIds = await Quote.distinct('jobId', { workerId: req.user._id });

    // ── Fetch active jobs matching worker's categories within their radius ──────
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
        query.$or = [
            { 'addressDetails.city': { $exists: false } },
            { 'addressDetails.city': null },
            { 'addressDetails.city': '' },
            { 'addressDetails.city': { $regex: new RegExp('^' + worker.city + '$', 'i') } }
        ];
    }

    const jobs = await Job.find(query)
        .populate('customerId', 'name phone profileImage')
        .sort('-createdAt')
        .limit(50)
        .lean();

    // ── Attach distance info to each job (for display in worker's app) ──────────
    const [wLng, wLat] = workerCoords;
    const jobsWithDistance = jobs.map(job => {
        const [jLng, jLat] = job.location?.coordinates || [0, 0];
        const R = 6371;
        const dLat = ((jLat - wLat) * Math.PI) / 180;
        const dLng = ((jLng - wLng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((wLat * Math.PI) / 180) *
            Math.cos((jLat * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const distanceKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
        const etaMins = Math.max(5, Math.ceil(distanceKm * 2) + 5);
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
//
// LOOPHOLE FIX #3 — GPS Spoofing Mitigation
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
    if (job.security?.arrivalOtp && job.security.arrivalOtp !== arrivalOtp) {
        return errorResponse(res, 'Invalid Arrival OTP', StatusCodes.BAD_REQUEST);
    }

    // ─── GPS Spoofing Check: Geofence verification (≤200 meters) ───────────────
    const GEOFENCE_MAX_METERS = 200;
    const jobCoords = job.location?.coordinates;
    if (currentCoordinates && currentCoordinates.length === 2 && jobCoords && jobCoords.length === 2) {
        const [jobLon, jobLat] = jobCoords;
        const [curLon, curLat] = currentCoordinates;
        const R = 6371000; // Earth radius in meters
        const dLat = ((curLat - jobLat) * Math.PI) / 180;
        const dLon = ((curLon - jobLon) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((jobLat * Math.PI) / 180) *
            Math.cos((curLat * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const distanceMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (distanceMeters > GEOFENCE_MAX_METERS) {
            return errorResponse(
                res,
                `You are ${Math.round(distanceMeters)}m away from the job location. Please arrive within ${GEOFENCE_MAX_METERS}m to start the job.`,
                StatusCodes.FORBIDDEN
            );
        }
    }
    // If no coordinates provided, still allow with arrival OTP (fallback)
    // but log a warning for admin auditing
    if (!currentCoordinates || currentCoordinates.length !== 2) {
        logger.warn(`[GPS Spoofing] Worker ${req.user._id} started job ${id} without location data`);
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
    const { method, completionOtp, promoCode } = req.body;

    const job = await Job.findOne({ _id: id, customerId: req.user._id });
    if (!job) return errorResponse(res, 'Job not found', StatusCodes.NOT_FOUND);
    if (job.status !== 'COMPLETED') return errorResponse(res, 'Job is not completed yet', StatusCodes.BAD_REQUEST);
    if (job.security?.completionOtp && job.security.completionOtp !== completionOtp) {
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
                if (promo.type === 'PERCENTAGE_DISCOUNT') promoDiscount = (amount * promo.value) / 100;
                if (promo.maxDiscountCap && promoDiscount > promo.maxDiscountCap) promoDiscount = promo.maxDiscountCap;
                if (promoDiscount > amount) promoDiscount = amount;

                // Track usage
                promo.usesCount += 1;
                await promo.save();

                // Save promo info on job
                job.promoCode = promoCode;
                job.promoDiscount = promoDiscount;
            }
        }
    }

    const adminTotalRevenue = (platformFee + gst) - promoDiscount;

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
                    { _id: worker._id, 'wallet.balance': { $gte: adminTotalRevenue } },
                    { $inc: { 'wallet.balance': -adminTotalRevenue } },
                    { new: true, session }
                );
                if (!updated) {
                    // LOOPHOLE FIX #1 — Cash Payment Evasion Mitigation
                    // Worker doesn't have enough balance — create debt record
                    const debtUpdated = await Customer.findByIdAndUpdate(worker._id, { $inc: { 'wallet.balance': -adminTotalRevenue } }, { new: true, session });

                    // Automatically lock worker offline since they're in negative balance
                    if (debtUpdated && debtUpdated.wallet?.balance < 0) {
                        await Customer.findByIdAndUpdate(worker._id, { isOnline: false }, { session });
                        logger.warn(`[Cash Evasion] Worker ${worker._id} locked offline — wallet at ₹${debtUpdated.wallet.balance}`);
                        emitToRoom(`worker_${worker._id}`, 'FORCED_OFFLINE', {
                            reason: 'Negative wallet balance from cash job. Please top-up to continue receiving jobs.',
                            walletBalance: debtUpdated.wallet.balance
                        });
                    }

                    await WalletTxn.create([{
                        userId: worker._id, type: 'JOB_DEBIT', amount: adminTotalRevenue,
                        balance: debtUpdated?.wallet?.balance || 0,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
                    }], { session });
                } else {
                    await WalletTxn.create([{
                        userId: worker._id, type: 'JOB_DEBIT', amount: adminTotalRevenue,
                        balance: updated.wallet.balance,
                        refId: job._id.toString(), status: 'COMPLETED',
                        description: `Platform fee + GST for cash job #${job._id.toString().slice(-6)}`
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
        await job.save({ session });

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        try {
            const { collectPlatformFee } = require('../adminWallet/adminWallet.controller');
            await collectPlatformFee(
                adminTotalRevenue,
                `Platform fee + GST ${promoDiscount > 0 ? `(less ₹${promoDiscount} promo discount)` : ''} from job #${job._id.toString().slice(-6)} (${method})`,
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

    const mongoose = require('mongoose');
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();

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

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        emitToRoom(`worker_${job.workerId}`, 'DISPUTE_RESOLVED', { jobId: job._id, resolution });
        emitToRoom(`customer_${job.customerId}`, 'DISPUTE_RESOLVED', { jobId: job._id, resolution });

        return successResponse(res, job, `Dispute resolved: ${resolution}`);
    } catch (error) {
        if (session) await session.abortTransaction();
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
    if (
        req.user.role === 'CUSTOMER' && String(job.customerId._id) !== String(req.user._id) ||
        req.user.role === 'WORKER' && String(job.workerId?._id) !== String(req.user._id)
    ) {
        return errorResponse(res, 'Forbidden to view this receipt', StatusCodes.FORBIDDEN);
    }

    if (!['COMPLETED', 'PAID', 'CLOSED'].includes(job.status)) {
        return errorResponse(res, 'Receipts are only available for completed or paid jobs', StatusCodes.BAD_REQUEST);
    }

    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
    }
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
    const disputes = await Job.find({ status: 'CANCELLED' })
        .populate('customerId', 'name phone')
        .populate('workerId', 'name phone')
        .sort('-updatedAt')
        .lean();

    return successResponse(res, disputes, 'Disputes fetched');
});
