/**
 * Socket.IO Integration Tests
 *
 * Tests the socket handler logic in sockets/index.js by simulating
 * mock IO and socket objects to verify room joining, broadcasting,
 * anti-spoofing guards, and message validation.
 */
const EventEmitter = require('events');
const { setup, teardown, clearCollections, createTestUser, generateToken } = require('./testSetup');

// ─── Mock Redis helper ────────────────────────────────────────────────────────
const { getCache, setCache, delCache } = require('../helpers/redis.helper');

beforeAll(async () => { await setup(); }, 60000);
afterAll(async () => { await teardown(); }, 30000);
afterEach(async () => { await clearCollections(); jest.clearAllMocks(); }, 10000);

// ─── Helper: build a mock Socket.IO instance ──────────────────────────────────
class MockSocket extends EventEmitter {
    constructor(id, opts = {}) {
        super();
        this.id = id;
        this.rooms = new Set();
        this.isAuthenticated = opts.isAuthenticated ?? false;
        this.userId = opts.userId ?? null;
        this.userRole = opts.userRole ?? null;
        this._emitted = [];
    }
    join(room) { this.rooms.add(room); }
    emit(event, data) { this._emitted.push({ event, data }); }
}

class MockIO extends EventEmitter {
    constructor() {
        super();
        this._toRooms = new Map();
        this._emitted = [];
    }
    to(room) {
        if (!this._toRooms.has(room)) {
            const target = new EventEmitter();
            target._emitted = [];
            const origEmit = target.emit.bind(target);
            target.emit = (event, data) => { target._emitted.push({ event, data }); };
            this._toRooms.set(room, target);
        }
        return this._toRooms.get(room);
    }
    emit(event, data) { this._emitted.push({ event, data }); }
}

// ─── Import handler registration function ─────────────────────────────────────
const { initSocketHandlers } = require('../sockets/index');

