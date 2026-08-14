import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const notificationService = {
  getNotifications: () =>
    withErrorHandling(() => api.get('/notifications/my')),

  getMyNotifications: () =>
    withErrorHandling(() => api.get('/notifications/my')),

  getUnreadCount: () =>
    withErrorHandling(() => api.get('/notifications/unread-count')),

  registerPushToken: (fcmToken) =>
    withErrorHandling(() => api.post('/notifications/push-token', { fcmToken })),

  markAsRead: (id) =>
    withErrorHandling(() => api.patch(`/notifications/${id}/read`)),

  markRead: (id) =>
    withErrorHandling(() => api.patch(`/notifications/${id}/read`)),

  markAllAsRead: () =>
    withErrorHandling(() => api.patch('/notifications/read-all')),

  markAllRead: () =>
    withErrorHandling(() => api.patch('/notifications/read-all')),

  deleteNotification: (id) =>
    withErrorHandling(() => api.delete(`/notifications/${id}`)),
};

export default notificationService;
