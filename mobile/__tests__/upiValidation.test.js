import { isValidUtr, utrValidationError } from '../src/utils/upiValidation';

describe('UPI UTR validation (shared across all payment screens)', () => {
    describe('isValidUtr', () => {
        it('accepts a genuine 12-digit UTR', () => {
            expect(isValidUtr('498571700121')).toBe(true);
            expect(isValidUtr('403349800134')).toBe(true);
        });

        it('accepts a UTR with surrounding whitespace', () => {
            expect(isValidUtr('  498571700121  ')).toBe(true);
        });

        it('rejects wrong lengths', () => {
            expect(isValidUtr('12345678901')).toBe(false);    // 11 digits
            expect(isValidUtr('1234567890123')).toBe(false);  // 13 digits
            expect(isValidUtr('')).toBe(false);
        });

        it('rejects non-numeric input', () => {
            expect(isValidUtr('pay_test456')).toBe(false);
            expect(isValidUtr('12345678901a')).toBe(false);
            expect(isValidUtr('12 456789012')).toBe(false);
        });

        it('rejects non-string input', () => {
            expect(isValidUtr(null)).toBe(false);
            expect(isValidUtr(undefined)).toBe(false);
            expect(isValidUtr(123456789012)).toBe(false);
        });

        it('rejects all-same-digit dummy patterns', () => {
            expect(isValidUtr('000000000000')).toBe(false);
            expect(isValidUtr('111111111111')).toBe(false);
            expect(isValidUtr('999999999999')).toBe(false);
        });

        it('rejects known sequential dummy patterns (mirrors backend blacklist)', () => {
            expect(isValidUtr('123456789012')).toBe(false);
            expect(isValidUtr('123412341234')).toBe(false);
            expect(isValidUtr('112233445566')).toBe(false);
            expect(isValidUtr('121212121212')).toBe(false);
            expect(isValidUtr('123456543212')).toBe(false);
            expect(isValidUtr('123456654321')).toBe(false);
            expect(isValidUtr('123123123123')).toBe(false);
        });
    });

    describe('utrValidationError', () => {
        it('returns null for a valid UTR', () => {
            expect(utrValidationError('498571700121')).toBeNull();
        });

        it('returns a helpful message for empty input', () => {
            expect(utrValidationError('')).toMatch(/enter the 12-digit/i);
            expect(utrValidationError('   ')).toMatch(/enter the 12-digit/i);
        });

        it('returns a helpful message for invalid input', () => {
            expect(utrValidationError('123456789012')).toMatch(/invalid utr/i);
            expect(utrValidationError('short')).toMatch(/invalid utr/i);
        });
    });
});
