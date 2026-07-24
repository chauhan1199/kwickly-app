const Customer = require('../modules/customer/customer.model');
const { haversineDistance, EARTH_RADIUS_KM } = require('./geo.helper');

/**
 * Finds eligible workers for a given job and radius.
 * @param {Object} job - The job object containing location, category, etc.
 * @param {Number} radiusKm - The global search radius in km for this round
 * @param {Number} minBalance - The minimum wallet balance required from settings
 * @returns {Promise<Array<String>>} Array of eligible worker ObjectIds (as strings)
 */
const findEligibleWorkers = async (job, radiusKm, minBalance = 100) => {
    const now = new Date();
    const globalRadiusRadians = radiusKm / EARTH_RADIUS_KM;
    const targetCity = job.addressDetails?.city;

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
                    job.location.coordinates,
                    globalRadiusRadians // outer bound: current broadcast radius
                ]
            }
        }
    };

    if (targetCity) {
        const escaped = targetCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerQuery.city = { $regex: new RegExp('^' + escaped + '$', 'i') }; // Case-insensitive exact match
    }

    // Fetch candidate workers within global max radius
    const candidateWorkers = await Customer.find(workerQuery)
        .select('_id services serviceRadius activeLocation city')
        .populate('services.category', 'name')
        .lean();

    const targetJobCategory = (job.category || '').trim().toLowerCase();
    const [jobLng, jobLat] = job.location.coordinates;

    const eligibleWorkerIds = candidateWorkers.filter(worker => {
        // Criteria 7: Category match
        const hasMatchingCategory = (worker.services || []).some(svc => {
            if (!svc.isActive) return false;
            const catName = (svc.categoryName || svc.category?.name || '').toString().trim().toLowerCase();
            return catName === targetJobCategory;
        });

        if (!hasMatchingCategory) return false;

        // Criteria 8: Worker's OWN serviceRadius bounds
        const workerCoords = worker.activeLocation?.coordinates;
        if (!workerCoords || workerCoords.length !== 2) return false;

        const effectiveLimit = Math.min(worker.serviceRadius || radiusKm, radiusKm);
        const distanceKm = haversineDistance([jobLng, jobLat], workerCoords);

        return distanceKm <= effectiveLimit;
    }).map(w => w._id.toString());

    return eligibleWorkerIds;
};

module.exports = {
    findEligibleWorkers
};
