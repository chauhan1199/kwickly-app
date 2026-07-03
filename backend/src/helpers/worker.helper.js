const Customer = require('../modules/customer/customer.model');

/**
 * Finds eligible workers for a given job and radius.
 * @param {Object} job - The job object containing location, category, etc.
 * @param {Number} radiusKm - The global search radius in km for this round
 * @param {Number} minBalance - The minimum wallet balance required from settings
 * @returns {Promise<Array<String>>} Array of eligible worker ObjectIds (as strings)
 */
const findEligibleWorkers = async (job, radiusKm, minBalance = 100) => {
    const now = new Date();
    const globalRadiusRadians = radiusKm / 6371; // Earth radius 6371 km
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
        workerQuery.city = { $regex: new RegExp('^' + targetCity + '$', 'i') }; // Case-insensitive exact match
    }

    // Fetch candidate workers within global max radius
    const candidateWorkers = await Customer.find(workerQuery)
        .select('_id services serviceRadius activeLocation city')
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

        const [wLng, wLat] = workerCoords;
        // Use the global radius limit of THIS round as a max cap, but also respect the worker's own limit
        const workerRadiusKm = worker.serviceRadius || radiusKm;
        const effectiveLimit = Math.min(workerRadiusKm, radiusKm);

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

        return distanceKm <= effectiveLimit;
    }).map(w => w._id.toString());

    return eligibleWorkerIds;
};

module.exports = {
    findEligibleWorkers
};
