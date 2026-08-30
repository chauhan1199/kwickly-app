/**
 * Service-layer tests for the Direct UPI payment flow.
 * Mocks axios so no network is involved; asserts the exact payloads the
 * backend endpoints expect (12-digit UTR, correct routes, params).
 */
jest.mock('../src/services/api', () => {
    const post = jest.fn(() => Promise.resolve({ data: { status: 'success', data: {} } }));
    const get = jest.fn(() => Promise.resolve({ data: { status: 'success', data: {} } }));
    return { __esModule: true, default: { post, get, interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } } };
});

import api from '../src/services/api';
import { walletService } from '../src/services/walletService';

describe('walletService — Direct UPI topup payloads', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('topupWallet sends amount + UTR under both utrNumber and razorpayPaymentId aliases', async () => {
        await walletService.topupWallet(500, { method: 'UPI', txnId: '498571700121' }, null, '498571700121');

        expect(api.post).toHaveBeenCalledWith('/wallet/topup', expect.objectContaining({
            amount: 500,
            utrNumber: '498571700121',
            razorpayPaymentId: '498571700121',
            paymentDetails: { method: 'UPI', txnId: '498571700121' }
        }));
    });

    it('topupWallet forwards planId when buying a subscription plan', async () => {
        await walletService.topupWallet(299, null, 'worker_monthly', '498571700121');

        expect(api.post).toHaveBeenCalledWith('/wallet/topup', expect.objectContaining({
            amount: 299,
            planId: 'worker_monthly',
            utrNumber: '498571700121'
        }));
    });

    it('createOrder posts to /payments/create-order with amount and purpose', async () => {
        await walletService.createOrder({ amount: 500, purpose: 'wallet_topup' });

        expect(api.post).toHaveBeenCalledWith('/payments/create-order', { amount: 500, purpose: 'wallet_topup' });
    });

    it('verifyPayment posts UTR + order reference to /payments/verify', async () => {
        await walletService.verifyPayment({
            razorpayOrderId: 'upi_ord_123',
            utrNumber: '498571700121',
            amount: 500
        });

        expect(api.post).toHaveBeenCalledWith('/payments/verify', expect.objectContaining({
            razorpayOrderId: 'upi_ord_123',
            utrNumber: '498571700121',
            amount: 500
        }));
    });

    it('withdraw posts amount + payoutMethod to /wallet/withdraw', async () => {
        await walletService.withdraw(900, 'shop@upi');

        expect(api.post).toHaveBeenCalledWith('/wallet/withdraw', { amount: 900, payoutMethod: 'shop@upi' });
    });

    it('getTransactions requests pagination params', async () => {
        await walletService.getTransactions(2, 30);

        expect(api.get).toHaveBeenCalledWith('/wallet/my-transactions', { params: { page: 2, limit: 30 } });
    });
});
