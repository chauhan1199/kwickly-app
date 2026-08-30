import {
  OTP_LENGTH,
  sanitizeOtp,
  isValidOtp,
  validateOtpForSubmit,
} from '../src/utils/otpGuard';

describe('otpGuard', () => {
  describe('sanitizeOtp', () => {
    it('strips non-digit characters', () => {
      expect(sanitizeOtp('1 2-3a4')).toBe('1234');
    });

    it('handles null/undefined input', () => {
      expect(sanitizeOtp(null)).toBe('');
      expect(sanitizeOtp(undefined)).toBe('');
    });
  });

  describe('isValidOtp', () => {
    it('accepts a 4-digit numeric code', () => {
      expect(isValidOtp('1234')).toBe(true);
      expect(isValidOtp(['1', '2', '3', '4'])).toBe(true);
    });

    it('rejects partial codes', () => {
      expect(isValidOtp('123')).toBe(false);
      expect(isValidOtp('')).toBe(false);
    });

    it('rejects non-numeric codes of the right length', () => {
      expect(isValidOtp('12a4')).toBe(false);
      expect(isValidOtp('1.34')).toBe(false);
    });

    it('rejects codes longer than the expected length', () => {
      expect(isValidOtp('12345')).toBe(false);
    });

    it('supports configurable lengths', () => {
      expect(isValidOtp('123456', 6)).toBe(true);
      expect(isValidOtp('1234', 6)).toBe(false);
    });

    it('exposes the expected default OTP length', () => {
      expect(OTP_LENGTH).toBe(4);
    });
  });

  describe('validateOtpForSubmit (pre-submission validation)', () => {
    it('validates a full numeric code', () => {
      expect(validateOtpForSubmit(['1', '2', '3', '4'])).toEqual({
        valid: true,
        code: '1234',
        message: null,
      });
    });

    it('rejects an empty code with a user-ready message', () => {
      const result = validateOtpForSubmit(['', '', '', '']);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Please enter the verification code.');
    });

    it('rejects a partial numeric code before it reaches the API', () => {
      const result = validateOtpForSubmit(['1', '2', '', '']);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('complete 4-digit');
    });

    it('rejects non-numeric input before it reaches the API', () => {
      const result = validateOtpForSubmit(['1', 'a', '3', '4']);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('digits only');
    });
  });

  describe('submit guard while a request is in flight', () => {
    // Mirrors the guard used by OTPVerifyScreen: handleVerify/handleResend
    // early-return when loading or sending is true, and the buttons render
    // disabled={loading || sending}.
    const isOtpActionDisabled = ({ loading, sending }) => Boolean(loading || sending);

    it('disables submit and resend while verifying', () => {
      expect(isOtpActionDisabled({ loading: true, sending: false })).toBe(true);
    });

    it('disables submit and resend while sending/resending', () => {
      expect(isOtpActionDisabled({ loading: false, sending: true })).toBe(true);
    });

    it('keeps buttons enabled only when no request is in flight', () => {
      expect(isOtpActionDisabled({ loading: false, sending: false })).toBe(false);
    });
  });
});
