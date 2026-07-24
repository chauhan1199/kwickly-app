import api from './api';

export const shopService = {
  getShops: (params) =>
    api.get('/shops', { params }),

  getShopById: (id) =>
    api.get(`/shops/${id}`),

  getMyShop: () =>
    api.get('/shops/my'),

  createShop: (data, config) =>
    api.post('/shops', data, config),

  updateMyShop: (data, config) =>
    api.patch('/shops/my', data, config),

  deleteMyShop: () =>
    api.delete('/shops/my'),

  updateOwnerName: (name) =>
    api.patch('/shops/my/owner', { name }),

  updateDeliveryConfig: (shopId, config) =>
    api.patch(`/shops/${shopId}/delivery-config`, config),

  getProducts: (shopId, search) =>
    api.get('/products', { params: { shopId, search } }),

  getShopProducts: () =>
    api.get('/products/shop'),

  createProduct: (data) =>
    api.post('/products', data),

  updateProduct: (id, data) =>
    api.patch(`/products/${id}`, data),

  deleteProduct: (id) =>
    api.delete(`/products/${id}`),

  placeOrder: (orderData) =>
    api.post('/shoporders', orderData),

  getCustomerOrders: () =>
    api.get('/shoporders/customer'),

  getShopOrders: (status) =>
    api.get('/shoporders/shop', { params: { status } }),

  getOrderById: (id) =>
    api.get(`/shoporders/${id}`),

  updateOrderStatus: (id, status, otp) =>
    api.patch(`/shoporders/${id}/status`, { status, otp }),

  getOrderInvoice: (id) =>
    api.get(`/shoporders/${id}/invoice`),

  getMyNotifications: () =>
    api.get('/notifications/my'),

  markNotificationRead: (id) =>
    api.patch(`/notifications/${id}/read`),

  markAllNotificationsRead: () =>
    api.patch('/notifications/read-all'),

  getWalletBalance: () =>
    api.get('/wallet/balance'),

  withdraw: (amount, payoutMethod) =>
    api.post('/wallet/withdraw', { amount, payoutMethod }),

  topUp: (amount, paymentDetails) =>
    api.post('/wallet/topup', { amount, paymentDetails }),

  addPayoutMethod: (data) =>
    api.post('/shops/my/payout-methods', data),

  deletePayoutMethod: (id) =>
    api.delete(`/shops/my/payout-methods/${id}`),

  setPrimaryPayoutMethod: (id) =>
    api.patch(`/shops/my/payout-methods/${id}/primary`),

  getPublicSettings: () =>
    api.get('/settings/public'),

  uploadBase64: (data) =>
    api.post('/chat/upload-base64', data),
};
