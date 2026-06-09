import api from './api';

export const jobService = {
  /** Customer: create a new job (broadcasting) */
  createJob: (jobData) =>
    api.post('/jobs', jobData),

  /** Customer: get their job history */
  getMyJobs: (status) =>
    api.get('/jobs/my', { params: { status } }),

  /** Admin/Worker: get all jobs */
  getJobs: (params) =>
    api.get('/jobs', { params }),

  /** Get a single job by id */
  getJobById: (id) =>
    api.get(`/jobs/${id}`),

  /** Admin: cancel a job */
  cancelJob: (id) =>
    api.patch(`/jobs/${id}/cancel`),

  /** Worker: complete a job with media and report */
  completeJob: (id, data) =>
    api.post(`/jobs/${id}/complete`, data),

  /** Customer: rate a completed job */
  rateJob: (id, data) =>
    api.post(`/jobs/${id}/rate`, data),

  /** Worker: start a job with OTP */
  startJob: (id, data) =>
    api.post(`/jobs/${id}/start`, data),

  /** Customer: pay for a job */
  payJob: (id, data) =>
    api.post(`/jobs/${id}/pay`, data),

  // ── QUOTES ────────────────────────────────────────────────────────────────

  /** Worker: place a quote on a job */
  placeQuote: (quoteData) =>
    api.post('/quotes', quoteData),

  /** Customer: get all quotes for a job */
  getQuotesForJob: (jobId) =>
    api.get(`/quotes/job/${jobId}`),

  /** Worker: get their own quotes */
  getWorkerQuotes: (status) =>
    api.get('/quotes/worker', { params: { status } }),

  /** Customer: accept a quote */
  acceptQuote: (quoteId) =>
    api.patch(`/quotes/${quoteId}/accept`),

  /** Worker: withdraw a quote */
  withdrawQuote: (quoteId) =>
    api.patch(`/quotes/${quoteId}/withdraw`),

  // ── CATEGORIES ──────────────────────────────────────────────────────────

  /** Get all active categories */
  getCategories: () =>
    api.get('/categories'),

  /** Get subcategories for a category */
  getSubCategories: (categoryId) =>
    api.get(`/categories/${categoryId}/subs`),
};
