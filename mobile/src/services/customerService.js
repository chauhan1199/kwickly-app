import api from './api';

export const customerService = {
  /** Customer: get top pros (workers) */
  getTopPros: () =>
    api.get('/customers/top-pros'),

  /** Update Customer Profile */
  updateProfile: (data) =>
    api.patch('/customers/me/profile', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  /** Addresses */
  addAddress: (data) =>
    api.post('/customers/me/addresses', data),
  
  updateAddress: (id, data) =>
    api.put(`/customers/me/addresses/${id}`, data),

  deleteAddress: (id) =>
    api.delete(`/customers/me/addresses/${id}`),

  setPrimaryAddress: (id) =>
    api.patch(`/customers/me/addresses/${id}/primary`),
};
