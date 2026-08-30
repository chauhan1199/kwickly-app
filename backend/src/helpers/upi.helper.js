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
 * Validates whether a UTR string is a genuine 12-digit UPI Reference Number.
 * Real NPCI UTR/RRN numbers are exactly 12 digits — anything else is rejected.
 */
const isValidUtr = (utr) => {
    if (!utr || typeof utr !== 'string') return false;
    const clean = utr.trim();

    // Must be exactly 12 digits (NPCI UPI Reference Number / RRN format)
    if (!/^\d{12}$/.test(clean)) return false;

    // Reject repetitive / obviously fake patterns
    const isDummy = /^(\d)\1{11}$/.test(clean) ||
                    ['123456789012', '000000000000', '111111111111', '999999999999', '123412341234', '112233445566', '121212121212'].includes(clean);

    return !isDummy;
};


/**
 * Cross-flow UTR usage check — a single bank transaction (one UTR) must never
 * be redeemed twice anywhere on the platform: wallet topups, job/order payments,
 * worker subscriptions, or shop subscriptions. Returns a usage descriptor or null.
 */
const findUtrUsage = async (utr) => {
    if (!utr) return null;
    const WalletTxn = require('../modules/wallet/wallet.model');
    const Payment = require('../modules/payment/payment.model');
    const subModels = require('../modules/subscription/subscription.model');
    const WorkerSubscription = subModels.WorkerSubscription;
    const ShopSubscription = subModels.ShopSubscription;

    const [topup, payment, workerSub, shopSub] = await Promise.all([
        WalletTxn.findOne({ razorpayPaymentId: utr }).lean(),
        Payment.findOne({ razorpayPaymentId: utr }).lean(),
        WorkerSubscription ? WorkerSubscription.findOne({ 'payment.razorpayPaymentId': utr }).lean() : null,
        ShopSubscription ? ShopSubscription.findOne({ 'payment.razorpayPaymentId': utr }).lean() : null
    ]);

    if (topup) return { flow: 'WALLET_TOPUP', ref: topup };
    if (payment) return { flow: 'PAYMENT', ref: payment };
    if (workerSub) return { flow: 'WORKER_SUBSCRIPTION', ref: workerSub };
    if (shopSub) return { flow: 'SHOP_SUBSCRIPTION', ref: shopSub };
    return null;
};

module.exports = {
    generateUpiIntentUri,
    isValidUtr,
    findUtrUsage
};
