const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');
const Shop = require('../modules/shop/shop.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Shop Owner Self-Service', () => {
    let shopToken, customerToken, adminToken, shopOwnerId;
    let testShop;

    beforeEach(async () => {
        const uid = Date.now().toString(36).slice(-6);
        const shopOwner = await createTestUser({
            role: 'SHOP', email: `sos-s-${uid}@test.com`, phone: `8000${uid}`, name: 'Shop Owner'
        });
        shopToken = generateToken(shopOwner);
        shopOwnerId = shopOwner._id;

        const customer = await createTestUser({
            role: 'CUSTOMER', email: `sos-c-${uid}@test.com`, phone: `8001${uid}`
        });
        customerToken = generateToken(customer);

        const admin = await createTestUser({
            role: 'ADMIN', email: `sos-a-${uid}@test.com`, phone: `8002${uid}`
        });
        adminToken = generateToken(admin);

        testShop = await Shop.create({
            ownerId: shopOwnerId,
            name: 'Test Shop',
            category: 'General',
            address: '123 Main St',
            location: { type: 'Point', coordinates: [72.8777, 19.0760] },
            deliveryConfig: { deliveryRadiusKm: 3, deliveryCharge: 40, freeDeliveryAbove: 1000, minOrderAmount: 100, sameDayDelivery: true, deliverySlots: [] }
        });
    });

    // ── GET /api/v1/shops/my ──────────────────────────────────────────────────
    describe('GET /api/v1/shops/my', () => {
        it('should return the shop owner\'s shop', async () => {
            const res = await request(app)
                .get('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Test Shop');
            expect(res.body.data.ownerId).toBeDefined();
        });

        it('should return 404 when shop owner has no shop', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .get('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/shops/my');
            expect(res.status).toBe(401);
        });

        it('should reject non-shop role', async () => {
            const res = await request(app)
                .get('/api/v1/shops/my')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ── PATCH /api/v1/shops/my ────────────────────────────────────────────────
    describe('PATCH /api/v1/shops/my', () => {
        it('should update shop name', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'New Shop Name' });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('New Shop Name');
        });

        it('should update shop category', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ category: 'Electronics' });
            expect(res.status).toBe(200);
            expect(res.body.data.category).toBe('Electronics');
        });

        it('should update shop description', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ description: 'Best shop in town' });
            expect(res.status).toBe(200);
            expect(res.body.data.description).toBe('Best shop in town');
        });

        it('should update delivery settings', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ deliveryConfig: { deliveryCharge: 50, freeDeliveryAbove: 500 } });
            expect(res.status).toBe(200);
            expect(res.body.data.deliveryConfig.deliveryCharge).toBe(50);
        });

        it('should update business hours', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ businessHours: { monFri: '10 AM - 9 PM', sat: '10 AM - 6 PM', sun: 'Closed' } });
            expect(res.status).toBe(200);
        });

        it('should return 404 when shop does not exist', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'Ghost Shop' });
            expect(res.status).toBe(404);
        });

        it('should reject empty body', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({});
            expect(res.status).toBe(400);
        });

        it('should reject non-shop role', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Not Allowed' });
            expect(res.status).toBe(403);
        });
    });

    // ── PATCH /api/v1/shops/my/owner ──────────────────────────────────────────
    describe('PATCH /api/v1/shops/my/owner', () => {
        it('should update owner name', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my/owner')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ name: 'New Owner Name' });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('New Owner Name');
        });

        it('should reject without name', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my/owner')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({});
            expect(res.status).toBe(400);
        });

        it('should reject non-shop role', async () => {
            const res = await request(app)
                .patch('/api/v1/shops/my/owner')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: 'Impostor' });
            expect(res.status).toBe(403);
        });
    });

    // ── POST /api/v1/shops/my/payout-methods ──────────────────────────────────
    describe('POST /api/v1/shops/my/payout-methods', () => {
        it('should add a UPI payout method', async () => {
            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI', detail: 'shop@upi', label: 'GPay' });
            expect(res.status).toBe(201);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].type).toBe('UPI');
            expect(res.body.data[0].isPrimary).toBe(true);
        });

        it('should add a BANK payout method', async () => {
            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'BANK', detail: '1234567890', label: 'SBI Savings' });
            expect(res.status).toBe(201);
            expect(res.body.data[0].type).toBe('BANK');
        });

        it('should auto-set first payout method as primary', async () => {
            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI', detail: 'shop@upi' });
            expect(res.body.data[0].isPrimary).toBe(true);
        });

        it('should reject without required fields', async () => {
            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI' });
            expect(res.status).toBe(400);
        });

        it('should reject invalid type', async () => {
            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'CRYPTO', detail: 'btc_address' });
            expect(res.status).toBe(400);
        });

        it('should return 404 when shop does not exist', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI', detail: 'shop@upi' });
            expect(res.status).toBe(404);
        });
    });

    // ── PATCH /api/v1/shops/my/payout-methods/:id/primary ─────────────────────
    describe('PATCH /api/v1/shops/my/payout-methods/:methodId/primary', () => {
        let method1Id, method2Id;

        beforeEach(async () => {
            const r1 = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI', detail: 'shop@upi', label: 'GPay' });
            method1Id = r1.body.data[0]._id;

            const r2 = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'BANK', detail: '9876543210', label: 'HDFC' });
            method2Id = r2.body.data[1]._id;
        });

        it('should set second method as primary', async () => {
            const res = await request(app)
                .patch(`/api/v1/shops/my/payout-methods/${method2Id}/primary`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);

            const shop = await Shop.findById(testShop._id);
            const m1 = shop.payoutMethods.id(method1Id);
            const m2 = shop.payoutMethods.id(method2Id);
            expect(m1.isPrimary).toBe(false);
            expect(m2.isPrimary).toBe(true);
        });

        it('should return 404 when shop does not exist', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .patch(`/api/v1/shops/my/payout-methods/${method2Id}/primary`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(404);
        });
    });

    // ── DELETE /api/v1/shops/my/payout-methods/:id ────────────────────────────
    describe('DELETE /api/v1/shops/my/payout-methods/:methodId', () => {
        let methodId;

        beforeEach(async () => {
            const r = await request(app)
                .post('/api/v1/shops/my/payout-methods')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ type: 'UPI', detail: 'shop@upi' });
            methodId = r.body.data[0]._id;
        });

        it('should delete the payout method', async () => {
            const res = await request(app)
                .delete(`/api/v1/shops/my/payout-methods/${methodId}`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(0);
        });

        it('should return 404 when shop does not exist', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .delete(`/api/v1/shops/my/payout-methods/${methodId}`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(404);
        });
    });

    // ── DELETE /api/v1/shops/my ───────────────────────────────────────────────
    describe('DELETE /api/v1/shops/my', () => {
        it('should delete the shop', async () => {
            const res = await request(app)
                .delete('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);

            const shop = await Shop.findById(testShop._id);
            expect(shop).toBeNull();
        });

        it('should return 404 when shop does not exist', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .delete('/api/v1/shops/my')
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(404);
        });

        it('should reject non-shop role', async () => {
            const res = await request(app)
                .delete('/api/v1/shops/my')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).delete('/api/v1/shops/my');
            expect(res.status).toBe(401);
        });
    });

    // ── POST /api/v1/shops/my/withdraw ────────────────────────────────────────
    describe('POST /api/v1/shops/my/withdraw', () => {
        it('should request withdrawal when sufficient balance', async () => {
            await Shop.findByIdAndUpdate(testShop._id, { $set: { 'wallet.balance': 5000 } });

            const res = await request(app)
                .post('/api/v1/shops/my/withdraw')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 1000, payoutMethod: 'shop@upi' });
            expect(res.status).toBe(201);
            expect(res.body.data.txn.status).toBe('PENDING');
            expect(res.body.data.newBalance).toBe(4000);
        });

        it('should reject withdrawal with insufficient balance', async () => {
            await Shop.findByIdAndUpdate(testShop._id, { $set: { 'wallet.balance': 100 } });

            const res = await request(app)
                .post('/api/v1/shops/my/withdraw')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 500, payoutMethod: 'shop@upi' });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/safety balance/i);
        });

        it('should reject without required fields', async () => {
            const res = await request(app)
                .post('/api/v1/shops/my/withdraw')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({});
            expect(res.status).toBe(400);
        });

        it('should return 404 when shop does not exist', async () => {
            await Shop.deleteOne({ ownerId: shopOwnerId });
            const res = await request(app)
                .post('/api/v1/shops/my/withdraw')
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ amount: 100, payoutMethod: 'shop@upi' });
            expect(res.status).toBe(404);
        });
    });

    // ── GET /api/v1/shops/:id/delivery-config ────────────────────────────────
    describe('GET /api/v1/shops/:id/delivery-config', () => {
        it('should return delivery config', async () => {
            const res = await request(app)
                .get(`/api/v1/shops/${testShop._id}/delivery-config`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.deliveryConfig).toBeDefined();
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/v1/shops/${fakeId}/delivery-config`)
                .set('Authorization', `Bearer ${shopToken}`);
            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .get(`/api/v1/shops/${testShop._id}/delivery-config`);
            expect(res.status).toBe(401);
        });
    });

    // ── PATCH /api/v1/shops/:id/delivery-config ──────────────────────────────
    describe('PATCH /api/v1/shops/:id/delivery-config', () => {
        it('should update delivery config as shop owner', async () => {
            const res = await request(app)
                .patch(`/api/v1/shops/${testShop._id}/delivery-config`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    deliveryRadiusKm: 5,
                    deliveryCharge: 30,
                    freeDeliveryAbove: 800,
                    minOrderAmount: 200,
                    sameDayDelivery: false
                });
            expect(res.status).toBe(200);
            expect(res.body.data.deliveryConfig.deliveryRadiusKm).toBe(5);
            expect(res.body.data.deliveryConfig.deliveryCharge).toBe(30);
        });

        it('should allow admin to update delivery config', async () => {
            const res = await request(app)
                .patch(`/api/v1/shops/${testShop._id}/delivery-config`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ deliveryCharge: 25 });
            expect(res.status).toBe(200);
        });

        it('should update discount settings', async () => {
            const res = await request(app)
                .patch(`/api/v1/shops/${testShop._id}/delivery-config`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({
                    discountEnabled: true,
                    discountAbove: 500,
                    discountType: 'percent',
                    discountPct: 10,
                    maxDiscountCap: 150
                });
            expect(res.status).toBe(200);
            expect(res.body.data.deliveryConfig.discountEnabled).toBe(true);
            expect(res.body.data.deliveryConfig.discountPct).toBe(10);
        });

        it('should update delivery slots', async () => {
            const slots = [
                { label: 'Morning', slotOpen: '9:00', slotClose: '12:00' },
                { label: 'Evening', slotOpen: '17:00', slotClose: '21:00' }
            ];
            const res = await request(app)
                .patch(`/api/v1/shops/${testShop._id}/delivery-config`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ deliverySlots: slots });
            expect(res.status).toBe(200);
            expect(res.body.data.deliveryConfig.deliverySlots.length).toBe(2);
        });

        it('should return 404 for non-existent shop', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/shops/${fakeId}/delivery-config`)
                .set('Authorization', `Bearer ${shopToken}`)
                .send({ deliveryCharge: 30 });
            expect(res.status).toBe(404);
        });

        it('should reject non-owner/non-admin', async () => {
            const res = await request(app)
                .patch(`/api/v1/shops/${testShop._id}/delivery-config`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ deliveryCharge: 30 });
            expect(res.status).toBe(403);
        });
    });
});
