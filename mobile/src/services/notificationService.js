import api from './api';

const notificationService = {
  /** Get all my notifications with unread count */
  getMyNotifications: () =>
    api.get('/notifications/my'),

  /** Get only the unread count (lightweight, for badge) */
  getUnreadCount: () =>
    api.get('/notifications/unread-count'),

  /** Mark a single notification as read */
  markRead: (id) =>
    api.patch(`/notifications/${id}/read`),

  /** Mark all notifications as read */
  markAllRead: () =>
    api.patch('/notifications/read-all'),

  /** Soft-delete a notification for this user */
  deleteNotification: (id) =>
    api.delete(`/notifications/${id}`),
};

export default notificationService;
