const Notification = require('../modules/notification/notification.model');
const { getIO } = require('./socket.helper');
const logger = require('./logger.helper');

const logAdminActivity = async (action, entityType, entityId, title, message, adminId) => {
    try {
        const notification = await Notification.create({
            title,
            message,
            type: 'ADMIN_ACTIVITY',
            action,
            entityType,
            entityId,
            performedBy: adminId,
            targetRole: 'ADMIN'
        });
        try {
            const io = getIO();
            if (io) io.to('admin_dashboard').emit('NEW_NOTIFICATION', notification);
        } catch (_) {}
    } catch (e) { 
        logger.error(`[logAdminActivity] Failed: ${e.message}`);
    }
};

module.exports = { logAdminActivity };
