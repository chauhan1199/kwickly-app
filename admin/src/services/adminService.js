import api from './api'

/* ── Auth ─────────────────────────────────────────────────────── */
export const adminLogin = (email, password) =>
  api.post('/auth/admin-login', { email, password })

/* ── Dashboard ───────────────────────────────────────────────── */
export const getDashboardStats = () => api.get('/admin/dashboard')

/* ── Users ───────────────────────────────────────────────────── */
export const getUsers    = (params)     => api.get('/customers', { params })
export const blockUser   = (id)         => api.patch(`/admin/users/${id}/block`)
export const verifyUser  = (id)         => api.patch(`/admin/users/${id}/verify`)

/* ── Workers ─────────────────────────────────────────────────── */
export const getWorkers  = (params)     => api.get('/customers', { params: { ...params, role: 'WORKER' } })

/* ── Shops ───────────────────────────────────────────────────── */
export const getShops    = (params)     => api.get('/shops',          { params })
export const reviewShopKyc = (id, status) => api.patch(`/shops/${id}/kyc`, { status })
export const toggleShop  = (id)         => api.patch(`/shops/${id}/toggle`)

/* ── Jobs ────────────────────────────────────────────────────── */
export const getJobs     = (params)     => api.get('/jobs',           { params })
export const cancelJob   = (id)         => api.patch(`/jobs/${id}/cancel`)
export const reassignWorker = (id, workerId) => api.patch(`/jobs/${id}/reassign`, { workerId })

/* ── Categories ──────────────────────────────────────────────── */
export const getCategories    = ()           => api.get('/categories')
export const createCategory   = (data)       => api.post('/categories', data)
export const updateCategory   = (id, data)   => api.patch(`/categories/${id}`, data)
export const deleteCategory   = (id)         => api.delete(`/categories/${id}`)
export const approveCategory  = (id)         => api.patch(`/categories/${id}/approve`)
export const rejectCategory   = (id)         => api.patch(`/categories/${id}/reject`)

/* ── Payouts ─────────────────────────────────────────────────── */
export const getPayouts    = (params) => api.get('/payouts',          { params })
export const approvePayout = (id)     => api.patch(`/payouts/${id}/approve`)
export const rejectPayout  = (id)     => api.patch(`/payouts/${id}/reject`)

/* ── Subscriptions ───────────────────────────────────────────── */
export const getSubscriptions = (params) => api.get('/subscriptions/all', { params })
export const getPlans         = ()        => api.get('/subscriptions/plans')
export const createPlan       = (data)    => api.post('/subscriptions/plans', data)
export const updatePlan       = (id, data) => api.patch(`/subscriptions/plans/${id}`, data)
export const deletePlan       = (id)      => api.delete(`/subscriptions/plans/${id}`)

/* ── KYC ─────────────────────────────────────────────────────── */
export const getKycList  = (params) => api.get('/admin/kyc', { params })
export const approveKyc  = (id)     => api.patch(`/admin/kyc/${id}/approve`)
export const rejectKyc   = (id)     => api.patch(`/admin/kyc/${id}/reject`)

/* ── Ledger / Wallet ─────────────────────────────────────────── */
export const getTransactions = (params) => api.get('/wallet/transactions', { params })
export const adminAdjust     = (data)   => api.post('/wallet/adjust', data)

/* ── Settings ────────────────────────────────────────────────── */
export const getSettings    = ()        => api.get('/settings')
export const updateSettings = (data)    => api.patch('/settings', data)

/* ── Notifications ───────────────────────────────────────────── */
export const getNotifications    = (params) => api.get('/notifications',        { params })
export const createNotification  = (data)   => api.post('/notifications', data)

/* ── Reports ─────────────────────────────────────────────────── */
export const getReports = (params) => api.get('/admin/reports', { params })

/* ── Admin Users ─────────────────────────────────────────────── */
export const getAdminUsers   = ()     => api.get('/admin/users')
export const createAdminUser = (data) => api.post('/admin/users', data)
export const deleteAdminUser = (id)   => api.delete(`/admin/users/${id}`)

/* ── Disputes ────────────────────────────────────────────────── */
export const getDisputes   = ()         => api.get('/jobs/disputes')
export const resolveDispute = (id, resolution) => api.patch(`/admin/disputes/${id}`, { resolution })

/* ── Suggestions ─────────────────────────────────────────────── */
export const getSuggestions     = ()    => api.get('/admin/suggestions')
export const approveSuggestion  = (id)  => api.patch(`/admin/suggestions/${id}/approve`)
export const rejectSuggestion   = (id)  => api.patch(`/admin/suggestions/${id}/reject`)
