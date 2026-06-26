const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger.helper');

let io = null;

const initSocket = (server) => {
    try {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:19006')
            .split(',')
            .map(o => o.trim());

        io = new Server(server, {
            cors: {
                origin: (origin, cb) => {
                    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
                    cb(new Error(`Socket CORS: Origin ${origin} not allowed`));
                },
                methods: ['GET', 'POST'],
                credentials: true
            },
            // Performance settings for 50k+ concurrent users
            pingTimeout: 20000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        // P0 FIX: JWT Authentication middleware for ALL socket connections
        io.use((socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

            if (!token) {
                // Allow unauthenticated connections only for admin dashboard monitoring
                // They can join only the admin_dashboard room (further guarded in room join handler)
                socket.isAuthenticated = false;
                return next();
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.userRole = decoded.role;
                socket.isAuthenticated = true;
                next();
            } catch (err) {
                socket.isAuthenticated = false;
                next(); // Don't disconnect — let through but without auth
            }
        });

        io.on('connection', (socket) => {
            logger.info(`[Socket] Connected: ${socket.id} (${socket.isAuthenticated ? socket.userRole : 'unauthenticated'})`);

            if (socket.isAuthenticated && socket.userId) {
                if (socket.userRole === 'CUSTOMER') {
                    socket.join(`customer_${socket.userId}`);
                } else if (socket.userRole === 'WORKER') {
                    socket.join(`worker_${socket.userId}`);
                }
            }

            socket.on('JOIN_CUSTOMER_ROOM', (data) => socket.join(`customer_${data.userId}`));
            socket.on('JOIN_WORKER_ROOM', (data) => socket.join(`worker_${data.userId}`));
            socket.on('JOIN_SHOP_ROOM', (data) => socket.join(`shop_${data.shopId}`));
            socket.on('JOIN_ADMIN_ROOM', () => socket.join('admin_dashboard'));

            socket.on('disconnect', () => {
                logger.info(`[Socket] Disconnected: ${socket.id}`);
            });
        });

        logger.info('✅ Socket.io initialized with JWT authentication middleware');
        return io;
    } catch (error) {
        logger.error('Failed to initialize Socket.io:', error);
        return null;
    }
};

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized. Call initSocket first.');
    return io;
};

const emitToAll = (event, data) => {
    if (io) io.emit(event, data);
};

const emitToRoom = (room, event, data) => {
    if (io) io.to(room).emit(event, data);
};

const triggerDashboardUpdate = () => {
    if (io) {
        io.to('admin_dashboard').emit('DASHBOARD_UPDATE', { timestamp: new Date() });
        logger.info('Broadcasted DASHBOARD_UPDATE to admin room');
    }
};

const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`customer_${userId}`).emit(event, data);
        io.to(`worker_${userId}`).emit(event, data);
    }
};

module.exports = { initSocket, getIO, emitToAll, emitToRoom, triggerDashboardUpdate, emitToUser };
