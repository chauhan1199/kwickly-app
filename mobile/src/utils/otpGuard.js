/**
 * OTP input guard utilities.
 *
 * All OTP send/verify call sites must validate the code BEFORE hitting the
 * API, and must disable their submit/resend buttons while a request is
 * in flight (double-send / double-submit protection).
 */

export const OTP_LENGTH = 4;

/**
 * Strip anything that is not a digit (handles paste of formatted codes
 * like "1 2 3 4" or "1234-").
 */
export const sanitizeOtp = (code) => String(code == null ? '' : code).replace(/\D+/g, '');

/**
 * An OTP is valid only if it is exactly `length` digits long and purely numeric.
 */
export const isValidOtp = (code, length = OTP_LENGTH) => {
  const clean = sanitizeOtp(code);
  return clean.length === length && /^\d+$/.test(clean);
};

/**
 * Validate an OTP array (one digit per box) or string for submission.
 * Returns { valid, code, message } — message is a ready-to-show string
 * when validation fails.
 */
export const validateOtpForSubmit = (code, length = OTP_LENGTH) => {
  const joined = Array.isArray(code) ? code.join('') : String(code == null ? '' : code);
  const clean = sanitizeOtp(joined);
  if (clean.length === 0) {
    return { valid: false, code: clean, message: 'Please enter the verification code.' };
  }
  if (!/^\d+$/.test(joined)) {
    return { valid: false, code: clean, message: 'The verification code must contain digits only.' };
  }
  if (clean.length !== length) {
    return { valid: false, code: clean, message: `Please enter the complete ${length}-digit verification code.` };
  }
  return { valid: true, code: clean, message: null };
};
