/**
 * Direct UPI validation — mirrors the backend's upi.helper rules.
 * One source of truth for all payment screens (customer topup, worker
 * earnings, shop wallet/subscription) so validation never drifts.
 */

// Real NPCI UTR/RRN numbers are exactly 12 digits.
const UTR_PATTERN = /^\d{12}$/;

// Obviously fake patterns the backend rejects — fail fast client-side too
// so users never submit a UTR that can only be rejected after admin review.
const DUMMY_UTRS = [
    '000000000000',
    '111111111111',
    '222222222222',
    '333333333333',
    '444444444444',
    '555555555555',
    '666666666666',
    '777777777777',
    '888888888888',
    '999999999999',
    '123456789012',
    '123412341234',
    '112233445566',
    '121212121212',
];

export const isValidUtr = (utr) => {
    if (!utr || typeof utr !== 'string') return false;
    const clean = utr.trim();
    if (!UTR_PATTERN.test(clean)) return false;
    if (/^(\d)\1{11}$/.test(clean)) return false; // all-same-digit

    // Minimum entropy check: a valid 12-digit bank RRN must have at least 4 unique digits
    const uniqueDigits = new Set(clean.split('')).size;
    if (uniqueDigits < 4) return false;

    // Check repetitive chunks (e.g. 121212121212, 123123123123, 123412341234, 123456123456)
    if (/^(\d{2})\1{5}$/.test(clean) || /^(\d{3})\1{3}$/.test(clean) || /^(\d{4})\1{2}$/.test(clean) || /^(\d{6})\1{1}$/.test(clean)) {
        return false;
    }

    const blockedSequences = [
        '123456789012', '012345678901', '987654321098', '098765432109',
        '123456543212', '123456654321', '123456789000', '123456789123',
        '000000000000', '111111111111', '222222222222', '333333333333',
        '444444444444', '555555555555', '666666666666', '777777777777',
        '888888888888', '999999999999', '121212121212', '123123123123',
        '123412341234', '112233445566', '665544332211', '010203040506',
        '102030405060', '111222333444', '987987987987', '000111222333'
    ];

    if (blockedSequences.includes(clean)) return false;

    let isAsc = true, isDesc = true;
    for (let i = 0; i < 11; i++) {
        const diff = Number(clean[i + 1]) - Number(clean[i]);
        if (diff !== 1 && !(clean[i] === '9' && clean[i + 1] === '0')) isAsc = false;
        if (diff !== -1 && !(clean[i] === '0' && clean[i + 1] === '9')) isDesc = false;
    }
    if (isAsc || isDesc) return false;

    return true;
};

/**
 * Human-readable error for an invalid UTR, or null when valid.
 * @param {string} utr
 * @returns {string|null}
 */
export const utrValidationError = (utr) => {
    if (!utr || !utr.trim()) {
        return 'Please enter the 12-digit UPI Reference / UTR Number from your payment receipt.';
    }
    if (!isValidUtr(utr)) {
        return 'Invalid UTR. Enter the exact 12-digit UPI Reference Number from your bank payment receipt.';
    }
    return null;
};

/**
 * Intelligent Bank SMS & Clipboard Parser for Indian Banking & UPI messages
 * Extracts:
 * 1. 12-digit UPI Reference / UTR Number
 * 2. Debited / Paid transaction amount (ignoring any subsequent account balance numbers)
 * 3. Date / Time string if present
 * 
 * @param {string} text Raw SMS or clipboard text
 * @returns {{ utr: string|null, amount: number|null, dateStr: string|null, rawText: string }}
 */
