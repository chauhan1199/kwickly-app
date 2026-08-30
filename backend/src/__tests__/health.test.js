const request = require('supertest');
const app = require('../app');
const { setup, teardown, clearCollections } = require('./testSetup');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); }, 10000);

describe('Health Check', () => {
    it('GET /health should return 200 with status ok and DB state', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.db).toBe('connected');
        expect(res.body.timestamp).toBeDefined();
        // Tracing header must be present on every response
        expect(res.headers['x-request-id']).toBeDefined();
    });
});

describe('404 Handler', () => {
    it('GET /nonexistent should return 404', async () => {
        const res = await request(app).get('/api/v1/nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.status).toBe('error');
    });
});
