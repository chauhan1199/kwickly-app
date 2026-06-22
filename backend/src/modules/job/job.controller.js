const { StatusCodes } = require('http-status-codes');
const Job = require('./job.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
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

    // Validate coordinates are present
    if (!location?.coordinates || location.coordinates.length !== 2) {
        return errorResponse(res, 'Job location coordinates are required', StatusCodes.BAD_REQUEST);
    }

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
        addressDetails,
        status: 'BROADCASTING',
        payment: { amount: 0, status: 'PENDING' }
    });

    // ── Step 1: Load platform settings (Redis cached, 10 min TTL) ──────────────
    let settings = await getCache('app_settings');
    if (!settings) {
        const AppSettings = require('../settings/settings.model');
        settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
        if (settings) await setCache('app_settings', settings, 600);
    }
    const minBalance     = settings?.wallet?.minimumBalance || 100;
    const globalMaxKm   = settings?.radius?.maxKm || 15;
    const now           = new Date();
    const [jobLng, jobLat] = location.coordinates;  // GeoJSON: [longitude, latitude]

    // ── Step 2: Find ALL eligible workers using server-side criteria ────────────
    //
    // We use a single optimised MongoDB query with:
    //  - role + isVerified + kyc.status  (compound index hits)
    //  - isOnline                         (must be active)
    //  - subscription valid               ($or trial / expiry)
    //  - wallet.balance >= minBalance     (enough balance to bid)
    //  - services.category name matches   (category filter)
    //  - activeLocation $geoWithin        (within EACH worker's OWN serviceRadius)
    //
    // NOTE: MongoDB $geoWithin $centerSphere uses the GLOBAL maxKm as an outer
    // bounding box first (fast index scan), then we filter per-worker radius
    // in JavaScript below. This two-step avoids a slow full-collection scan.

    const globalRadiusRadians = globalMaxKm / 6371; // Earth radius 6371 km

    // Fetch candidate workers within global max radius (coarse filter via index)
    const candidateWorkers = await Customer.find({
        role:        'WORKER',
        isVerified:  true,
        'kyc.status': 'APPROVED',
        isOnline:    true,
        $or: [
            { 'subscription.isTrial': true },
            { 'subscription.expiryDate': { $gt: now } }
        ],
        'wallet.balance': { $gte: minBalance },
        activeLocation: {
            $geoWithin: {
                $centerSphere: [
                    location.coordinates,
                    globalRadiusRadians     // outer bound: global max (e.g. 15 km)
                ]
            }
        }
    })
    .select('_id services serviceRadius activeLocation')
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
        jobId:        job._id,
        category:     job.category,
        subcategory:  job.subcategory,
        description:  job.description,
        location:     job.location,
        addressDetails: job.addressDetails,
        timeSlot:     job.timeSlot,
        preferredDate: job.preferredDate,
        notifiedWorkers: eligibleWorkerIds.length,
        customer: {
            _id:          customer?._id,
            name:         customer?.name,
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
        type:            'NEW_JOB',
        id:              job._id,
        category:        job.category,
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
    const isTrialActive       = worker.subscription?.isTrial === true &&
                                 worker.subscription?.trialEndDate &&
                                 new Date(worker.subscription.trialEndDate) > now;
    const isPaidSubActive     = worker.subscription?.expiryDate &&
                                 new Date(worker.subscription.expiryDate) > now;
    const isSubscriptionValid = isTrialActive || isPaidSubActive;

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
    const workerCoords   = worker.activeLocation?.coordinates;

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
    const jobs = await Job.find({
        status:   { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] },
        category: { $in: activeCategoryNames },        // Criteria 7: category match
        _id:      { $nin: quotedJobIds },               // Exclude already-quoted
        location: {                                     // Criteria 8: worker's radius
            $geoWithin: {
                $centerSphere: [workerCoords, workerRadiusRadians]
            }
        }
    })
    .populate('customerId', 'name phone profileImage')
    .sort('-createdAt')
    .limit(50)
    .lean();

    // ── Attach distance info to each job (for display in worker's app) ──────────
    const [wLng, wLat] = workerCoords;
    const jobsWithDistance = jobs.map(job => {
        const [jLng, jLat] = job.location?.coordinates || [0, 0];
        const R     = 6371;
        const dLat  = ((jLat - wLat) * Math.PI) / 180;
        const dLng  = ((jLng - wLng) * Math.PI) / 180;
        const a     =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((wLat * Math.PI) / 180) *
            Math.cos((jLat * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const distanceKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
        const etaMins    = Math.max(5, Math.ceil(distanceKm * 2) + 5);
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
