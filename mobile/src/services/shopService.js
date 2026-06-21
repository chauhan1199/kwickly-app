import api from './api';

export const shopService = {
  getShops: (params) =>
    api.get('/shops', { params }),

  getShopById: (id) =>
    api.get(`/shops/${id}`),

  getMyShop: () =>
    api.get('/shops/my'),

  createShop: (data) =>
    api.post('/shops', data),

  updateMyShop: (data) =>
    api.patch('/shops/my', data),

  deleteMyShop: () =>
    api.delete('/shops/my'),

  updateOwnerName: (name) =>
    api.patch('/shops/my/owner', { name }),

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
};
