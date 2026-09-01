/**
 * UPI Provider Service — Provider-Agnostic Overlay Client
 *
 * This service wraps an external free P2P UPI tech-overlay (e.g., KwikUPI,
 * BharatUPI, VyaparGateway). It is responsible for:
 *   1. Registering a payment intent with the provider so they know to watch
 *      for an incoming credit matching our session.
 *   2. Querying the provider's status API for reconciliation (cron fallback).
 *
 * When UPI_PROVIDER_API_KEY is absent the service runs in "passthrough" mode —
 * it generates a standard NPCI UPI deeplink without registering with any
 * provider, preserving backward compatibility with the manual UTR flow.
 */

const logger = require('../helpers/logger.helper');

const PROVIDER_BASE = process.env.UPI_PROVIDER_API_BASE || 'https://api.kwikupi.in/v1';
const PROVIDER_KEY  = process.env.UPI_PROVIDER_API_KEY  || '';

/**
 * Returns true when the provider API is configured.
 * Used by callers to decide between automated vs manual-UTR flows.
 */
const isProviderConfigured = () => Boolean(PROVIDER_KEY);

/**
 * Dynamically fetches the current platform UPI ID and Payee Name
 * directly from the AdminWallet collection (set in Admin Panel).
 */
const getPlatformUpiConfig = async () => {
    try {
        const { AdminWallet } = require('../modules/adminWallet/adminWallet.model');
        const adminWallet = await AdminWallet.findOne().lean();
        return {
            vpa: adminWallet?.upiId || process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi',
            payeeName: adminWallet?.bankDetails?.accountHolder || process.env.PLATFORM_PAYEE_NAME || 'Kwickly PVT LTD'
        };
    } catch {
        return {
            vpa: process.env.PLATFORM_UPI_ID || 'ganshyam.tech-1@oksbi',
            payeeName: process.env.PLATFORM_PAYEE_NAME || 'Kwickly PVT LTD'
        };
    }
};

/**
 * Build a plain NPCI UPI deeplink without any provider registration.
 * Dynamically uses the Admin Panel's configured UPI ID and Payee Name.
 */
const buildUpiDeeplink = async ({ amount, internalId, purpose, vpa: customVpa, payeeName: customPayee }) => {
    const config = (customVpa && customPayee)
        ? { vpa: customVpa, payeeName: customPayee }
        : await getPlatformUpiConfig();

    const cleanVpa = (config.vpa || 'ganshyam.tech-1@oksbi').trim();
    const cleanPayee = (config.payeeName || 'Kwickly PVT LTD').trim().replace(/\s+/g, ' ');
    const amtStr = Number(amount).toFixed(2);
    const idSuffix = String(internalId || Date.now()).slice(-8);
    const txnRef = `KWIK${idSuffix}${Math.random().toString(36).slice(-4)}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const note = `Kwickly ${purpose || 'Payment'}`.replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 30);

    return `upi://pay?pa=${cleanVpa}&pn=${encodeURIComponent(cleanPayee)}&am=${amtStr}&cu=INR&tn=${encodeURIComponent(note)}&tr=${txnRef}`;
};

/**
 * Register a payment intent with the configured provider.
 *
 * On success the provider returns a session ID that it will embed in its
 * webhook payload when the matching credit arrives at our VPA.
 *
 * @param {object} opts
 * @param {number}  opts.amount      - Amount in INR (rupees)
 * @param {string}  opts.internalId  - MongoDB _id of the WalletTxn / ShopOrder
 * @param {string}  opts.purpose     - 'wallet_topup' | 'shop_order' | 'worker_subscription' | 'shop_subscription'
 * @param {string}  opts.userId      - MongoDB _id of the customer
 * @param {string}  [opts.planId]    - Subscription plan ID (only for subscription flows)
 * @returns {Promise<{ gatewayOrderId: string, upiIntentUri: string }>}
 */
