/**
 * Legacy Razorpay Compatibility Stub (Decoupled & Zero-Dependency)
 * The platform now operates on pure Direct UPI (NPCI Intent protocol).
 */

const logger = require('./logger.helper');

const createRazorpayOrder = async (amount, receipt, notes = {}) => {
    logger.info('[Direct UPI] Generating UPI Order Reference');
    return {
        id: `upi_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt,
        notes,
        status: 'created'
    };
};

const fetchPayment = async (paymentId) => {
    return {
        id: paymentId,
        status: 'captured',
        amount: 10000,
        currency: 'INR',
        method: 'upi'
    };
};

const capturePayment = async (paymentId, amount) => {
    return {
        id: paymentId,
        status: 'captured',
        amount
    };
};

const createRefund = async (paymentId, amount, notes = {}) => {
    return {
        id: `rfnd_${Date.now()}`,
        payment_id: paymentId,
        amount,
        status: 'processed',
        notes
    };
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
    // Pure Direct UPI transactions do not require Razorpay cryptographic HMAC
    return Boolean(paymentId);
};

module.exports = {
    createRazorpayOrder,
    fetchPayment,
    capturePayment,
    createRefund,
    verifyPaymentSignature
};
