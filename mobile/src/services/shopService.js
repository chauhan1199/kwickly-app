import api from './api';

export const shopService = {
  // ── SHOPS ────────────────────────────────────────────────────────────────

  /** Customer: browse nearby shops */
  getShops: (params) =>
    api.get('/shops', { params }),

  /** Get a shop by id */
  getShopById: (id) =>
    api.get(`/shops/${id}`),

  /** Shop owner: get own shop */
  getMyShop: () =>
    api.get('/shops/my'),

  /** Shop owner: create shop */
  createShop: (data) =>
    api.post('/shops', data),

  /** Shop owner: update shop */
  updateMyShop: (data) =>
    api.patch('/shops/my', data),

  // ── PRODUCTS ────────────────────────────────────────────────────────────

  /** Get products for a shop */
  getProducts: (shopId, search) =>
    api.get('/products', { params: { shopId, search } }),

  /** Shop owner: create product */
  createProduct: (data) =>
    api.post('/products', data),

  /** Shop owner: update product */
  updateProduct: (id, data) =>
    api.patch(`/products/${id}`, data),

  /** Shop owner: delete product */
  deleteProduct: (id) =>
    api.delete(`/products/${id}`),

  // ── ORDERS ──────────────────────────────────────────────────────────────

  /** Customer: place a shop order */
  placeOrder: (orderData) =>
    api.post('/shoporders', orderData),

  /** Customer: get their order history */
  getCustomerOrders: () =>
    api.get('/shoporders/customer'),

  /** Shop owner: get orders for their shop */
  getShopOrders: (status) =>
    api.get('/shoporders/shop', { params: { status } }),

  /** Get a single order */
  getOrderById: (id) =>
    api.get(`/shoporders/${id}`),

  /** Shop owner: advance order status */
  updateOrderStatus: (id, status) =>
    api.patch(`/shoporders/${id}/status`, { status }),
};
