/**
 * notifyUser — Triple-redundancy notification system.
 * 1. Persists to DB (in-app bell icon)
 * 2. Emits real-time socket event to user's room
 * 3. Sends FCM push notification if user has a device token
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
    let notification = null;

    // ── 1. Persist to Database ────────────────────────────────────────────────
    try {
        notification = await Notification.create({
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
        logger.error('[notifyUser] Failed to create DB notification:', err.message);
        return;
    }

    // ── 2. Real-time Socket Push ──────────────────────────────────────────────
    try {
        const { emitToUser } = require('./socket.helper');
        emitToUser(String(userId), 'NEW_NOTIFICATION', {
            _id: notification?._id,
            title,
            message,
            action,
            entityType,
            entityId,
            createdAt: new Date()
        });
    } catch (err) {
        logger.error('[notifyUser] Socket emit failed:', err.message);
    }

    // ── 3. FCM Push Notification ──────────────────────────────────────────────
    try {
        const Customer = require('../modules/customer/customer.model');
        const user = await Customer.findById(userId).select('+fcmToken').lean();

        if (user?.fcmToken) {
            await sendFCMPush(user.fcmToken, title, message, {
                action,
                entityType,
                entityId: entityId ? String(entityId) : undefined,
                notificationId: notification?._id ? String(notification._id) : undefined
            });
        }
    } catch (err) {
        logger.error('[notifyUser] FCM push failed:', err.message);
    }
};

/**
 * sendFCMPush — Send push notification via Firebase Cloud Messaging
 * Uses FCM HTTP v1 API via Firebase Admin SDK (if initialized) or legacy API as fallback
 */
const sendFCMPush = async (fcmToken, title, body, data = {}) => {
    if (!fcmToken) return;

    // Sanitize data — FCM only accepts string values
    const sanitizedData = Object.fromEntries(
        Object.entries(data)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
    );

    // Try Firebase Admin SDK first (preferred)
    try {
        const admin = getFirebaseAdmin();
        if (admin) {
            await admin.messaging().send({
                token: fcmToken,
                notification: { title, body },
                data: sanitizedData,
                android: {
                    priority: 'high',
                    notification: { sound: 'default', channelId: 'kwickly_notifications' }
                },
                apns: {
                    payload: { aps: { sound: 'default', badge: 1 } }
                }
            });
            return;
        }
    } catch (err) {
        logger.error('[FCM] Admin SDK send failed:', err.message);
    }

    // Fallback: Legacy FCM HTTP API
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey || serverKey === 'firebase_cloud_messaging_server_key') return;

    try {
        const https = require('https');
        const payload = JSON.stringify({
            to: fcmToken,
            notification: { title, body, sound: 'default' },
            data: sanitizedData,
            priority: 'high'
        });

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'fcm.googleapis.com',
                path: '/fcm/send',
                method: 'POST',
                headers: {
                    'Authorization': `key=${serverKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                res.on('data', () => {});
                res.on('end', resolve);
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    } catch (err) {
        logger.error('[FCM] Legacy HTTP send failed:', err.message);
    }
};

/**
 * Initialize Firebase Admin SDK (lazy singleton)
 */
let firebaseAdminApp = null;
const getFirebaseAdmin = () => {
    if (firebaseAdminApp) return firebaseAdminApp;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId || projectId === 'your_firebase_project_id') return null;

    try {
        const admin = require('firebase-admin');
        if (admin.apps.length > 0) {
            firebaseAdminApp = admin.apps[0];
            return firebaseAdminApp;
        }

        // Initialize with application default credentials or service account
        firebaseAdminApp = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId
        });

        logger.info('[Firebase] Admin SDK initialized for project: ' + projectId);
        return firebaseAdminApp;
    } catch (err) {
        // firebase-admin not installed or credentials not configured — graceful fallback
        logger.warn('[Firebase] Admin SDK not available:', err.message);
        return null;
    }
};

module.exports = { notifyUser, sendFCMPush };
