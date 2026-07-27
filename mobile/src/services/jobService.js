import api from './api';

export const jobService = {
  createJob: (jobData) =>
    api.post('/jobs', jobData),

  getMyJobs: (status) =>
    api.get('/jobs/my', { params: { status } }),

  getActiveJob: () =>
    api.get('/customers/jobs/active'),

  getJobs: (params) =>
    api.get('/jobs', { params }),

  getJobById: (id) =>
    api.get(`/jobs/${id}`),

  cancelJob: (id) =>
    api.patch(`/jobs/${id}/cancel`),

  completeJob: (id, data) =>
    api.post(`/jobs/${id}/complete`, data),

  rateJob: (id, data) =>
    api.post(`/jobs/${id}/rate`, data),

  startJob: (id, data) =>
    api.post(`/jobs/${id}/start`, data),

  payJob: (id, data) =>
    api.post(`/jobs/${id}/pay`, data),

  getJobReceipt: (id) =>
    api.get(`/customers/jobs/${id}/receipt`),

  getAvailableJobs: () =>
    api.get('/jobs/available'),

  getWorkerJobs: (status) =>
    api.get('/jobs/worker', { params: { status } }),

  placeQuote: (quoteData) =>
    api.post('/quotes', quoteData),

  getQuotesForJob: (jobId) =>
    api.get(`/quotes/job/${jobId}`),

  getWorkerQuotes: (status) =>
    api.get('/quotes/worker', { params: { status } }),

  uploadMedia: (formData) =>
    api.post('/jobs/upload-media', formData),

  acceptQuote: (quoteId) =>
    api.patch(`/quotes/${quoteId}/accept`),

  withdrawQuote: (quoteId) =>
    api.patch(`/quotes/${quoteId}/withdraw`),

  getCategories: () =>
    api.get('/categories'),

  getSubCategories: (categoryId) =>
    api.get(`/categories/${categoryId}`),

  uploadImage: (formData) =>
    api.post('/chat/upload-image', formData),
};
