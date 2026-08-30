/**
 * Service-layer tests for worker & shop subscription (Direct UPI) payloads.
 */
jest.mock('../src/services/api', () => {
    const post = jest.fn(() => Promise.resolve({ data: { status: 'success', data: {} } }));
    const get = jest.fn(() => Promise.resolve({ data: { status: 'success', data: {} } }));
    return { __esModule: true, default: { post, get, interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } } };
});

import api from '../src/services/api';
import { workerService } from '../src/services/workerService';
import { shopService } from '../src/services/shopService';

describe('Subscription services — Direct UPI payloads', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('workerService.subscribe posts planId + UTR with targetRole WORKER', async () => {
        await workerService.subscribe({ planId: 'worker_monthly', utrNumber: '498571700121' });

        expect(api.post).toHaveBeenCalledWith('/subscriptions/subscribe', expect.objectContaining({
            planId: 'worker_monthly',
            paymentMethod: 'UPI',
            utrNumber: '498571700121',
            targetRole: 'WORKER'
        }));
    });

    it('workerService.subscribe defaults paymentMethod to UPI', async () => {
        await workerService.subscribe({ planId: 'p1', utrNumber: '498571700121' });

        expect(api.post).toHaveBeenCalledWith('/subscriptions/subscribe', expect.objectContaining({
            paymentMethod: 'UPI'
        }));
    });

    it('shopService.subscribePlan posts planId + UTR with targetRole SHOP', async () => {
        await shopService.subscribePlan({ planId: 'shop_monthly', utrNumber: '498571700121' });

        expect(api.post).toHaveBeenCalledWith('/subscriptions/subscribe', expect.objectContaining({
            planId: 'shop_monthly',
            paymentMethod: 'UPI',
            utrNumber: '498571700121',
            targetRole: 'SHOP'
        }));
    });

    it('subscribe routes never send a gateway/paymentId-only payload', async () => {
        await workerService.subscribe({ planId: 'p1', utrNumber: '498571700121' });

        const payload = api.post.mock.calls[0][1];
        // Direct UPI: the UTR is the single source of payment truth
        expect(payload.utrNumber).toBeDefined();
        expect(payload.paymentMethod).toBe('UPI');
    });
});
