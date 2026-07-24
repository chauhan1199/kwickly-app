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
const { getCache } = require('../helpers/redis.helper');
const logger    = require('../helpers/logger.helper');

const initSocketHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        logger.info(`[Socket] Connected: ${socket.id} | Auth: ${socket.isAuthenticated} | Role: ${socket.userRole || 'none'}`);

        /* ── Room Join Handlers (with authentication guards) ──────── */
        // Removed JOIN_CUSTOMER_ROOM, JOIN_WORKER_ROOM, JOIN_SHOP_ROOM, JOIN_ADMIN
        // as they are automatically handled securely in socket.helper.js on connection based on JWT role.

        socket.on('JOIN_JOB_ROOM', ({ jobId }) => {
            // Workers and customers can join job rooms to receive bid updates
            if (!socket.isAuthenticated) return socket.emit('ERROR', { message: 'Authentication required' });
            socket.join(`job_${jobId}`);
            logger.info(`[Socket] Socket ${socket.id} joined job room ${jobId}`);
        });

        /* ── Worker Location Updates (P0: Server-verified assignment) ── */

        socket.on('WORKER_LOCATION_UPDATE', async ({ jobId, customerId, coords }) => {
            if (!socket.isAuthenticated || socket.userRole !== 'WORKER') return;

            // Verify this worker is actually assigned to this job via Redis cache
            const assignedWorkerId = await getCache(`job:${jobId}:assigned_worker`);
            if (!assignedWorkerId || String(assignedWorkerId) !== String(socket.userId)) {
                logger.warn(`[Socket] Location spoofing blocked: worker ${socket.userId} tried to broadcast for job ${jobId}`);
                return;
            }

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
    });

    logger.info('[Socket] Kwickly socket handlers registered');
};

module.exports = { initSocketHandlers };
