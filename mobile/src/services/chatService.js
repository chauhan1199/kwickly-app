import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const chatService = {
  getChatHistory: (params) =>
    withErrorHandling(() => api.get('/chat/history', { params })),

  sendMessage: (data) =>
    withErrorHandling(() => api.post('/chat/send', data)),

  markRead: (partnerId) =>
    withErrorHandling(() => api.post('/chat/mark-read', { partnerId })),
};
