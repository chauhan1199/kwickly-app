// Central environment config — reads Vite env vars with sensible dev fallbacks.
// Set VITE_API_URL / VITE_SOCKET_URL in .env (dev) and .env.production (build).

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
