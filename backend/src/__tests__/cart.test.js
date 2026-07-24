const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

const Shop = require('../modules/shop/shop.model');
const Product = require('../modules/product/product.model');
const Category = require('../modules/category/category.model');
const Cart = require('../modules/cart/cart.model');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Cart Routes', () => {
    let customerToken, adminToken, customerId;
    let shop, product, category;

    beforeEach(async () => {

        const ts = Date.now().toString(36);
        const customer = await createTestUser({ role: 'CUSTOMER', email: `cartcust_${ts}@test.com`, phone: `85${ts.slice(-8).padStart(8,'0')}` });
        customerToken = generateToken(customer);
        customerId = customer._id;

        const admin = await createTestUser({ role: 'ADMIN', email: `cartadmin_${ts}@test.com`, phone: `86${ts.slice(-8).padStart(8,'0')}` });
        adminToken = generateToken(admin);

        category = await Category.create({ name: 'Test Category', active: true });

        const shopOwner = await createTestUser({ role: 'SHOP', email: `cartshop_${ts}@test.com`, phone: `87${ts.slice(-8).padStart(8,'0')}` });

        shop = await Shop.create({
            ownerId: shopOwner._id,
            name: 'Test Shop',
            category: 'General',
            kyc: { status: 'APPROVED' },
            isOnline: true,
            delivery: { radiusKm: 5, fee: 40, freeAbove: 1000 }
        });

        product = await Product.create({
            shopId: shop._id,
            name: 'Test Product',
            price: 100,
            stock: 50,
            isActive: true,
            category: 'General'
        });
    });

    // ─── GET /api/v1/cart ────────────────────────────────────────────

    describe('GET /api/v1/cart', () => {
        it('should return null cart for new customer', async () => {
            const res = await request(app)
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeNull();
        });

        it('should return the cart with items', async () => {
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 2 });

            const res = await request(app)
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).not.toBeNull();
            expect(res.body.data.items.length).toBe(1);
            expect(res.body.data.items[0].qty).toBe(2);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/cart');
            expect(res.status).toBe(401);
        });

        it('should allow any authenticated role to get cart', async () => {
            const res = await request(app)
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should return expired cart as null after TTL', async () => {
            // Create a cart with an expired expiresAt
            await Cart.create({
                customerId,
                shopId: shop._id,
                items: [{ productId: product._id, name: product.name, price: product.price, qty: 1, stockAtAdd: product.stock }],
                subtotal: 100,
                totalAmount: 100,
                expiresAt: new Date(Date.now() - 1000) // already expired
            });

            const res = await request(app)
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeNull();
        });
    });

    // ─── POST /api/v1/cart ───────────────────────────────────────────

    describe('POST /api/v1/cart', () => {
        it('should create a new cart and add item', async () => {
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 3 });

            expect(res.status).toBe(201);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.items.length).toBe(1);
            expect(res.body.data.items[0].qty).toBe(3);
            expect(res.body.data.subtotal).toBe(300);
            expect(res.body.data.totalAmount).toBe(300);
        });

        it('should add item to existing cart from same shop', async () => {
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 2 });

            const product2 = await Product.create({
                shopId: shop._id,
                name: 'Test Product 2',
                price: 50,
                stock: 20,
                isActive: true,
                category: 'General'
            });

            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product2._id.toString(), qty: 1 });

            expect(res.status).toBe(201);
            expect(res.body.data.items.length).toBe(2);
            expect(res.body.data.subtotal).toBe(250);
            expect(res.body.data.totalAmount).toBe(250);
        });

        it('should increase qty if same product added again', async () => {
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 2 });

            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 3 });

            expect(res.status).toBe(201);
            expect(res.body.data.items.length).toBe(1);
            expect(res.body.data.items[0].qty).toBe(5);
            expect(res.body.data.subtotal).toBe(500);
        });

        it('should return 409 when adding item from different shop', async () => {
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });

            const ts2 = Date.now().toString(36) + '2';
            const shopOwner2 = await createTestUser({ role: 'SHOP', email: `cartshop2_${ts2}@test.com`, phone: `88${ts2.slice(-8).padStart(8,'0')}` });
            const shop2 = await Shop.create({
                ownerId: shopOwner2._id,
                name: 'Test Shop 2',
                kyc: { status: 'APPROVED' },
                isOnline: true
            });

            const productFromShop2 = await Product.create({
                shopId: shop2._id,
                name: 'Product Shop 2',
                price: 200,
                stock: 10,
                isActive: true,
                category: 'General'
            });

            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop2._id.toString(), productId: productFromShop2._id.toString(), qty: 1 });

            expect(res.status).toBe(409);
            expect(res.body.status).toBe('error');
        });

        it('should return 404 if product not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: fakeId.toString(), qty: 1 });

            expect(res.status).toBe(404);
        });

        it('should return 404 if product is inactive', async () => {
            const inactiveProduct = await Product.create({
                shopId: shop._id,
                name: 'Inactive Product',
                price: 50,
                stock: 10,
                isActive: false,
                category: 'General'
            });

            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: inactiveProduct._id.toString(), qty: 1 });

            expect(res.status).toBe(404);
        });

        it('should return 422 if product stock is insufficient', async () => {
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 100 });

            expect(res.status).toBe(422);
        });

        it('should return 403 if shop is not approved', async () => {
            const ts3 = Date.now().toString(36) + '3';
            const shopOwner3 = await createTestUser({ role: 'SHOP', email: `cartshop3_${ts3}@test.com`, phone: `89${ts3.slice(-8).padStart(8,'0')}` });
            const unapprovedShop = await Shop.create({
                ownerId: shopOwner3._id,
                name: 'Unapproved Shop',
                kyc: { status: 'PENDING' },
                isOnline: true
            });

            const productUnapproved = await Product.create({
                shopId: unapprovedShop._id,
                name: 'Product Unapproved',
                price: 100,
                stock: 10,
                isActive: true,
                category: 'General'
            });

            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: unapprovedShop._id.toString(), productId: productUnapproved._id.toString(), qty: 1 });

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/v1/cart')
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });
            expect(res.status).toBe(401);
        });

        it('should reject non-CUSTOMER role', async () => {
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });
            expect(res.status).toBe(403);
        });

        it('should set expiry to 24 hours from now', async () => {
            const before = Date.now();
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });

            expect(res.status).toBe(201);
            const expiresAt = new Date(res.body.data.expiresAt).getTime();
            expect(expiresAt).toBeGreaterThan(before);
            expect(expiresAt).toBeLessThanOrEqual(before + 24 * 60 * 60 * 1000 + 5000);
        });
    });

    // ─── PATCH /api/v1/cart/:itemId ──────────────────────────────────

    describe('PATCH /api/v1/cart/:itemId', () => {
        let cartItemId;

        beforeEach(async () => {
            const addRes = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 5 });

            cartItemId = addRes.body.data.items[0]._id;
        });

        it('should update item qty', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ qty: 3 });

            expect(res.status).toBe(200);
            expect(res.body.data.items[0].qty).toBe(3);
            expect(res.body.data.subtotal).toBe(300);
        });

        it('should remove item if qty <= 0', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ qty: 0 });

            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBe(0);
            expect(res.body.data.subtotal).toBe(0);
        });

        it('should remove item if qty is negative', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ qty: -1 });

            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBe(0);
        });

        it('should return 400 if qty is missing', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 404 if cart not found', async () => {
            const fakeItemId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/v1/cart/${fakeItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ qty: 1 });

            expect(res.status).toBe(404);
        });

        it('should return 404 if item not in cart', async () => {
            const fakeItemId = new mongoose.Types.ObjectId();
            // First ensure we have a cart
            const cartRes = await request(app)
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(cartRes.body.data).not.toBeNull();

            const res = await request(app)
                .patch(`/api/v1/cart/${fakeItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ qty: 1 });

            expect(res.status).toBe(404);
        });

        it('should return 400 if requested qty exceeds stock', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ qty: 200 });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/stock/i);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .send({ qty: 1 });
            expect(res.status).toBe(401);
        });

        it('should reject non-CUSTOMER role', async () => {
            const res = await request(app)
                .patch(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ qty: 1 });
            expect(res.status).toBe(403);
        });
    });

    // ─── DELETE /api/v1/cart/:itemId ─────────────────────────────────

    describe('DELETE /api/v1/cart/:itemId', () => {
        let cartItemId;

        beforeEach(async () => {
            const addRes = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 2 });

            cartItemId = addRes.body.data.items[0]._id;
        });

        it('should remove item from cart', async () => {
            // Add a second item so the cart persists
            const product2 = await Product.create({
                shopId: shop._id,
                name: 'Test Product 2',
                price: 50,
                stock: 20,
                isActive: true,
                category: 'General'
            });
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product2._id.toString(), qty: 1 });

            const res = await request(app)
                .delete(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBe(1);
            expect(res.body.data.subtotal).toBe(50);
        });

        it('should delete entire cart when last item is removed', async () => {
            const res = await request(app)
                .delete(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeNull();

            // Verify cart no longer exists
            const cart = await Cart.findOne({ customerId });
            expect(cart).toBeNull();
        });

        it('should return 404 if cart not found', async () => {
            // Ensure no cart exists for this customer
            await Cart.deleteMany({ customerId });
            const fakeItemId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/v1/cart/${fakeItemId}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app)
                .delete(`/api/v1/cart/${cartItemId}`);
            expect(res.status).toBe(401);
        });

        it('should reject non-CUSTOMER role', async () => {
            const res = await request(app)
                .delete(`/api/v1/cart/${cartItemId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── DELETE /api/v1/cart/clear ───────────────────────────────────

    describe('DELETE /api/v1/cart/clear', () => {
        it('should clear entire cart', async () => {
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 3 });

            const res = await request(app)
                .delete('/api/v1/cart/clear')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeNull();

            const cart = await Cart.findOne({ customerId });
            expect(cart).toBeNull();
        });

        it('should succeed even if no cart exists', async () => {
            const res = await request(app)
                .delete('/api/v1/cart/clear')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
        });

        it('should only clear customer own cart', async () => {
            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 2 });

            // Create second customer
            const ts4 = Date.now().toString(36) + '4';
            const customer2 = await createTestUser({ role: 'CUSTOMER', email: `cartcust2_${ts4}@test.com`, phone: `90${ts4.slice(-8).padStart(8,'0')}` });
            const customer2Token = generateToken(customer2);

            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customer2Token}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });

            // Clear first customer's cart
            const res = await request(app)
                .delete('/api/v1/cart/clear')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);

            // Second customer's cart should still exist
            const cart2 = await Cart.findOne({ customerId: customer2._id });
            expect(cart2).not.toBeNull();
            expect(cart2.items.length).toBe(1);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(app).delete('/api/v1/cart/clear');
            expect(res.status).toBe(401);
        });

        it('should reject non-CUSTOMER role', async () => {
            const res = await request(app)
                .delete('/api/v1/cart/clear')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── Edge cases & integration ────────────────────────────────────

    describe('Edge cases', () => {
        it('should recalculate total after removing an item', async () => {
            const product2 = await Product.create({
                shopId: shop._id,
                name: 'Expensive Product',
                price: 500,
                stock: 5,
                isActive: true,
                category: 'General'
            });

            await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 }); // 100

            const add2Res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product2._id.toString(), qty: 1 }); // 500

            expect(add2Res.body.data.subtotal).toBe(600);

            const itemIdToRemove = add2Res.body.data.items.find(i => i.productId.toString() === product._id.toString())._id;

            const removeRes = await request(app)
                .delete(`/api/v1/cart/${itemIdToRemove}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(removeRes.status).toBe(200);
            expect(removeRes.body.data.subtotal).toBe(500);
            expect(removeRes.body.data.totalAmount).toBe(500);
        });

        it('should handle adding product with sellingPrice when available', async () => {
            // sellingPrice is not a schema field but the controller uses it as fallback
            // so this tests the fallback to .price path
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 2 });

            expect(res.status).toBe(201);
            expect(res.body.data.items[0].price).toBe(100);
        });

        it('should handle adding exactly the stock quantity', async () => {
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 50 });

            expect(res.status).toBe(201);
            expect(res.body.data.items[0].qty).toBe(50);
            expect(res.body.data.subtotal).toBe(5000);
        });

        it('should refresh expiry when adding item to existing cart', async () => {
            // Create cart with near-expiry
            const cart = await Cart.create({
                customerId,
                shopId: shop._id,
                items: [{ productId: product._id, name: product.name, price: product.price, qty: 1, stockAtAdd: product.stock }],
                subtotal: 100,
                totalAmount: 100,
                expiresAt: new Date(Date.now() + 60000) // 1 minute from now
            });

            const oldExpiry = cart.expiresAt.getTime();

            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });

            expect(res.status).toBe(201);
            const newExpiry = new Date(res.body.data.expiresAt).getTime();
            expect(newExpiry).toBeGreaterThan(oldExpiry);
        });

        it('should return correct stockAtAdd in cart item', async () => {
            const res = await request(app)
                .post('/api/v1/cart')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId: shop._id.toString(), productId: product._id.toString(), qty: 1 });

            expect(res.body.data.items[0].stockAtAdd).toBe(50);
        });
    });
});
