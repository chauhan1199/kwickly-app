import React, { useState } from 'react'
import api from '../../services/api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({ appName: 'Kwickly', logoUrl: '' })

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const resp = await api.get('/admin/settings/branding')
        if (resp.data.status === 'success') {
          setSettings(resp.data.data)
        }
      } catch (e) { console.error(e) }
    }
    fetchSettings()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token, user } = response.data.data
      
      localStorage.setItem('kwickly_admin_token', token)
      localStorage.setItem('kwickly_admin_user', JSON.stringify(user))
      
      onLogin()
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" style={{ maxWidth: '240px', maxHeight: '60px', objectFit: 'contain', marginBottom: '16px' }} />
          ) : (
            <div className="login-logo-icon-wrap">
              <svg viewBox="0 0 100 100" className="logo-svg" fill="none">
                <path d="M50 10 A40 40 0 1 1 10 50 A40 40 0 0 1 50 10" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <path d="M50 10 L60 0 M50 10 L60 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <path d="M30 70 V45 L50 30 L70 45 V70 H30 Z" fill="currentColor" />
                <path d="M48 70 V58 H52 V70" stroke="white" strokeWidth="4" />
              </svg>
            </div>
          )}
          {!settings.logoUrl && <div className="login-logo-text">{settings.appName}</div>}
          <div className="login-subtitle">Admin Control Panel</div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="admin@kwickly.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--light)', fontFamily: 'var(--font-body)' }}>
          System Credentials Active
        </div>
      </div>
    </div>
  )
}
