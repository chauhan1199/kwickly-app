import api from './api';

export const chatService = {
  /** Get chat history between current user and partner, or for a specific job */
  getChatHistory: (params) =>
    api.get('/chat/history', { params }),

  /** Send a new message (fallback if sockets fail) */
  sendMessage: (data) =>
    api.post('/chat/send', data),
};
