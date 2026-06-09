/**
 * SMS Service Layer
 * Abstracts OTP generation and third-party SMS dispatch.
 */

exports.sendOTP = async (phone) => {
    // Generate static OTP in dev, or random in prod
    // User requested static fallback for now until 3rd party is purchased
    const otp = process.env.NODE_ENV === 'production' 
        ? Math.floor(1000 + Math.random() * 9000).toString() 
        : '4729';

    console.log(`[SMS Service] Sending OTP ${otp} to ${phone}`);

    // TODO: Integrate actual 3rd party SMS gateway here when purchased
    // e.g. await twilioClient.messages.create({ body: `Your code is ${otp}`, to: phone, from: ... })

    return otp;
};
