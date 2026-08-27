/**
 * Pure Direct UPI Helper (NPCI Protocol)
 * Replaces external payment gateways with Direct Bank & UPI Intent Transfers
 */

const logger = require('./logger.helper');

/**
 * Generate standard NPCI compliant UPI Intent URI
 * Works across Google Pay, PhonePe, Paytm, BHIM, and all Indian banking apps
 */
const generateUpiIntentUri = ({ vpa, payeeName, amount, purpose, orderId, txnId }) => {
    const cleanVpa = (vpa || process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi').trim();
    const cleanPayee = (payeeName || 'Kwickly PVT LTD').trim();
    const cleanTxnId = txnId || `upi_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const note = `Kwickly_${purpose || 'Payment'}_${orderId || Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);

    return {
        txnId: cleanTxnId,
        uri: `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encodeURIComponent(cleanPayee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${cleanTxnId}`
    };
};

/**
 * Validates whether a UTR string is non-dummy and properly structured
 */
const isValidUtr = (utr) => {
    if (!utr || typeof utr !== 'string') return false;
    const clean = utr.trim();
    if (clean.length < 4 || clean.length > 30) return false;

    // Check for repetitive fake strings
    const isDummy = /^(\d)\1{7,}$/.test(clean) || 
                    /^(12345678|01234567|98765432|00000000)/i.test(clean) ||
                    ['123456789012', '000000000000', '111111111111', '999999999999', '123412341234', '112233445566', '121212121212'].includes(clean);

    return !isDummy;
};

module.exports = {
    generateUpiIntentUri,
    isValidUtr
};
