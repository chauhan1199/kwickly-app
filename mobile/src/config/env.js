/**
 * Global Environment Configuration
 * 
 * Before building the final APK/AAB for production:
 * 1. Set IS_PROD = true
 * 2. Update PROD_IP to your AWS EC2 Public IP or Domain (e.g. 'http://54.123.45.67')
 */

export const IS_PROD = false; // Toggle this to true for Production builds

const DEV_IP = 'http://10.0.2.2:5000'; // Android emulator localhost
const PROD_IP = 'http://YOUR_AWS_PUBLIC_IP'; // Replace with your actual live server IP/Domain

export const API_BASE_URL = IS_PROD ? `${PROD_IP}/api/v1` : `${DEV_IP}/api/v1`;
export const SOCKET_URL = IS_PROD ? PROD_IP : DEV_IP;