export const parseBankSms = (text) => {
    if (!text || typeof text !== 'string') {
        return { utr: null, amount: null, dateStr: null, rawText: '' };
    }
    const clean = text.trim();

    // 1. Extract 12-digit UTR
    let utr = null;

    // Pattern 1: Targeted UPI Reference / UTR keywords
    // Matches: UPI:661508361033, UPI Ref: 661508361033, Ref No 661508361033, Txn ID 661508361033,
    // UPI/P2A/661508361033, UTR: 661508361033, RRN 661508361033, UPI-RR: 661508361033, etc.
    const keywordRegex = /(?:upi\s*(?:ref(?:erence)?|txn(?:action)?(?:\s*id)?|rrn|id|no)?[:\s/_-]*|ref\s*(?:no|id|num)?[:\s/_-]*|rrn[:\s/_-]*|utr(?:\s*no)?[:\s/_-]*|urn[:\s/_-]*|imps\s*ref[:\s/_-]*|txn\s*ref[:\s/_-]*|approval\s*ref[:\s/_-]*|upi\/(?:p2a|p2p|cr|dr)?\/?)\D*?(\d{12})/i;
    const utrMatch = keywordRegex.exec(clean);
    if (utrMatch && isValidUtr(utrMatch[1])) {
        utr = utrMatch[1];
    } else {
        // Pattern 2: Standalone 12-digit candidate, but explicitly ignore bank account numbers
        // e.g. "A/c 123456789012" or "Card ending 123456789012" are NOT UTRs
        const accountNumRegex = /(?:a\/c|acct|account|acc\s*no|card)\s*(?:no\.?)?\s*[:\s#]*[xX\*]*(\d{9,18})/gi;
        const accountNumbers = new Set();
        let accMatch;
        while ((accMatch = accountNumRegex.exec(clean)) !== null) {
            if (accMatch[1]) accountNumbers.add(accMatch[1]);
        }

        const standaloneMatches = clean.match(/\b(\d{12})\b/g);
        if (standaloneMatches) {
            for (const candidate of standaloneMatches) {
                if (!accountNumbers.has(candidate) && isValidUtr(candidate)) {
                    utr = candidate;
                    break;
                }
            }
        }
    }

    // 2. Extract debited / paid transaction amount
    // Supports both:
    // a) Amount BEFORE verb: "₹282.04 sent to GHANSHYAM" or "Rs. 282 debited"
    // b) Amount AFTER verb: "sent ₹282.04 to GHANSHYAM" or "debited by Rs 282.04"
    let amount = null;

    // Step 2a: Amount before action verb (e.g. "₹282.04 sent to GHANSHYAM", "Rs 282 debited")
    const amtBeforeRegex = /(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:debited|sent|transferred|paid)/i;
    const beforeMatch = amtBeforeRegex.exec(clean);
    if (beforeMatch) {
        amount = parseFloat(beforeMatch[1]);
    } else {
        // Step 2b: Amount after action verb (e.g. "debited for Rs 282.04", "paid ₹282.04")
        const amtAfterRegex = /(?:debited\s*(?:by|with|for)?|paid\s*(?:to\s*[^,\n\r]+?)?|sent\s*(?:to\s*[^,\n\r]+?)?|transferred\s*|txn\s*(?:of)?)\s*(?:Rs\.?|INR|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
        const afterMatch = amtAfterRegex.exec(clean);
        if (afterMatch) {
            amount = parseFloat(afterMatch[1]);
        } else {
            // Step 2c: General amount search strictly before any "Bal / Balance" substring
            const preBalancePart = clean.split(/(?:bal(?:ance)?|avl\s*bal|total\s*bal)/i)[0];
            const generalAmtRegex = /(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
            const genMatch = generalAmtRegex.exec(preBalancePart);
            if (genMatch) {
                amount = parseFloat(genMatch[1]);
            }
        }
    }

    // 3. Extract transaction date if present (e.g. 06-09-26, 06-SEP-26, 06/09/2026)
    let dateStr = null;
    const dateRegex = /\b(\d{1,2}[-\/](?:\d{1,2}|[A-Za-z]{3})[-\/]\d{2,4})\b/;
    const dateMatch = dateRegex.exec(clean);
    if (dateMatch) {
        dateStr = dateMatch[1];
    }

    return {
        utr,
        amount: !isNaN(amount) && amount > 0 ? amount : null,
        dateStr,
        rawText: clean
    };
};

/**
 * Validates whether an SMS or clipboard payload matches the expected payment session:
 * - Ensures valid 12-digit UTR
 * - Ensures that if an amount was parsed from the SMS, it matches the required amount (allowing for bank SMS rounding)
 * 
 * @param {Object} params
 * @param {string} params.text - Raw SMS or clipboard text
 * @param {number} params.expectedAmount - The amount required for this topup/order
 * @returns {{ isValid: boolean, utr: string|null, amount: number|null, error: string|null }}
 */
export const validateSmsPayment = ({ text, expectedAmount }) => {
    const parsed = parseBankSms(text);

    if (!parsed.utr) {
        return {
            isValid: false,
            utr: null,
            amount: parsed.amount,
            error: 'No valid 12-digit UPI Reference / UTR Number found in the copied message.'
        };
    }

    if (!isValidUtr(parsed.utr)) {
        return {
            isValid: false,
            utr: parsed.utr,
            amount: parsed.amount,
            error: 'The 12-digit reference number is invalid or formatted incorrectly.'
        };
    }

    // AMOUNT CHECK: Allow up to ₹1.01 difference or matching rounded integer
    // This accommodates bank SMS that truncate or round paise (e.g. ₹282 vs ₹282.04 or ₹282 vs ₹282.75)
    if (expectedAmount && parsed.amount !== null) {
        const expected = Number(expectedAmount);
        const actual = Number(parsed.amount);
        const diff = Math.abs(actual - expected);
        const roundedMatches = Math.round(actual) === Math.round(expected);

        if (diff > 1.01 && !roundedMatches) {
            return {
                isValid: false,
                utr: parsed.utr,
                amount: parsed.amount,
                error: `Amount mismatch: The copied SMS is for ₹${actual.toFixed(2)}, but your payment requires ₹${expected.toFixed(2)}. Only the transaction made for ₹${expected.toFixed(2)} is valid.`
            };
        }
    }

    return {
        isValid: true,
        utr: parsed.utr,
        amount: parsed.amount,
        dateStr: parsed.dateStr,
        rawText: parsed.rawText,
        error: null
    };
};

