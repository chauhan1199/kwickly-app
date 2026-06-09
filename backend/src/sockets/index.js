/**
 * Socket.io Real-time Handler — Kwickly
 * Manages rooms for customers, workers, shops, and the admin dashboard.
 *
 * Room naming conventions:
 *   customer_{userId}    — a specific customer's real-time feed
 *   worker_{userId}      — a specific worker's real-time feed
 *   shop_{shopId}        — a specific shop's order feed
 *   job_{jobId}          — all bidders watching a job (job taken / cancelled)
 *   admin_dashboard      — admin panel live stats
 */
const { getIO }  = require('../helpers/socket.helper');
const logger     = require('../helpers/logger.helper');

const initSocketHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        logger.info(`[Socket] Connected: ${socket.id}`);

        /* ── Room Join Handlers ──────────────────────────────────────── */

        socket.on('JOIN_CUSTOMER_ROOM', ({ userId }) => {
            socket.join(`customer_${userId}`);
            logger.info(`[Socket] Customer ${userId} joined room`);
        });

        socket.on('JOIN_WORKER_ROOM', async ({ userId }) => {
            socket.join(`worker_${userId}`);
            logger.info(`[Socket] Worker ${userId} joined room`);

            // On reconnection, worker might have missed a broadcast.
            // In a production environment, you'd send pending broadcasts here, or
            // trigger a signal for the client to run a "fetch active state" API call.
            socket.emit('SYNC_STATE_REQUIRED', { message: 'Please sync active jobs' });
        });

        socket.on('JOIN_SHOP_ROOM', ({ shopId }) => {
            socket.join(`shop_${shopId}`);
            logger.info(`[Socket] Shop ${shopId} joined room`);
        });

        socket.on('JOIN_JOB_ROOM', ({ jobId }) => {
            socket.join(`job_${jobId}`);
            logger.info(`[Socket] Socket joined job room ${jobId}`);
        });

        socket.on('JOIN_ADMIN', () => {
            socket.join('admin_dashboard');
            logger.info(`[Socket] Admin joined dashboard room`);
        });

        /* ── Worker Location Update ──────────────────────────────────── */

        socket.on('WORKER_LOCATION_UPDATE', ({ jobId, customerId, coords }) => {
            // Relay live location to the customer tracking the job
            io.to(`customer_${customerId}`).emit('WORKER_LOCATION', { jobId, coords });
        });

        /* ── Chat Messages ───────────────────────────────────────────── */

        socket.on('SEND_MESSAGE', ({ jobId, senderId, senderRole, message, timestamp }) => {
            // Broadcast message to all in the job room (customer + worker)
            io.to(`job_${jobId}`).emit('NEW_MESSAGE', {
                jobId, senderId, senderRole, message, timestamp
            });
        });

        /* ── OTP Verification ────────────────────────────────────────── */

        socket.on('OTP_VERIFIED', ({ jobId, customerId, workerId }) => {
            // Notify worker that customer has confirmed OTP
            io.to(`worker_${workerId}`).emit('START_TIMER', { jobId });
            // Notify customer that work timer has started
            io.to(`customer_${customerId}`).emit('WORK_STARTED', { jobId });
        });

        /* ── Job Completion ──────────────────────────────────────────── */

        socket.on('WORK_COMPLETED', ({ jobId, customerId }) => {
            io.to(`customer_${customerId}`).emit('REQUEST_PAYMENT', { jobId });
        });

        /* ── Admin Dashboard Push ────────────────────────────────────── */

        socket.on('SUBSCRIBE_DASHBOARD', () => {
            socket.join('admin_dashboard');
        });

        /* ── Disconnect ──────────────────────────────────────────────── */

        socket.on('disconnect', () => {
            logger.info(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    logger.info('[Socket] Kwickly socket handlers registered');
};

module.exports = { initSocketHandlers };
