import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { warmUpBackend } from './services/api'
import App from './App.jsx'

// Wake a sleeping backend now so the login request isn't the one that waits out
// the cold start.
warmUpBackend()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
