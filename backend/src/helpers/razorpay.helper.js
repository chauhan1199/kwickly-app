const Razorpay = require('razorpay');
const logger = require('./logger.helper');

let razorpayInstance = null;

const getRazorpay = () => {
    if (razorpayInstance) return razorpayInstance;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('placeholder')) {
        logger.warn('[Razorpay] Keys not configured. Payment features will be disabled.');
        return null;
    }

    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return razorpayInstance;
};

const createRazorpayOrder = async (amount, receipt, notes = {}) => {
    const rp = getRazorpay();
    if (!rp) throw new Error('Razorpay not configured');

    const order = await rp.orders.create({
        amount: Math.round(amount * 100), // Razorpay expects paise
        currency: 'INR',
        receipt,
        notes
    });

    return order;
};

const fetchPayment = async (paymentId) => {
    const rp = getRazorpay();
    if (!rp) throw new Error('Razorpay not configured');
    return rp.payments.fetch(paymentId);
};

const capturePayment = async (paymentId, amount) => {
    const rp = getRazorpay();
    if (!rp) throw new Error('Razorpay not configured');
    return rp.payments.capture(paymentId, amount);
};

const createRefund = async (paymentId, amount, notes = {}) => {
    const rp = getRazorpay();
    if (!rp) throw new Error('Razorpay not configured');
    return rp.payments.refund(paymentId, { amount: Math.round(amount * 100), notes });
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
    const crypto = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.includes('placeholder')) {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            logger.warn('[Razorpay] Signature verification skipped — placeholder key in use (dev/test mode)');
        } else {
            logger.error('[Razorpay] Cannot verify payment — production environment with placeholder key!');
            return false;
        }
        return process.env.NODE_ENV !== 'production';
    }

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
};

module.exports = {
    getRazorpay,
    createRazorpayOrder,
    fetchPayment,
    capturePayment,
    createRefund,
    verifyPaymentSignature
};
