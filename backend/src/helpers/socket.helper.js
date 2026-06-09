const { Server } = require('socket.io');
const logger = require('./logger.helper');

let io = null;

const initSocket = (server) => {
    try {
        io = new Server(server, {
            cors: {
                origin: '*', // Adjust for production
                methods: ['GET', 'POST']
            }
        });

        io.on('connection', (socket) => {
            logger.info(`New client connected: ${socket.id}`);

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });

        logger.info('Socket.io initialized');
        return io;
    } catch (error) {
        logger.error('Failed to initialize Socket.io:', error);
        return null;
    }
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized. Call initSocket first.');
    }
    return io;
};

/**
 * @desc Emit event to all connected clients
 */
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};

/**
 * @desc Emit event to a specific room
 */
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
    }
};

/**
 * @desc Specialized trigger for Admin Dashboard refresh
 */
const triggerDashboardUpdate = () => {
    if (io) {
        io.emit('DASHBOARD_UPDATE');
        logger.info('Broadcasted DASHBOARD_UPDATE to all clients');
    }
};

module.exports = {
    initSocket,
    getIO,
    emitToAll,
    emitToRoom,
    triggerDashboardUpdate
};