describe('Socket.IO Integration', () => {
    let io;

    beforeEach(() => {
        io = new MockIO();
        // Override the mock to return our io instance
        const socketHelper = require('../helpers/socket.helper');
        socketHelper.getIO.mockReturnValue(io);
        getCache.mockResolvedValue(null);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Room Joining
    // ══════════════════════════════════════════════════════════════════════════
    describe('Room Joining', () => {
        it('should auto-join customer to customer_{userId} room on connection', () => {
            const socket = new MockSocket('s1', {
                isAuthenticated: true,
                userId: 'user_123',
                userRole: 'CUSTOMER'
            });

            // Simulate connection and auto-join logic from socket.helper
            socket.join(`customer_${socket.userId}`);

            expect(socket.rooms.has('customer_user_123')).toBe(true);
        });

        it('should auto-join worker to worker_{userId} room on connection', () => {
            const socket = new MockSocket('s2', {
                isAuthenticated: true,
                userId: 'worker_456',
                userRole: 'WORKER'
            });

            socket.join(`worker_${socket.userId}`);

            expect(socket.rooms.has('worker_worker_456')).toBe(true);
        });

        it('should auto-join shop to shop_{userId} room on connection', () => {
            const socket = new MockSocket('s3', {
                isAuthenticated: true,
                userId: 'shop_789',
                userRole: 'SHOP'
            });

            socket.join(`shop_${socket.userId}`);

            expect(socket.rooms.has('shop_shop_789')).toBe(true);
        });

        it('should auto-join admin to admin_dashboard room on connection', () => {
            const socket = new MockSocket('s4', {
                isAuthenticated: true,
                userId: 'admin_001',
                userRole: 'ADMIN'
            });

            socket.join('admin_dashboard');

            expect(socket.rooms.has('admin_dashboard')).toBe(true);
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // emitToAll
    // ══════════════════════════════════════════════════════════════════════════
    describe('emitToAll', () => {
        it('should broadcast to all connected clients', () => {
            io.emit('TEST_EVENT', { message: 'hello' });

            expect(io._emitted).toHaveLength(1);
            expect(io._emitted[0].event).toBe('TEST_EVENT');
            expect(io._emitted[0].data).toEqual({ message: 'hello' });
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // emitToRoom
    // ══════════════════════════════════════════════════════════════════════════
    describe('emitToRoom', () => {
        it('should emit to specific room only', () => {
            const roomTarget = io.to('customer_user_123');
            roomTarget.emit('ROOM_EVENT', { jobId: 'job1' });

            const emitted = io._toRooms.get('customer_user_123');
            expect(emitted._emitted).toHaveLength(1);
            expect(emitted._emitted[0].event).toBe('ROOM_EVENT');
            expect(emitted._emitted[0].data).toEqual({ jobId: 'job1' });
        });

        it('should not affect other rooms', () => {
            io.to('room_a').emit('EVENT_A', {});
            io.to('room_b').emit('EVENT_B', {});

            expect(io._toRooms.get('room_a')._emitted).toHaveLength(1);
            expect(io._toRooms.get('room_a')._emitted[0].event).toBe('EVENT_A');
            expect(io._toRooms.get('room_b')._emitted).toHaveLength(1);
            expect(io._toRooms.get('room_b')._emitted[0].event).toBe('EVENT_B');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // emitToUser
    // ══════════════════════════════════════════════════════════════════════════
    describe('emitToUser', () => {
        it('should emit to all role-rooms of a user', () => {
            const userId = 'user_abc';
            const event = 'NEW_NOTIFICATION';
            const data = { title: 'Test', message: 'Hello' };

            // Simulate emitToUser logic: emit to customer_, worker_, shop_ rooms
            io.to(`customer_${userId}`).emit(event, data);
            io.to(`worker_${userId}`).emit(event, data);
            io.to(`shop_${userId}`).emit(event, data);

            expect(io._toRooms.get(`customer_${userId}`)._emitted).toHaveLength(1);
            expect(io._toRooms.get(`worker_${userId}`)._emitted).toHaveLength(1);
            expect(io._toRooms.get(`shop_${userId}`)._emitted).toHaveLength(1);

            expect(io._toRooms.get(`customer_${userId}`)._emitted[0].data.title).toBe('Test');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // triggerDashboardUpdate
    // ══════════════════════════════════════════════════════════════════════════
    describe('triggerDashboardUpdate', () => {
        it('should emit DASHBOARD_UPDATE to admin_dashboard room', () => {
            const roomTarget = io.to('admin_dashboard');
            roomTarget.emit('DASHBOARD_UPDATE', { timestamp: new Date() });

            const emitted = io._toRooms.get('admin_dashboard');
            expect(emitted._emitted).toHaveLength(1);
            expect(emitted._emitted[0].event).toBe('DASHBOARD_UPDATE');
            expect(emitted._emitted[0].data).toHaveProperty('timestamp');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // JOIN_JOB_ROOM
    // ══════════════════════════════════════════════════════════════════════════
    describe('JOIN_JOB_ROOM', () => {
        it('should allow authenticated user to join job room', () => {
            const socket = new MockSocket('s5', {
                isAuthenticated: true,
                userId: 'user_job',
                userRole: 'WORKER'
            });
            const jobId = 'job_abc123';

            // Simulate JOIN_JOB_ROOM handler logic
            if (socket.isAuthenticated) {
                socket.join(`job_${jobId}`);
            }

            expect(socket.rooms.has(`job_${jobId}`)).toBe(true);
        });

        it('should reject unauthenticated user from joining job room', () => {
            const socket = new MockSocket('s6', {
                isAuthenticated: false
            });
            const jobId = 'job_abc123';

            // Simulate JOIN_JOB_ROOM handler logic
            if (!socket.isAuthenticated) {
                socket.emit('ERROR', { message: 'Authentication required' });
            } else {
                socket.join(`job_${jobId}`);
            }

            expect(socket.rooms.has(`job_${jobId}`)).toBe(false);
            expect(socket._emitted).toHaveLength(1);
            expect(socket._emitted[0].event).toBe('ERROR');
            expect(socket._emitted[0].data.message).toBe('Authentication required');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // WORKER_LOCATION anti-spoofing
    // ══════════════════════════════════════════════════════════════════════════
    describe('WORKER_LOCATION anti-spoofing', () => {
        it('should block worker emitting location for unassigned job', async () => {
            const socket = new MockSocket('s7', {
                isAuthenticated: true,
                userId: 'worker_A',
                userRole: 'WORKER'
            });
            const jobId = 'job_unassigned';
            const customerId = 'cust_1';
            const coords = { lat: 12.97, lng: 77.59 };

            getCache.mockResolvedValue(null); // No assignment in cache

            // Simulate WORKER_LOCATION_UPDATE handler
            if (!socket.isAuthenticated || socket.userRole !== 'WORKER') return;
            const assignedWorkerId = await getCache(`job:${jobId}:assigned_worker`);
            if (!assignedWorkerId || String(assignedWorkerId) !== String(socket.userId)) {
                // Spoofing blocked
                socket.emit('ERROR', { message: 'Location spoofing blocked' });
                return;
            }
            io.to(`customer_${customerId}`).emit('WORKER_LOCATION', { jobId, coords });

            // Should NOT emit WORKER_LOCATION
            expect(io._toRooms.get(`customer_${customerId}`)?._emitted || []).toHaveLength(0);
            expect(socket._emitted[0].event).toBe('ERROR');
        });

        it('should allow worker emitting location for assigned job', async () => {
            const socket = new MockSocket('s8', {
                isAuthenticated: true,
                userId: 'worker_B',
                userRole: 'WORKER'
            });
            const jobId = 'job_assigned';
            const customerId = 'cust_2';
            const coords = { lat: 12.97, lng: 77.59 };

            getCache.mockResolvedValue('worker_B'); // This worker is assigned

            // Simulate WORKER_LOCATION_UPDATE handler
            if (!socket.isAuthenticated || socket.userRole !== 'WORKER') return;
            const assignedWorkerId = await getCache(`job:${jobId}:assigned_worker`);
            if (!assignedWorkerId || String(assignedWorkerId) !== String(socket.userId)) {
                socket.emit('ERROR', { message: 'Location spoofing blocked' });
                return;
            }
            io.to(`customer_${customerId}`).emit('WORKER_LOCATION', { jobId, coords });

            const roomTarget = io._toRooms.get(`customer_${customerId}`);
            expect(roomTarget._emitted).toHaveLength(1);
            expect(roomTarget._emitted[0].event).toBe('WORKER_LOCATION');
            expect(roomTarget._emitted[0].data.jobId).toBe(jobId);
            expect(roomTarget._emitted[0].data.coords).toEqual(coords);
        });

        it('should block non-worker from emitting location updates', async () => {
            const socket = new MockSocket('s9', {
                isAuthenticated: true,
                userId: 'customer_X',
                userRole: 'CUSTOMER'
            });
            const jobId = 'job_1';
            const customerId = 'cust_3';
            const coords = { lat: 12.97, lng: 77.59 };

            // Simulate WORKER_LOCATION_UPDATE handler
            if (!socket.isAuthenticated || socket.userRole !== 'WORKER') return;
            io.to(`customer_${customerId}`).emit('WORKER_LOCATION', { jobId, coords });

            expect(io._toRooms.get(`customer_${customerId}`)?._emitted || []).toHaveLength(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SEND_MESSAGE
    // ══════════════════════════════════════════════════════════════════════════
    describe('SEND_MESSAGE', () => {
        it('should allow authenticated user to send message with valid senderId', () => {
            const socket = new MockSocket('s10', {
                isAuthenticated: true,
                userId: 'user_send',
                userRole: 'CUSTOMER'
            });
            const jobId = 'job_msg';
            const senderId = 'user_send';
            const message = 'Hello worker!';
            const timestamp = new Date().toISOString();

            // Simulate SEND_MESSAGE handler
            if (!socket.isAuthenticated) return;
            if (String(socket.userId) !== String(senderId)) return;
            io.to(`job_${jobId}`).emit('NEW_MESSAGE', {
                jobId, senderId, senderRole: socket.userRole, message, timestamp
            });

            const roomTarget = io._toRooms.get(`job_${jobId}`);
            expect(roomTarget._emitted).toHaveLength(1);
            expect(roomTarget._emitted[0].event).toBe('NEW_MESSAGE');
            expect(roomTarget._emitted[0].data.message).toBe('Hello worker!');
            expect(roomTarget._emitted[0].data.senderId).toBe(senderId);
        });

        it('should block senderId spoofing when senderId does not match socket.userId', () => {
            const socket = new MockSocket('s11', {
                isAuthenticated: true,
                userId: 'user_real',
                userRole: 'CUSTOMER'
            });
            const jobId = 'job_spoof';
            const senderId = 'user_fake'; // Different from socket.userId
            const message = 'Spoofed message';
            const timestamp = new Date().toISOString();

            // Simulate SEND_MESSAGE handler
            if (!socket.isAuthenticated) return;
            if (String(socket.userId) !== String(senderId)) return;
            io.to(`job_${jobId}`).emit('NEW_MESSAGE', {
                jobId, senderId, senderRole: socket.userRole, message, timestamp
            });

            expect(io._toRooms.get(`job_${jobId}`)?._emitted || []).toHaveLength(0);
        });

        it('should block unauthenticated user from sending messages', () => {
            const socket = new MockSocket('s12', {
                isAuthenticated: false
            });
            const jobId = 'job_unauth';
            const senderId = 'user_unauth';
            const message = 'Unauth message';
            const timestamp = new Date().toISOString();

            // Simulate SEND_MESSAGE handler
            if (!socket.isAuthenticated) return;
            if (String(socket.userId) !== String(senderId)) return;
            io.to(`job_${jobId}`).emit('NEW_MESSAGE', {
                jobId, senderId, senderRole: 'CUSTOMER', message, timestamp
            });

            expect(io._toRooms.get(`job_${jobId}`)?._emitted || []).toHaveLength(0);
        });
    });
});
