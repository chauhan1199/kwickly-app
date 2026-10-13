import { calculateShopOrderFee, calculateJobFee } from '../src/utils/fees';

describe('fee helpers mirror the backend fee engine', () => {
  test('shop order fee: 5% with ₹10 minimum, 18% GST', () => {
    expect(calculateShopOrderFee(100)).toEqual({ platformFee: 10, gstAmount: 1.8 });
    expect(calculateShopOrderFee(1000)).toEqual({ platformFee: 50, gstAmount: 9 });
    expect(calculateShopOrderFee(0)).toEqual({ platformFee: 0, gstAmount: 0 });
  });

  test('shop order fee follows admin config', () => {
    expect(calculateShopOrderFee(1000, { mode: 'FIXED', fixedFee: 25, gstPercent: 18 })).toEqual({ platformFee: 25, gstAmount: 4.5 });
    expect(calculateShopOrderFee(1000, { percentage: 3, minFee: 10 })).toEqual({ platformFee: 30, gstAmount: 5.4 });
  });

  test('job fee: ₹50 up to ₹500, 12% above', () => {
    expect(calculateJobFee(400)).toEqual({ platformFee: 50, gstAmount: 9 });
    expect(calculateJobFee(550)).toEqual({ platformFee: 66, gstAmount: 11.88 });
    expect(calculateJobFee(1000, { mode: 'FIXED', fixedFee: 40 })).toEqual({ platformFee: 40, gstAmount: 7.2 });
  });
});
