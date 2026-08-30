/**
 * Direct UPI validation — mirrors the backend's upi.helper rules.
 * One source of truth for all payment screens (customer topup, worker
 * earnings, shop wallet/subscription) so validation never drifts.
 */

// Real NPCI UTR/RRN numbers are exactly 12 digits.
const UTR_PATTERN = /^\d{12}$/;

// Obviously fake patterns the backend rejects — fail fast client-side too
// so users never submit a UTR that can only be rejected after admin review.
const DUMMY_UTRS = [
    '000000000000',
    '111111111111',
    '222222222222',
    '333333333333',
    '444444444444',
    '555555555555',
    '666666666666',
    '777777777777',
    '888888888888',
    '999999999999',
    '123456789012',
    '123412341234',
    '112233445566',
    '121212121212',
];

/**
 * Validates a UPI Reference / UTR number (12 digits, not an obvious dummy).
 * @param {string} utr
 * @returns {boolean}
 */
export const isValidUtr = (utr) => {
    if (!utr || typeof utr !== 'string') return false;
    const clean = utr.trim();
    if (!UTR_PATTERN.test(clean)) return false;
    if (/^(\d)\1{11}$/.test(clean)) return false; // all-same-digit
    if (DUMMY_UTRS.includes(clean)) return false;
    return true;
};

/**
 * Human-readable error for an invalid UTR, or null when valid.
 * @param {string} utr
 * @returns {string|null}
 */
export const utrValidationError = (utr) => {
    if (!utr || !utr.trim()) {
        return 'Please enter the 12-digit UPI Reference / UTR Number from your payment receipt.';
    }
    if (!isValidUtr(utr)) {
        return 'Invalid UTR. Enter the exact 12-digit UPI Reference Number from your bank payment receipt.';
    }
    return null;
};
