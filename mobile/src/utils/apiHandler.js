/**
 * API Response Handler
 * Wraps API calls with error handling and response validation
 */

/**
 * Handle API response and validate structure
 * @param {object} response - Axios response object
 * @returns {any} - Parsed response data
 * @throws {Error} - If response is invalid or API returned error
 */
export const handleResponse = (response) => {
  if (!response || !response.data) {
    throw new Error('Invalid API response');
  }

  const { data } = response;

  if (data.status === 'error') {
    const errorMessage = data.message || 'An error occurred';
    const errors = data.errors || [];
    console.error('[API Error]', errorMessage, errors);
    throw new Error(errorMessage);
  }

  if (data.status !== 'success') {
    console.warn('[API Warning] Unexpected status:', data.status);
  }

  return response;
};

/**
 * Handle API error and format error message
 * @param {Error} error - Error object
 * @returns {object} - Formatted error object with user-friendly message
 */
export const handleError = (error) => {
  console.error('[API] Error:', error);

  let message = 'Something went wrong. Please try again.';
  let code = 'UNKNOWN_ERROR';

  if (error.response) {
    const { status, data } = error.response;
    message = data?.message || message;
    
    switch (status) {
      case 400:
        code = 'BAD_REQUEST';
        break;
      case 401:
        message = 'Please login again';
        code = 'UNAUTHORIZED';
        break;
      case 403:
        message = 'You do not have permission to perform this action';
        code = 'FORBIDDEN';
        break;
      case 404:
        message = 'The requested resource was not found';
        code = 'NOT_FOUND';
        break;
      case 409:
        code = 'CONFLICT';
        break;
      case 422:
        code = 'VALIDATION_ERROR';
        if (data?.errors && Array.isArray(data.errors)) {
          message = data.errors.join('. ');
        }
        break;
      case 429:
        message = 'Too many requests. Please wait a moment.';
        code = 'RATE_LIMITED';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        code = 'SERVER_ERROR';
        break;
      case 502:
      case 503:
      case 504:
        message = 'Service temporarily unavailable. Please try again.';
        code = 'SERVICE_UNAVAILABLE';
        break;
      default:
        code = `HTTP_${status}`;
    }
  } else if (error.request) {
    message = 'Network error. Please check your internet connection.';
    code = 'NETWORK_ERROR';
  } else if (error.message) {
    message = error.message;
    code = 'CLIENT_ERROR';
  }

  return {
    message,
    code,
    originalError: error,
  };
};

/**
 * Create a service method with automatic error handling
 * @param {Function} apiCall - Axios API call function
 * @returns {Promise} - Promise that handles response validation
 */
export const withErrorHandling = async (apiCall) => {
  try {
    const response = await apiCall();
    return handleResponse(response);
  } catch (error) {
    throw handleError(error);
  }
};

export default { handleResponse, handleError, withErrorHandling };
