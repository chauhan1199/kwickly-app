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
const mongoose  = require('mongoose');
const Job       = require('../modules/job/job.model');

const initSocketHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        logger.info(`[Socket] Connected: ${socket.id} | Auth: ${socket.isAuthenticated} | Role: ${socket.userRole || 'none'}`);

        /* ── Room Join Handlers (with authentication guards) ──────── */
        // Removed JOIN_CUSTOMER_ROOM, JOIN_WORKER_ROOM, JOIN_SHOP_ROOM, JOIN_ADMIN
        // as they are automatically handled securely in socket.helper.js on connection based on JWT role.

        socket.on('JOIN_JOB_ROOM', async ({ jobId } = {}) => {
            if (!socket.isAuthenticated) return socket.emit('ERROR', { message: 'Authentication required' });
            if (!mongoose.isValidObjectId(jobId)) return socket.emit('ERROR', { message: 'Job not found' });

            let job;
            try {
                job = await Job.findById(jobId).select('customerId workerId').lean();
            } catch (err) {
                logger.warn(`[Socket] JOIN_JOB_ROOM lookup failed for ${jobId}: ${err.message}`);
                return socket.emit('ERROR', { message: 'Could not join job room' });
            }
            if (!job) return socket.emit('ERROR', { message: 'Job not found' });
            if (socket.userRole !== 'ADMIN' && job.customerId?.toString() !== socket.userId && job.workerId?.toString() !== socket.userId) {
                return socket.emit('ERROR', { message: 'Access denied' });
            }

            socket.join(`job_${jobId}`);
            logger.info(`[Socket] Socket ${socket.id} joined job room ${jobId}`);
        });

        /* ── Worker Location Updates (P0: Server-verified assignment) ── */

        socket.on('WORKER_LOCATION_UPDATE', async ({ jobId, coords } = {}) => {
            if (!socket.isAuthenticated || socket.userRole !== 'WORKER') return;
            if (!mongoose.isValidObjectId(jobId)) return;

            try {
                // Verify this worker is actually assigned to this job via Redis cache
                const assignedWorkerId = await getCache(`job:${jobId}:assigned_worker`);
                if (!assignedWorkerId || String(assignedWorkerId) !== String(socket.userId)) {
                    logger.warn(`[Socket] Location spoofing blocked: worker ${socket.userId} tried to broadcast for job ${jobId}`);
                    return;
                }

                // The recipient comes from the job itself, never from the client payload,
                // so a worker can't stream their location into another customer's room.
                // Cached per socket because location updates arrive every few seconds.
                socket.jobCustomers = socket.jobCustomers || new Map();
                let customerId = socket.jobCustomers.get(jobId);
                if (!customerId) {
                    const job = await Job.findOne({ _id: jobId, workerId: socket.userId }).select('customerId').lean();
                    if (!job) return;
                    customerId = String(job.customerId);
                    socket.jobCustomers.set(jobId, customerId);
                }

                io.to(`customer_${customerId}`).emit('WORKER_LOCATION', { jobId, coords });
            } catch (err) {
                logger.warn(`[Socket] WORKER_LOCATION_UPDATE failed for ${jobId}: ${err.message}`);
            }
        });

        /* ── In-app Chat ─────────────────────────────────────────── */

        socket.on('SEND_MESSAGE', ({ jobId, senderId, message, timestamp }) => {
            if (!socket.isAuthenticated) return;
            if (String(socket.userId) !== String(senderId)) return;
            if (typeof message !== 'string') return;
            // Only participants who passed the JOIN_JOB_ROOM check may post into a job's chat
            if (!socket.rooms.has(`job_${jobId}`)) return;
            const sanitizedMessage = message.replace(/<[^>]*>/g, '').trim().substring(0, 2000);
            io.to(`job_${jobId}`).emit('NEW_MESSAGE', {
                jobId, senderId, senderRole: socket.userRole, message: sanitizedMessage, timestamp
            });
        });
    });

    logger.info('[Socket] Kwickly socket handlers registered');
};

module.exports = { initSocketHandlers };
