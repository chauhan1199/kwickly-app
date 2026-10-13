// Mirrors backend/src/helpers/feeCalculator.helper.js. Defaults match the server's;
// pass the config from /settings/public so totals follow what admin has set.
export const DEFAULT_SHOP_ORDER_FEE = { mode: 'PERCENTAGE', percentage: 5, minFee: 10, fixedFee: 10, gstPercent: 18 };
export const DEFAULT_SERVICE_JOB_FEE = { mode: 'TIERED', threshold: 500, minFee: 50, percentAboveThreshold: 12, percentage: 12, fixedFee: 50, gstPercent: 18 };

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v, fallback) => (v === undefined || v === null || isNaN(Number(v)) ? fallback : Number(v));

const withGst = (fee, gstPercent) => {
  const platformFee = round2(fee);
  return { platformFee, gstAmount: round2((platformFee * gstPercent) / 100) };
};

export const calculateShopOrderFee = (netItems, cfg = DEFAULT_SHOP_ORDER_FEE) => {
  if (!(netItems > 0)) return { platformFee: 0, gstAmount: 0 };
  const c = { ...DEFAULT_SHOP_ORDER_FEE, ...cfg };
  let fee;
  if (c.mode === 'FIXED') {
    fee = num(c.fixedFee, 0);
  } else {
    fee = (netItems * num(c.percentage, 0)) / 100;
    if (fee < num(c.minFee, 0)) fee = num(c.minFee, 0);
  }
  return withGst(fee, num(c.gstPercent, 0));
};

export const calculateJobFee = (quote, cfg = DEFAULT_SERVICE_JOB_FEE) => {
  const amount = Math.max(0, Number(quote) || 0);
  if (!amount) return { platformFee: 0, gstAmount: 0 };
  const c = { ...DEFAULT_SERVICE_JOB_FEE, ...cfg };
  const minFee = num(c.minFee, 0);
  let fee;
  if (c.mode === 'FIXED') {
    fee = num(c.fixedFee, 0);
  } else if (c.mode === 'PERCENTAGE') {
    fee = Math.max((amount * num(c.percentage, 0)) / 100, minFee);
  } else {
    fee = amount <= num(c.threshold, 0) ? minFee : Math.max((amount * num(c.percentAboveThreshold, 0)) / 100, minFee);
  }
  return withGst(fee, num(c.gstPercent, 0));
};

// Lowest admin-set minimum price across a category's active subcategories
// (Category.subcategories[].minPrice). Returns null when admin has not set one,
// so the UI can say "Get quotes" instead of showing an invented price.
export const getCategoryStartingPrice = (category) => {
  const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const prices = subs
    .filter(s => s && s.active !== false)
    .map(s => Number(s.minPrice))
    .filter(p => Number.isFinite(p) && p > 0);
  if (prices.length > 0) return Math.min(...prices);
  const base = Number(category?.basePrice);
  return Number.isFinite(base) && base > 0 ? base : null;
};