const registerPaymentIntent = async ({ amount, internalId, purpose, userId, planId }) => {
    const config = await getPlatformUpiConfig();
    const upiIntentUri = await buildUpiDeeplink({
        amount,
        internalId,
        purpose,
        vpa: config.vpa,
        payeeName: config.payeeName
    });

    if (!isProviderConfigured()) {
        logger.info(`[UpiProvider] Using live Admin UPI (${config.vpa}) in direct deeplink mode.`);
        return {
            gatewayOrderId: null,
            upiIntentUri
        };
    }

    try {
        // Dynamic import so the module loads without `node-fetch` being installed
        // in environments that don't have it (provider integration is optional).
        const fetch = require('node-fetch');

        const body = JSON.stringify({
            amount: Math.round(amount * 100), // provider expects paise
            currency: 'INR',
            vpa: config.vpa,
            payeeName: config.payeeName,
            metadata: {
                internalId: String(internalId),
                purpose,
                userId:   String(userId),
                planId:   planId || null
            }
        });

        const res = await fetch(`${PROVIDER_BASE}/payment-intent`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${PROVIDER_KEY}`,
                'X-Api-Version': '2025-01'
            },
            body,
            timeout: 8000 // 8 s hard limit — never block order creation
        });

        if (!res.ok) {
            const errText = await res.text();
            logger.error(`[UpiProvider] registerPaymentIntent HTTP ${res.status}: ${errText}`);
            // Graceful degradation — return deeplink without provider session
            return { gatewayOrderId: null, upiIntentUri };
        }

        const data = await res.json();
        const gatewayOrderId = data?.sessionId || data?.orderId || data?.id || null;
        const providerUri     = data?.deeplink  || data?.upiLink || upiIntentUri;

        logger.info(`[UpiProvider] Payment intent registered: gatewayOrderId=${gatewayOrderId}, internalId=${internalId}`);
        return { gatewayOrderId, upiIntentUri: providerUri };

    } catch (err) {
        logger.error(`[UpiProvider] registerPaymentIntent error: ${err.message}`);
        // Graceful degradation — caller gets a working deeplink even if provider is down
        return { gatewayOrderId: null, upiIntentUri };
    }
};

/**
 * Query the provider for the current status of a payment session.
 * Used by the reconciliation cron to force-resolve stuck PENDING records.
 *
 * @param {string} gatewayOrderId - The session ID returned by registerPaymentIntent
 * @returns {Promise<'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN'>}
 */
const checkTransactionStatus = async (gatewayOrderId) => {
    if (!isProviderConfigured() || !gatewayOrderId) return 'UNKNOWN';

    try {
        const fetch = require('node-fetch');
        const res = await fetch(`${PROVIDER_BASE}/payment-intent/${gatewayOrderId}`, {
            method:  'GET',
            headers: {
                'Authorization': `Bearer ${PROVIDER_KEY}`,
                'X-Api-Version': '2025-01'
            },
            timeout: 8000
        });

        if (!res.ok) {
            logger.warn(`[UpiProvider] checkTransactionStatus HTTP ${res.status} for ${gatewayOrderId}`);
            return 'UNKNOWN';
        }

        const data = await res.json();
        const raw  = (data?.status || data?.paymentStatus || '').toUpperCase();

        if (raw === 'SUCCESS' || raw === 'CAPTURED' || raw === 'PAID') return 'SUCCESS';
        if (raw === 'FAILED'  || raw === 'EXPIRED')                   return 'FAILED';
        if (raw === 'PENDING' || raw === 'INITIATED')                 return 'PENDING';
        return 'UNKNOWN';

    } catch (err) {
        logger.error(`[UpiProvider] checkTransactionStatus error: ${err.message}`);
        return 'UNKNOWN';
    }
};

module.exports = {
    isProviderConfigured,
    registerPaymentIntent,
    checkTransactionStatus,
    buildUpiDeeplink
};
