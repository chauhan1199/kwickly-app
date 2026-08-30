// Central environment config.
//
// Resolution order:
//   1. VITE_API_URL / VITE_SOCKET_URL      — explicit override (.env, .env.production, host dashboard)
//   2. production build default             — the live Render backend, so a deploy never needs env vars
//   3. dev default                          — local backend
//
// The backend URL is public (it is called from the browser), so baking it in is safe
// and removes the "deployed admin points at localhost" failure mode.

const PROD_BACKEND = 'https://kwickly-backend-r6zb.onrender.com'

const isProdBuild = import.meta.env.PROD

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (isProdBuild ? `${PROD_BACKEND}/api/v1` : 'http://localhost:5000/api/v1')

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (isProdBuild ? PROD_BACKEND : 'http://localhost:5000')
