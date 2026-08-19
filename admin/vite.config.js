import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://kwickly-backend-r6zb.onrender.com/api/v1'),
    'import.meta.env.VITE_SOCKET_URL': JSON.stringify('https://kwickly-backend-r6zb.onrender.com')
  },
  server: {
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
