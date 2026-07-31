import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const notificationService = {
  getNotifications: () =>
    withErrorHandling(() => api.get('/notifications/my')),

  getUnreadCount: () =>
    withErrorHandling(() => api.get('/notifications/unread-count')),

  markAsRead: (id) =>
    withErrorHandling(() => api.post('/notifications/mark-read', { id })),

  markAllAsRead: () =>
    withErrorHandling(() => api.post('/notifications/mark-all-read')),

  deleteNotification: (id) =>
    withErrorHandling(() => api.delete(`/notifications/${id}`)),
};

export default notificationService;
