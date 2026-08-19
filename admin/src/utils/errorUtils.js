/**
 * Returns true if the error is a request abort/cancel (not a real failure).
 * This covers:
 *  - Native AbortController (name === 'AbortError')
 *  - Axios cancel (name === 'CanceledError' or code === 'ERR_CANCELED')
 */
export const isAbortError = (err) =>
  err?.name === 'AbortError' ||
  err?.name === 'CanceledError' ||
  err?.code === 'ERR_CANCELED'

/**
 * Extracts a user-friendly error message from a backend API error response.
 * Handles single string messages and array of validation errors.
 */
export const extractErrorMessage = (err, fallback = 'Operation failed') => {
  if (!err) return fallback;
  
  // If we have specific validation errors in an array
  if (err.response?.data?.errors && Array.isArray(err.response.data.errors) && err.response.data.errors.length > 0) {
    return err.response.data.errors.join(' • ');
  }
  
  // Standard string message
  if (err.response?.data?.message) {
    return err.response.data.message;
  }
  
  // Error object message directly
  if (err.message && !err.message.includes('Request failed')) {
    return err.message;
  }
  
  return fallback;
}
