/**
 * notifyUser — Create a DIRECT notification for a specific user.
 * 
 * @param {Object} params
 * @param {string} params.userId      - Target user _id
 * @param {string} params.title       - Short title
 * @param {string} params.message     - Longer body text
 * @param {string} params.action      - From the Notification.action enum
 * @param {string} params.entityType  - From the Notification.entityType enum
 * @param {string} [params.entityId]  - Optional reference _id
 * @param {string} [params.targetRole] - 'CUSTOMER' | 'WORKER' | 'SHOP' (default 'CUSTOMER')
 */
const Notification = require('../modules/notification/notification.model');
const logger = require('./logger.helper');

const notifyUser = async ({ userId, title, message, action, entityType, entityId, targetRole = 'CUSTOMER' }) => {
    try {
        await Notification.create({
            userId,
            title,
            message,
            type: 'DIRECT',
            action,
            entityType,
            entityId,
            targetRole
        });
    } catch (err) {
        // Never throw from notification helper — don't break the main flow
        logger.error('[notifyUser] Failed to create notification:', err.message);
    }
};

module.exports = { notifyUser };
