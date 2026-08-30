import axios from 'axios'
import { API_URL } from '../config'

const BASE_URL = API_URL

// The API instance sleeps when idle and can take ~30s to answer the first
// request, so a short timeout would make every cold start look like an outage.
const DEFAULT_TIMEOUT = 30000
const COLD_START_TIMEOUT = 60000

const api = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: { 'Content-Type': 'application/json' }
})

/**
 * Fire-and-forget ping that wakes a sleeping backend while the operator is
 * still looking at the login screen. Never throws.
 */
export const warmUpBackend = () => {
  axios
    .get(`${BASE_URL.replace(/\/api\/v1\/?$/, '')}/health`, { timeout: COLD_START_TIMEOUT })
    .catch(() => {})
}

// Inject token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('kwickly_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401
api.interceptors.response.use(
  res => res,
  err => {
    // Retry reads once on a transport failure (cold start, dropped connection).
    // Writes are never replayed — a timed-out POST may already have been applied.
    const config = err.config
    const method = (config?.method || 'get').toLowerCase()
    if (config && !config.__retried && !err.response && (method === 'get' || method === 'head')) {
      config.__retried = true
      config.timeout = COLD_START_TIMEOUT
      return api(config)
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('kwickly_admin_token')
      localStorage.removeItem('kwickly_admin_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const SERVER_URL = BASE_URL.replace(/\/api\/v1\/?$/, '')

/**
 * Resolves an image URL to a full absolute URL.
 * Handles Cloudinary URLs (always absolute), relative paths, and bare filenames.
 */
export const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${SERVER_URL}${url}`
  return `${SERVER_URL}/${url}`
}

export default api
