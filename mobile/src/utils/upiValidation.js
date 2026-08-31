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

export const isValidUtr = (utr) => {
    if (!utr || typeof utr !== 'string') return false;
    const clean = utr.trim();
    if (!UTR_PATTERN.test(clean)) return false;
    if (/^(\d)\1{11}$/.test(clean)) return false; // all-same-digit

    // Minimum entropy check: a valid 12-digit bank RRN must have at least 4 unique digits
    const uniqueDigits = new Set(clean.split('')).size;
    if (uniqueDigits < 4) return false;

    // Check repetitive chunks (e.g. 121212121212, 123123123123, 123412341234, 123456123456)
    if (/^(\d{2})\1{5}$/.test(clean) || /^(\d{3})\1{3}$/.test(clean) || /^(\d{4})\1{2}$/.test(clean) || /^(\d{6})\1{1}$/.test(clean)) {
        return false;
    }

    const blockedSequences = [
        '123456789012', '012345678901', '987654321098', '098765432109',
        '123456543212', '123456654321', '123456789000', '123456789123',
        '000000000000', '111111111111', '222222222222', '333333333333',
        '444444444444', '555555555555', '666666666666', '777777777777',
        '888888888888', '999999999999', '121212121212', '123123123123',
        '123412341234', '112233445566', '665544332211', '010203040506',
        '102030405060', '111222333444', '987987987987', '000111222333'
    ];

    if (blockedSequences.includes(clean)) return false;

    let isAsc = true, isDesc = true;
    for (let i = 0; i < 11; i++) {
        const diff = Number(clean[i + 1]) - Number(clean[i]);
        if (diff !== 1 && !(clean[i] === '9' && clean[i + 1] === '0')) isAsc = false;
        if (diff !== -1 && !(clean[i] === '0' && clean[i + 1] === '9')) isDesc = false;
    }
    if (isAsc || isDesc) return false;

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
