const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger.helper');

let io = null;

const initSocket = (server) => {
    try {
        // First-party admin panel is always allowed (see app.js) so a missing
        // ALLOWED_ORIGINS on the host can't kill the dashboard's live updates.
        const allowedOrigins = [
            'https://kwickly-app.vercel.app',
            ...(process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:19006')
                .split(',')
                .map(o => o.trim())
                .filter(Boolean),
        ];

        io = new Server(server, {
            cors: {
                origin: (origin, cb) => {
                    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
                    cb(new Error(`Socket CORS: Origin ${origin} not allowed`));
                },
                methods: ['GET', 'POST'],
                credentials: true
            },
            // ─── 100K Scale Settings ───────────────────────────────────────────
            pingTimeout: 20000,          // Drop connection after 20s of no pong
            pingInterval: 25000,         // Ping every 25s
            maxHttpBufferSize: 1e6,      // 1MB max message size (prevents memory DoS)
            connectTimeout: 10000,       // 10s connection timeout
            transports: ['websocket', 'polling'],
            // Compress messages > 1KB (reduces bandwidth at scale)
            perMessageDeflate: {
                zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
                threshold: 1024
            },
            httpCompression: true,
            // Adapter-level ack timeout for Redis pub/sub reliability
            ackTimeout: 5000
        });

        // ─── Redis Pub/Sub Adapter (Horizontal Scaling) ───────────────────────
        try {
            const { createAdapter } = require('@socket.io/redis-adapter');
            const { getRedis } = require('./redis.helper');
            const pubClient = getRedis();
            if (pubClient) {
                const attachRedisAdapter = () => {
                    try {
                        const subClient = pubClient.duplicate({ enableOfflineQueue: true });
                        subClient.on('error', (err) => {
                            logger.debug(`Redis subClient error: ${err.message}`);
                        });
                        subClient.once('ready', () => {
                            try {
                                io.adapter(createAdapter(pubClient, subClient));
                                logger.info('Socket.io bound to Redis Pub/Sub adapter for clustering');
                            } catch (err) {
                                logger.warn('Failed to bind Redis adapter:', err.message);
                            }
                        });
                    } catch (err) {
                        logger.warn('Failed to duplicate Redis client:', err.message);
                    }
                };

                if (pubClient.status === 'ready') {
                    attachRedisAdapter();
                } else {
                    pubClient.once('ready', attachRedisAdapter);
                }
            } else {
                logger.warn('Redis not available. Socket.io in local memory mode.');
            }
        } catch (adapterErr) {
            logger.warn('Redis adapter setup failed, running in local mode:', adapterErr.message);
        }

        // ─── JWT Authentication Middleware ────────────────────────────────────
        io.use(async (socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) return next(new Error('Authentication required'));

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Check if token has been blacklisted (logged out)
                const { getCache } = require('./redis.helper');
                const isBlacklisted = await getCache(`blacklist:${token}`);
                if (isBlacklisted) {
                    return next(new Error('Token has been invalidated'));
                }

                socket.userId = decoded.id;
                socket.userRole = decoded.role;
                socket.isAuthenticated = true;
                next();
            } catch (err) {
                next(new Error('Invalid token'));
            }
        });

        // ─── Connection Handler ───────────────────────────────────────────────
        io.on('connection', (socket) => {
            logger.info(`[Socket] Connected: ${socket.id} (${socket.userRole || 'unauthenticated'})`);

            if (socket.isAuthenticated && socket.userId) {
                // Personal room — all roles (used by notifyUser for targeted delivery)
                socket.join(`user_${socket.userId}`);

                if (socket.userRole === 'CUSTOMER') {
                    socket.join(`customer_${socket.userId}`);
                } else if (socket.userRole === 'WORKER') {
                    socket.join(`worker_${socket.userId}`);
                } else if (socket.userRole === 'SHOP') {
                    socket.join(`shop_${socket.userId}`);
                } else if (socket.userRole === 'ADMIN') {
                    socket.join('admin_dashboard');
                }
            }

            socket.on('disconnect', () => {
                logger.info(`[Socket] Disconnected: ${socket.id}`);
            });
        });

        logger.info('✅ Socket.io initialized with JWT middleware and 100K scale settings');
        return io;
    } catch (error) {
        logger.error('Failed to initialize Socket.io:', error);
        return null;
    }
};

const getIO = () => {
    if (!io) {
        logger.warn('Socket.io not initialized. getIO() returning null.');
        return null;
    }
    return io;
};

/**
 * Emit to ALL connected clients (use sparingly — only for global events).
 * When `data.targetRole` is set, emits only to sockets in that role's rooms
 * (worker_*, shop_*, customer_*) instead of broadcasting to every socket.
 */
const emitToAll = (event, data) => {
    if (!io) return;
    if (event === 'DASHBOARD_UPDATE') {
        io.to('admin_dashboard').emit(event, { ...data, timestamp: new Date() });
        return;
    }

    const targetRole = data && data.targetRole;
    const rolePrefix = targetRole === 'WORKER' ? 'worker_'
        : targetRole === 'SHOP' ? 'shop_'
        : targetRole === 'CUSTOMER' ? 'customer_'
        : null;

    if (!rolePrefix) {
        io.emit(event, data);
        return;
    }

    for (const socket of io.sockets.sockets.values()) {
        for (const room of socket.rooms.keys()) {
            if (room.startsWith(rolePrefix)) {
                socket.emit(event, data);
                break;
            }
        }
    }
};

/**
 * Emit to a specific room (customer_X, worker_X, shop_X, admin_dashboard, job_X)
 */
const emitToRoom = (room, event, data) => {
    if (io) io.to(room).emit(event, data);
};

/**
 * Emit to a user across all their possible role rooms.
 * Used by notifyUser for real-time bell icon update.
 * Also targets the personal user_X room for guaranteed delivery.
 */
const emitToUser = (userId, event, data) => {
    if (!io || !userId) return;
    // user_X room: personal, set on connection regardless of role
    io.to(`user_${userId}`)
      .to(`customer_${userId}`)
      .to(`worker_${userId}`)
      .to(`shop_${userId}`)
      .emit(event, data);
};

/**
 * Emit DASHBOARD_UPDATE only to the admin room
 */
const triggerDashboardUpdate = (payload = {}) => {
    if (io) {
        io.to('admin_dashboard').emit('DASHBOARD_UPDATE', { ...payload, timestamp: new Date() });
    }
};

module.exports = { initSocket, getIO, emitToAll, emitToRoom, triggerDashboardUpdate, emitToUser };
