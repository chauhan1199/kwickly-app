import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const shopService = {
  getShops: (params) =>
    withErrorHandling(() => api.get('/shops', { params })),

  getShopById: (id) =>
    withErrorHandling(() => api.get(`/shops/${id}`)),

  getMyShops: () =>
    withErrorHandling(() => api.get('/shops/my')),

  getMyShop: () =>
    withErrorHandling(() => api.get('/shops/my')),

  createShop: (data) =>
    withErrorHandling(() => api.post('/shops', data)),

  deleteShop: () =>
    withErrorHandling(() => api.delete('/shops/my')),

  deleteMyShop: () =>
    withErrorHandling(() => api.delete('/shops/my')),

  updateMyShop: (data) =>
    withErrorHandling(() => api.patch('/shops/my', data)),

  updateOwnerName: (name) =>
    withErrorHandling(() => api.patch('/shops/my/owner', { name })),

  setPrimaryPayoutMethod: (id) =>
    withErrorHandling(() => api.patch(`/shops/my/payout-methods/${id}/primary`)),

  withdraw: (amount, payoutMethod) =>
    withErrorHandling(() => api.post('/shops/my/withdraw', { amount, payoutMethod })),

  topUp: (amount, paymentDetails) =>
    withErrorHandling(() => api.post('/wallet/topup', { amount, paymentDetails })),

  updateDeliveryConfig: (shopId, config) =>
    withErrorHandling(() => api.patch(`/shops/${shopId}/delivery-config`, config)),

  updateOrderStatus: (orderId, status, otp, note) =>
    withErrorHandling(() => api.patch(`/shoporders/${orderId}/status`, { status, otp, note })),


  cancelOrder: (orderId) =>
    withErrorHandling(() => api.post(`/shoporders/${orderId}/cancel`)),

  getProducts: (shopId, search) =>
    withErrorHandling(() => api.get('/products', { params: { shopId, search } })),

  getShopProducts: () =>
    withErrorHandling(() => api.get('/products/shop')),

  createProduct: (data) =>
    withErrorHandling(() => api.post('/products', data)),

  updateProduct: (id, data) =>
    withErrorHandling(() => api.patch(`/products/${id}`, data)),

  addProduct: (data) =>
    withErrorHandling(() => api.post('/products', data)),

  deleteProduct: (id) =>
    withErrorHandling(() => api.delete(`/products/${id}`)),

  placeOrder: (orderData) =>
    withErrorHandling(() => api.post('/shoporders', orderData)),

  getCustomerOrders: () =>
    withErrorHandling(() => api.get('/shoporders/customer')),

  getShopOrders: (status) =>
    withErrorHandling(() => api.get('/shoporders/shop', { params: { status } })),

  getOrderById: (id) =>
    withErrorHandling(() => api.get(`/shoporders/${id}`)),

  getOrderInvoice: (id) =>
    withErrorHandling(() => api.get(`/shoporders/${id}/invoice`)),

  getNotifications: () =>
    withErrorHandling(() => api.get('/notifications/my')),

  getMyNotifications: () =>
    withErrorHandling(() => api.get('/notifications/my')),

  markNotificationRead: (id) =>
    withErrorHandling(() => api.patch(`/notifications/${id}/read`)),

  markAllNotificationsRead: () =>
    withErrorHandling(() => api.patch('/notifications/read-all')),

  getWalletBalance: () =>
    withErrorHandling(() => api.get('/wallet/balance')),

  withdrawFromWallet: (amount, payoutMethod) =>
    withErrorHandling(() => api.post('/wallet/withdraw', { amount, payoutMethod })),

  topupWallet: (amount, paymentDetails) =>
    withErrorHandling(() => api.post('/wallet/topup', { amount, paymentDetails })),

  addPayoutMethod: (data) =>
    withErrorHandling(() => api.post('/shops/my/payout-methods', data)),

  deletePayoutMethod: (id) =>
    withErrorHandling(() => api.delete(`/shops/my/payout-methods/${id}`)),

  getSettings: () =>
    withErrorHandling(() => api.get('/settings/public')),

  getPublicSettings: () =>
    withErrorHandling(() => api.get('/settings/public')),

  uploadChatImage: (data) =>
    withErrorHandling(() => api.post('/chat/upload-base64', data)),

  uploadBase64: (data) =>
    withErrorHandling(() => api.post('/chat/upload-base64', data)),

  uploadKycDocument: (data) =>
    withErrorHandling(() => api.post('/shops/my/kyc/documents', data)),

  removeKycDocument: (index) =>
    withErrorHandling(() => api.delete(`/shops/my/kyc/documents/${index}`)),
};
