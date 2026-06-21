/**
 * Socket.io Real-time Handler — Kwickly (Production Hardened)
 * Room naming conventions:
 *   customer_{userId}    — customer's real-time feed
 *   worker_{userId}      — worker's real-time feed
 *   shop_{shopId}        — shop's order feed
 *   job_{jobId}          — all bidders on a job
 *   admin_dashboard      — admin panel live stats (requires ADMIN role)
 */
const { getIO } = require('../helpers/socket.helper');
const logger    = require('../helpers/logger.helper');

const initSocketHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        logger.info(`[Socket] Connected: ${socket.id} | Auth: ${socket.isAuthenticated} | Role: ${socket.userRole || 'none'}`);

        /* ── Room Join Handlers (with authentication guards) ──────── */

        socket.on('JOIN_CUSTOMER_ROOM', ({ userId }) => {
            // Only allow if authenticated as the same user or as admin
            if (!socket.isAuthenticated) return socket.emit('ERROR', { message: 'Authentication required' });
            if (socket.userRole !== 'ADMIN' && String(socket.userId) !== String(userId)) {
                return socket.emit('ERROR', { message: 'Forbidden: Cannot join another user\'s room' });
            }
            socket.join(`customer_${userId}`);
            logger.info(`[Socket] Customer ${userId} joined room`);
        });

        socket.on('JOIN_WORKER_ROOM', ({ userId }) => {
            if (!socket.isAuthenticated) return socket.emit('ERROR', { message: 'Authentication required' });
            if (socket.userRole !== 'ADMIN' && String(socket.userId) !== String(userId)) {
                return socket.emit('ERROR', { message: 'Forbidden' });
            }
            socket.join(`worker_${userId}`);
            logger.info(`[Socket] Worker ${userId} joined room`);

            // Signal client to sync active job state on reconnection
            socket.emit('SYNC_STATE_REQUIRED', { message: 'Please sync active jobs' });
        });

        socket.on('JOIN_SHOP_ROOM', ({ shopId }) => {
            if (!socket.isAuthenticated) return socket.emit('ERROR', { message: 'Authentication required' });
            if (!['SHOP', 'ADMIN'].includes(socket.userRole)) {
                return socket.emit('ERROR', { message: 'Forbidden' });
            }
            socket.join(`shop_${shopId}`);
            logger.info(`[Socket] Shop ${shopId} joined room`);
        });

        socket.on('JOIN_JOB_ROOM', ({ jobId }) => {
            // Workers and customers can join job rooms to receive bid updates
            if (!socket.isAuthenticated) return socket.emit('ERROR', { message: 'Authentication required' });
            socket.join(`job_${jobId}`);
            logger.info(`[Socket] Socket ${socket.id} joined job room ${jobId}`);
        });

        socket.on('JOIN_ADMIN', () => {
            // Only ADMIN role can join the admin dashboard room
            if (!socket.isAuthenticated || socket.userRole !== 'ADMIN') {
                return socket.emit('ERROR', { message: 'Forbidden: Admin access required' });
            }
            socket.join('admin_dashboard');
            logger.info(`[Socket] Admin ${socket.userId} joined dashboard`);
        });

        /* ── Worker Location Updates ──────────────────────────────── */

        socket.on('WORKER_LOCATION_UPDATE', ({ jobId, customerId, coords }) => {
            if (!socket.isAuthenticated || socket.userRole !== 'WORKER') return;
            io.to(`customer_${customerId}`).emit('WORKER_LOCATION', { jobId, coords });
        });

        /* ── In-app Chat ─────────────────────────────────────────── */

        socket.on('SEND_MESSAGE', ({ jobId, senderId, senderRole, message, timestamp }) => {
            if (!socket.isAuthenticated) return;
            // Validate sender is who they claim to be
            if (String(socket.userId) !== String(senderId)) return;
            io.to(`job_${jobId}`).emit('NEW_MESSAGE', {
                jobId, senderId, senderRole, message, timestamp
            });
        });

        /* ── OTP Verification ────────────────────────────────────── */

        socket.on('OTP_VERIFIED', ({ jobId, customerId, workerId }) => {
            if (!socket.isAuthenticated) return;
            io.to(`worker_${workerId}`).emit('START_TIMER', { jobId });
            io.to(`customer_${customerId}`).emit('WORK_STARTED', { jobId });
        });

        /* ── Job Completion ──────────────────────────────────────── */

        socket.on('WORK_COMPLETED', ({ jobId, customerId }) => {
            if (!socket.isAuthenticated) return;
            io.to(`customer_${customerId}`).emit('REQUEST_PAYMENT', { jobId });
        });

        /* ── Admin Dashboard Subscription ───────────────────────── */

        socket.on('SUBSCRIBE_DASHBOARD', () => {
            if (!socket.isAuthenticated || socket.userRole !== 'ADMIN') {
                return socket.emit('ERROR', { message: 'Admin access required' });
            }
            socket.join('admin_dashboard');
        });

        /* ── Disconnect ──────────────────────────────────────────── */

        socket.on('disconnect', (reason) => {
            logger.info(`[Socket] Disconnected: ${socket.id} | Reason: ${reason}`);
        });
    });

    logger.info('[Socket] Kwickly socket handlers registered');
};

module.exports = { initSocketHandlers };
