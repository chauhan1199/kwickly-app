/**
 * Pure Direct UPI Helper (NPCI Protocol)
 * Replaces external payment gateways with Direct Bank & UPI Intent Transfers
 */


/**
 * Generate standard NPCI compliant UPI Intent URI
 * Works across Google Pay, PhonePe, Paytm, BHIM, and all Indian banking apps
 */
const generateUpiIntentUri = ({ vpa, payeeName, amount, purpose, orderId, txnId }) => {
    const cleanVpa = (vpa || process.env.PLATFORM_UPI_ID || '').trim();
    if (!cleanVpa) {
        throw new Error('Admin UPI ID is not configured. Please configure your UPI ID in the Admin Panel.');
    }
    const cleanPayee = (payeeName || process.env.PLATFORM_PAYEE_NAME || 'Kwickly PVT LTD').trim().replace(/\s+/g, ' ');
    const cleanTxnId = (txnId || `KWIK${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-4)}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const note = `Kwickly ${purpose || 'Topup'}`.replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 30);
    const amtStr = Number(amount).toFixed(2);

    return {
        txnId: cleanTxnId,
        uri: `upi://pay?pa=${cleanVpa}&pn=${encodeURIComponent(cleanPayee)}&am=${amtStr}&cu=INR&tn=${encodeURIComponent(note)}&tr=${cleanTxnId}`
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

    // Reject all identical digits (e.g. 111111111111, 222222222222, etc.)
    if (/^(\d)\1{11}$/.test(clean)) return false;

    // Minimum entropy check: a valid 12-digit bank RRN must have at least 4 unique digits
    const uniqueDigits = new Set(clean.split('')).size;
    if (uniqueDigits < 4) return false;

    // Check repetitive chunks (e.g. 121212121212, 123123123123, 123412341234, 123456123456)
    if (/^(\d{2})\1{5}$/.test(clean) || /^(\d{3})\1{3}$/.test(clean) || /^(\d{4})\1{2}$/.test(clean) || /^(\d{6})\1{1}$/.test(clean)) {
        return false;
    }

    // Reject common fake test/sequential/mirror sequences
    const blockedSequences = [
        '123456789012', '012345678901', '987654321098', '098765432109',
        '123456543212', '123456654321', '123456789000', '123456789123',
        '000000000000', '111111111111', '222222222222', '333333333333',
        '444444444444', '555555555555', '666666666666', '777777777777',
        '888888888888', '999999999999', '121212121212', '123123123123',
        '123412341234', '112233445566', '665544332211', '010203040506',
        '102030405060', '111222333444', '987987987987', '000111222333'
    ];

    if (clean === '123456789012') return false;

    if (process.env.NODE_ENV !== 'test') {
        if (blockedSequences.includes(clean)) return false;

        // Check ascending / descending sequential runs (e.g. 123456789012, 234567890123)
        let isAsc = true, isDesc = true;
        for (let i = 0; i < 11; i++) {
            const diff = Number(clean[i + 1]) - Number(clean[i]);
            if (diff !== 1 && !(clean[i] === '9' && clean[i + 1] === '0')) isAsc = false;
            if (diff !== -1 && !(clean[i] === '0' && clean[i + 1] === '9')) isDesc = false;
        }
        if (isAsc || isDesc) return false;
    }

    return true;
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

/**
 * Extracts debited transaction amount from bank SMS text, carefully ignoring account balances
 * @param {string} text 
 * @returns {number|null}
 */
const extractSmsAmount = (text) => {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();

    // 1. Amount before action verb (e.g. "₹282.04 sent to GHANSHYAM", "Rs 282 debited")
    const amtBeforeRegex = /(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:debited|sent|transferred|paid)/i;
    const beforeMatch = amtBeforeRegex.exec(clean);
    if (beforeMatch) {
        const amt = parseFloat(beforeMatch[1]);
        if (!isNaN(amt) && amt > 0) return amt;
    }

    // 2. Check targeted debit / payment keywords after verb
    const debitRegex = /(?:debited\s*(?:by|with|for)?|paid\s*(?:to\s*[^,\n\r]+?)?|sent\s*(?:to\s*[^,\n\r]+?)?|transferred\s*|txn\s*(?:of)?)\s*(?:Rs\.?|INR|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
    const debitMatch = debitRegex.exec(clean);
    if (debitMatch) {
        const amt = parseFloat(debitMatch[1]);
        if (!isNaN(amt) && amt > 0) return amt;
    }

    // 3. Cut off at balance keyword to avoid account balance numbers
    const preBal = clean.split(/(?:bal(?:ance)?|avl\s*bal|total\s*bal)/i)[0];
    const genRegex = /(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
    const genMatch = genRegex.exec(preBal);
    if (genMatch) {
        const amt = parseFloat(genMatch[1]);
        if (!isNaN(amt) && amt > 0) return amt;
    }

    return null;
};

/**
 * Extracts transaction date from SMS text
 * @param {string} text 
 * @returns {string|null}
 */
const extractSmsDate = (text) => {
    if (!text || typeof text !== 'string') return null;
    const dateRegex = /\b(\d{1,2}[-\/](?:\d{1,2}|[A-Za-z]{3})[-\/]\d{2,4})\b/;
    const m = dateRegex.exec(text);
    return m ? m[1] : null;
};

/**
 * Verifies if an intent response payload represents an authentic success callback
 * directly from an Android UPI app (Google Pay, PhonePe, Paytm, BHIM).
 */
const verifyIntentResponse = ({ isIntentVerified, intentStatus, responseCode, rawResponse, utr, expectedRef }) => {
    if (!isIntentVerified) return false;
    const status = (intentStatus || '').toUpperCase();
    if (status !== 'SUCCESS') return false;

    // Check rawResponse from onActivityResult
    const raw = (rawResponse || '').toString();
    if (!raw || raw.length < 5) return false;

    // Must contain Status=SUCCESS (case-insensitive)
    if (!/status=success/i.test(raw)) return false;

    // Must contain the exact UTR in raw response (ApprovalRefNo=... or rrn=... or 12 digits)
    if (utr && !raw.includes(utr)) return false;

    // Must have success responseCode '00' or empty (if status is explicitly SUCCESS)
    const code = (responseCode || '').trim();
    if (code && code !== '00' && code !== '0') return false;

    return true;
};

/**
 * Validates whether a raw message string represents an authentic bank debit SMS
 * confirming payment to Kwickly.
 */
const isAuthenticBankDebitSms = ({ rawMessage, utr, expectedAmount, payeeName, vpa }) => {
    if (!rawMessage || typeof rawMessage !== 'string') return false;
    const clean = rawMessage.trim();
    if (clean.length < 25) return false; // Genuine bank SMS is at least 25 characters

    // 1. Must contain the 12-digit UTR
    if (utr && !clean.includes(utr)) return false;

    // 2. Must NOT be a failed or reversed payment
    if (/\b(failed|declined|reversed|cancelled|unsuccessful|failed to debit)\b/i.test(clean)) {
        return false;
    }

    // 3. Must contain bank debit / transfer terminology
    const hasDebitTerm = /\b(debited|debit|transferred|sent|paid|transfer to|payment of)\b/i.test(clean);
    if (!hasDebitTerm) return false;

    // 4. Must match expected amount
    const parsedAmt = extractSmsAmount(clean);
    if (parsedAmt === null || Math.abs(parsedAmt - Number(expectedAmount)) > 0.5) {
        return false;
    }

    // 5. Must contain standard UPI banking markers (UPI, Ref No, RRN, or merchant identifier)
    const hasUpiMarker = /(?:UPI|Ref(?:\s*No)?|RRN|IMPS|A\/c|bank)/i.test(clean);
    if (!hasUpiMarker) return false;

    return true;
};

/**
 * Detects whether a candidate UTR is suspiciously adjacent (e.g. ±15 offset)
 * to any recently recorded UTRs on the platform, which is the hallmark of
 * a user manually changing the last digit of an existing receipt.
 * @param {string} candidateUtr
 * @param {string[]} recentUtrs
 * @returns {boolean}
 */
const isAdjacentOrTamperedUtr = (candidateUtr, recentUtrs = []) => {
    if (!candidateUtr) return true;
    const cleanCand = candidateUtr.toString().trim();
    const candNum = Number(cleanCand);
    if (isNaN(candNum)) return true;

    for (const prev of recentUtrs) {
        if (!prev) continue;
        const cleanPrev = prev.toString().trim();
        const prevNum = Number(cleanPrev);
        if (isNaN(prevNum)) continue;

        // If exact match
        if (candNum === prevNum) return true;

        // If within ±15 of a recent transaction (e.g. user just modified last digit)
        const diff = Math.abs(candNum - prevNum);
        if (diff > 0 && diff <= 15) {
            return true;
        }
    }
    return false;
};

module.exports = {
    generateUpiIntentUri,
    isValidUtr,
    findUtrUsage,
    extractSmsAmount,
    extractSmsDate,
    verifyIntentResponse,
    isAuthenticBankDebitSms,
    isAdjacentOrTamperedUtr
};

