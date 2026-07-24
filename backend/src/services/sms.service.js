/**
 * SMS Service — Kwickly
 * Abstracts OTP generation and third-party SMS dispatch.
 *
 * To use a real SMS gateway:
 * 1. Set ENABLE_REAL_SMS=true in your .env
 * 2. Add your SMS gateway credentials (SMS_API_KEY, SMS_SENDER_ID, etc.)
 * 3. Implement the provider-specific API call below
 */

exports.sendOTP = async (phone) => {
    // Generate a secure random 4-digit OTP using crypto
    const crypto = require('crypto');
    const logger = require('../helpers/logger.helper');
    const otp = String(crypto.randomInt(1000, 10000));

    const useRealSMS = process.env.ENABLE_REAL_SMS === 'true';

    if (useRealSMS) {
        // ── Real SMS Gateway Integration ───────────────────────────────────
        // Uncomment and configure one of the following providers:

        // Option 1: Fast2SMS (India)
        // const axios = require('axios');
        // await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        //     route: 'otp',
        //     variables_values: otp,
        //     numbers: phone
        // }, { headers: { authorization: process.env.FAST2SMS_API_KEY } });

        // Option 2: Twilio
        // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // await twilio.messages.create({
        //     body: `Your Kwickly OTP is: ${otp}. Valid for 5 minutes.`,
        //     from: process.env.TWILIO_PHONE_NUMBER,
        //     to: `+91${phone}`
        // });

        // Option 3: MSG91
        // const axios = require('axios');
        // await axios.post('https://api.msg91.com/api/v5/otp', {
        //     mobile: `91${phone}`,
        //     otp,
        //     template_id: process.env.MSG91_TEMPLATE_ID
        // }, { headers: { authkey: process.env.MSG91_API_KEY } });

        logger.info(`[SMS] Real SMS would be sent to +91${phone} with OTP: ${otp}`);
    } else {
        // Development mode — log to console, use static OTP for easier testing
        const devOtp = process.env.DEV_STATIC_OTP || otp;
        logger.info(`[SMS Dev] OTP for ${phone}: ${devOtp} (set ENABLE_REAL_SMS=true for production)`);
        return devOtp;
    }

    return otp;
};
