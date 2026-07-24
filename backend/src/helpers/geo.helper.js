const EARTH_RADIUS_KM = 6371;

const haversineDistance = (coords1, coords2) => {
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(coords2[1] - coords1[1]);
    const dLon = toRad(coords2[0] - coords1[0]);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(coords1[1])) * Math.cos(toRad(coords2[1])) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const calculateETA = (distanceKm) => Math.max(5, Math.ceil(distanceKm * 2) + 5);

module.exports = { haversineDistance, calculateETA, EARTH_RADIUS_KM };
