import axios from 'axios'

const rawUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : 'https://kwickly-backend-r6zb.onrender.com/api/v1')
const BASE_URL = (rawUrl || '')
  .trim()
  .replace(/kwickly\s+backend\s+r6zb/gi, 'kwickly-backend-r6zb')
  .replace(/\s+/g, '-')

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

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
