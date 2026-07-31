import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const shopService = {
  getShops: (params) =>
    withErrorHandling(() => api.get('/shops', { params })),

  getShopById: (id) =>
    withErrorHandling(() => api.get(`/shops/${id}`)),

  getMyShops: () =>
    withErrorHandling(() => api.get('/shops/my')),

  createShop: (data) =>
    withErrorHandling(() => api.post('/shops', data)),

  deleteShop: () =>
    withErrorHandling(() => api.delete('/shops/my')),

  getProducts: (shopId, search) =>
    withErrorHandling(() => api.get('/products', { params: { shopId, search } })),

  getShopProducts: () =>
    withErrorHandling(() => api.get('/products/shop')),

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

  uploadChatImage: (data) =>
    withErrorHandling(() => api.post('/chat/upload-base64', data)),
};
