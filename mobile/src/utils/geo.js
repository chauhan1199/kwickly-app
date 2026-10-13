// Geo helpers shared by tracking screens. Everything here is derived from real
// coordinates; callers get null back when a value cannot be measured.

const toRad = (deg) => (deg * Math.PI) / 180;

const isValidPoint = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

// Great-circle distance in km between two { lat, lng } points, or null if either is unknown.
export const distanceKm = (a, b) => {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (!isValidPoint(lat1, lng1) || !isValidPoint(lat2, lng2)) return null;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// Same formula as the backend's geo.helper calculateETA so both sides agree.
export const estimateEtaMinutes = (km) => {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  return Math.max(5, Math.ceil(km * 2) + 5);
};

export const formatDistance = (km) => {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

// Reads a worker's real average rating from either { average, count } or a plain number.
// Returns null when the worker has not been rated yet.
export const getRealRating = (rating) => {
  const avg = typeof rating === 'object' && rating !== null ? Number(rating.average) : Number(rating);
  const count = typeof rating === 'object' && rating !== null ? Number(rating.count) : null;
  if (!Number.isFinite(avg) || avg <= 0) return null;
  if (count !== null && Number.isFinite(count) && count <= 0) return null;
  return Math.round(avg * 10) / 10;
};
