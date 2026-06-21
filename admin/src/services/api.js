import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

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

export default api
