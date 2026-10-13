import { distanceKm, estimateEtaMinutes, formatDistance, getRealRating } from '../src/utils/geo';
import { getCategoryStartingPrice } from '../src/utils/fees';

describe('geo helpers never invent a value', () => {
  test('distance is null when either point is unknown', () => {
    expect(distanceKm(null, { lat: 23, lng: 72 })).toBeNull();
    expect(distanceKm({ lat: NaN, lng: 72 }, { lat: 23, lng: 72 })).toBeNull();
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 23, lng: 72 })).toBeNull();
  });

  test('distance between two real points', () => {
    const km = distanceKm({ lat: 23.0225, lng: 72.5714 }, { lat: 23.0325, lng: 72.5714 });
    expect(km).toBeCloseTo(1.11, 1);
  });

  test('ETA mirrors backend calculateETA and is null without a distance', () => {
    expect(estimateEtaMinutes(null)).toBeNull();
    expect(estimateEtaMinutes(0)).toBe(5);
    expect(estimateEtaMinutes(3.2)).toBe(12);
  });

  test('formatDistance', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(0.45)).toBe('450 m');
    expect(formatDistance(2.34)).toBe('2.3 km');
  });

  test('rating is null until someone has rated', () => {
    expect(getRealRating(undefined)).toBeNull();
    expect(getRealRating({ average: 0, count: 0 })).toBeNull();
    expect(getRealRating({ average: 4.8, count: 0 })).toBeNull();
    expect(getRealRating({ average: 4.26, count: 3 })).toBe(4.3);
    expect(getRealRating(4.5)).toBe(4.5);
  });
});

describe('getCategoryStartingPrice', () => {
  test('lowest admin-set active subcategory minPrice', () => {
    expect(getCategoryStartingPrice({ subcategories: [
      { minPrice: 300 }, { minPrice: 150 }, { minPrice: 99, active: false }, { minPrice: 0 },
    ] })).toBe(150);
  });

  test('null when admin has not set a price', () => {
    expect(getCategoryStartingPrice(null)).toBeNull();
    expect(getCategoryStartingPrice({ subcategories: [{ minPrice: 0 }] })).toBeNull();
  });
});
