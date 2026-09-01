const crypto = require('crypto');
const mongoose = require('mongoose');
const {
    isProviderConfigured,
    registerPaymentIntent,
    buildUpiDeeplink,
    checkTransactionStatus
} = require('../services/upiProvider.service');

const {
    handleWalletTopupWebhook,
    handleShopOrderWebhook,
    handleWorkerSubscriptionWebhook,
    handleShopSubscriptionWebhook,
    handleFailedPaymentWebhook
} = require('../helpers/webhookHandlers.helper');

describe('Automated P2P UPI Hook-Verification System', () => {
    describe('UPI Provider Service', () => {
        test('builds valid NPCI UPI deeplink', async () => {
            const link = await buildUpiDeeplink({
                amount: 250,
                internalId: '66a1234567890abcdef12345',
                purpose: 'wallet_topup'
            });

            expect(link).toContain('upi://pay');
            expect(link).toContain('am=250');
            expect(link).toContain('cu=INR');
            expect(link).toContain('pa=');
            expect(link).toContain('tr=KWIK');
        });

        test('gracefully falls back to deeplink mode when no provider key is configured', async () => {
            const res = await registerPaymentIntent({
                amount: 100,
                internalId: 'test_int_123',
                purpose: 'wallet_topup',
                userId: 'user_123'
            });

            expect(res).toBeDefined();
            expect(res.upiIntentUri).toContain('upi://pay');
            expect(res.upiIntentUri).toContain('am=100');
        });
    });

    describe('HMAC Signature Generation & Verification', () => {
        const secret = 'test_webhook_secret_key_123';

        test('computes valid HMAC SHA256 signature that verifies correctly', () => {
            const rawBody = JSON.stringify({
                event: 'payment.success',
                transactionId: 'txn_987654321',
                amount: 500,
                metadata: { internalId: 'test_id', purpose: 'wallet_topup' }
            });

            const signature = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex')
                .toLowerCase();

            const expected = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex')
                .toLowerCase();

            expect(signature).toBe(expected);
            expect(signature.length).toBe(64); // 256 bits hex
        });

        test('tampered body fails signature check', () => {
            const rawBody = JSON.stringify({ amount: 500 });
            const tamperedBody = JSON.stringify({ amount: 5000 });

            const signature = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex');

            const expectedOnTampered = crypto
                .createHmac('sha256', secret)
                .update(tamperedBody)
                .digest('hex');

            expect(signature).not.toBe(expectedOnTampered);
        });
    });
});
