import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const jobService = {
  createJob: (jobData) =>
    withErrorHandling(() => api.post('/jobs', jobData)),

  getMyJobs: (status) =>
    withErrorHandling(() => api.get('/jobs/my', { params: { status } })),

  getActiveJob: () =>
    withErrorHandling(() => api.get('/customers/jobs/active')),

  getAvailableJobs: (params) =>
    withErrorHandling(() => api.get('/jobs', { params })),

  getJobById: (id) =>
    withErrorHandling(() => api.get(`/jobs/${id}`)),

  completeJob: (id, data) =>
    withErrorHandling(() => api.post(`/jobs/${id}/complete`, data)),

  rateJob: (id, data) =>
    withErrorHandling(() => api.post(`/jobs/${id}/rate`, data)),

  startJob: (id, data) =>
    withErrorHandling(() => api.post(`/jobs/${id}/start`, data)),

  payForJob: (id, data) =>
    withErrorHandling(() => api.post(`/jobs/${id}/pay`, data)),

  getJobReceipt: (id) =>
    withErrorHandling(() => api.get(`/customers/jobs/${id}/receipt`)),

  getAvailableJobsForWorker: () =>
    withErrorHandling(() => api.get('/jobs/available')),

  getWorkerJobs: (status) =>
    withErrorHandling(() => api.get('/jobs/worker', { params: { status } })),

  placeQuote: (quoteData) =>
    withErrorHandling(() => api.post('/quotes', quoteData)),

  getQuotesForJob: (jobId) =>
    withErrorHandling(() => api.get(`/quotes/job/${jobId}`)),

  getMyQuotes: (status) =>
    withErrorHandling(() => api.get('/quotes/worker', { params: { status } })),

  uploadMedia: (formData) =>
    withErrorHandling(() => api.post('/jobs/upload-media', formData)),

  getCategories: () =>
    withErrorHandling(() => api.get('/categories')),

  getCategoryById: (categoryId) =>
    withErrorHandling(() => api.get(`/categories/${categoryId}`)),

  uploadChatImage: (formData) =>
    withErrorHandling(() => api.post('/chat/upload-image', formData)),
};
