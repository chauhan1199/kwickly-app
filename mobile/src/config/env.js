/**
 * Global Environment Configuration
 * 
 * Before building the final APK/AAB for production:
 * 1. Set IS_PROD = true
 * 2. Update PROD_URL to your production server URL (must use HTTPS)
 */

export const IS_PROD = true; // Set to true for live testing and production build

const DEV_URL = 'http://10.0.2.2:5000'; // Android emulator localhost
const PROD_URL = 'https://kwickly-backend-r6zb.onrender.com'; // Production Render API

// Warn if production URL is not configured
if (IS_PROD && PROD_URL.includes('YOUR_PRODUCTION')) {
  console.warn('[ENV] WARNING: PROD_URL is not configured. Set it in your .env file.');
}

// Enforce HTTPS in production
const baseUrl = IS_PROD ? PROD_URL : DEV_URL;
if (IS_PROD && !baseUrl.startsWith('https://')) {
  console.error('[ENV] ERROR: Production URL must use HTTPS!');
}

export const API_BASE_URL = `${baseUrl}/api/v1`;
export const SERVER_BASE_URL = baseUrl; // origin only — /health, static assets
export const SOCKET_URL = baseUrl;
export const APP_LOGO_URL = 'https://kwickly.in/logo.png';
