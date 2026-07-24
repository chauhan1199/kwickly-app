import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'
import { io } from 'socket.io-client'

const actionIcons = {
  CREATE: '➕', UPDATE: '✏️', DELETE: '🗑️', TOGGLE_STATUS: '🔄', KYC: '🪪', PAYOUT: '💰', WALLET_CREDIT: '💚', WALLET_DEBIT: '🔴', BROADCAST: '📣', SYSTEM: '⚙️', OTHER: '📋'
}

const entityTypeLabels = {
  CUSTOMER: 'Customer', WORKER: 'Worker', SHOP: 'Shop', JOB: 'Job', ORDER: 'Order',
  PAYOUT: 'Payout', KYC: 'KYC', CATEGORY: 'Category', PROMOTION: 'Promotion', SETTINGS: 'Settings', PRODUCT: 'Product', OTHER: 'Other'
}

const pageTitles = {
  '/':              'Dashboard',
  '/users':         'Customer Management',
  '/workers':       'Worker Management',
  '/shops':         'Shop Management',
  '/jobs':          'Job Management',
  '/orders':        'Orders Management',
  '/settlements':   'Settlements',
  '/promotions':    'Promotions & Banners',
  '/kyc':           'KYC Verification',
  '/categories':    'Service Categories',
  '/payouts':       'Payouts & Wallet',
  '/subscriptions': 'Subscription Plans',
  '/wallets':        'User Wallets',
  '/admin-wallet':   'Admin Platform Wallet',
  '/ledger':        'Ledger',
  '/disputes':      'Disputes',
  '/suggestions':   'Category Suggestions',
  '/notifications': 'Push Notifications',
  '/reports':       'Reports & Analytics',
  '/admin-users':   'Admin Profile & Security',
  '/settings':      'Platform Settings',
}

export default function AppLayout({ onLogout }) {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Kwickly Admin'
  const { theme, toggleTheme, isDark } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isNotifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [badges, setBadges] = useState({ kyc: 0, workers: 0, payouts: 0, support: 0, disputes: 0, suggestions: 0, categories: 0 })
  const [platformSettings, setPlatformSettings] = useState({ appName: 'Kwickly', logoUrl: '', iconUrl: '' })
  const [user, setUser] = useState(null)

  const getUserId = () => {
    try { return user?._id || JSON.parse(localStorage.getItem('kwickly_admin_user') || '{}')._id } catch { return null }
  }

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('kwickly_admin_user')); if (u) setUser(u) } catch {}
    fetchBadges()
    fetchSettings()
    const token = localStorage.getItem('kwickly_admin_token')
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token } })
    socket.on('connect', () => {
      socket.emit('JOIN_ADMIN_ROOM')
    })
    socket.on('NEW_NOTIFICATION', (data) => {
      const userId = getUserId()
      setNotifications(prev => [{
        _id: data._id || Date.now().toString(),
        title: data.title,
        message: data.message,
        time: 'Just now',
        action: data.action,
        entityType: data.entityType,
        read: userId ? (data.readBy || []).includes(userId) : false,
        type: data.action || 'OTHER'
      }, ...prev])
    })
    socket.on('DASHBOARD_UPDATE', () => {
      fetchBadges();
      window.dispatchEvent(new Event('admin-action'));
    })
    return () => socket.disconnect()
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [user])

  useEffect(() => {
    const handler = () => { fetchNotifications(); fetchBadges() }
    window.addEventListener('admin-action', handler)
    return () => window.removeEventListener('admin-action', handler)
  }, [])

  const fetchBadges = async () => { try { const r = await api.get('/admin/badges'); if (r.data.status === 'success') setBadges(r.data.data) } catch {} }
  const fetchSettings = async () => { try { const r = await api.get('/admin/settings'); if (r.data.status === 'success') { setPlatformSettings(r.data.data); document.title = `${r.data.data.appName} Admin` } } catch {} }
  const fetchNotifications = async () => {
    try {
      const userId = getUserId()
      const r = await api.get('/admin/notifications')
      if (r.data.status === 'success') setNotifications(r.data.data.map(n => ({
        _id: n._id,
        title: n.title,
        message: n.message,
        time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timeFull: new Date(n.createdAt).toLocaleString(),
        action: n.action,
        entityType: n.entityType,
        read: userId ? (n.readBy || []).includes(userId) : false,
        type: n.action || (n.targetRole === 'WORKER' ? 'warning' : 'info')
      })))
    } catch (e) { /* silently ignored */ }
  }

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await api.patch('/admin/notifications/read-all')
    } catch {}
    try { await fetchNotifications() } catch {}
  }

  const markOneRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { setSidebarOpen(false); setNotifOpen(false) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const navSections = [
    { label: 'Overview', items: [{ path: '/', label: 'Dashboard', icon: '📊', exact: true }] },
    { label: 'Management', items: [
      { path: '/users', label: 'Customers', icon: '👤' },
      { path: '/workers', label: 'Workers', icon: '🔧', badge: badges.workers },
      { path: '/shops', label: 'Shops', icon: '🏪' },
      { path: '/jobs', label: 'Jobs', icon: '📋' },
      { path: '/orders', label: 'Orders', icon: '🛒' },
      { path: '/kyc', label: 'KYC Queue', icon: '🪪', badge: (badges.kyc || 0) + (badges.shopKyc || 0) },
      { path: '/categories', label: 'Categories', icon: '📂', badge: badges.categories },
    ]},
    { label: 'Platform', items: [
      { path: '/promotions', label: 'Promotions', icon: '🎯' },
      { path: '/support-chats', label: 'Support Chats', icon: '💬' },
      { path: '/settlements', label: 'Settlements', icon: '🏦' },
      { path: '/disputes', label: 'Disputes', icon: '⚖️', badge: badges.disputes },
    ]},
    { label: 'Finance', items: [
      { path: '/admin-wallet', label: 'Admin Wallet', icon: '🏦' },
      { path: '/wallets', label: 'User Wallets', icon: '💰' },
      { path: '/payouts', label: 'Payouts', icon: '💸', badge: badges.payouts },
      { path: '/ledger', label: 'Ledger', icon: '📖' },
      { path: '/subscriptions', label: 'Subscriptions', icon: '🎯' },
    ]},
    { label: 'System', items: [
      { path: '/notifications', label: 'Notifications', icon: '📣' },
      { path: '/reports', label: 'Reports', icon: '📈' },
      { path: '/admin-users', label: 'Admin Profile', icon: '🔐' },
      { path: '/settings', label: 'Settings', icon: '⚙️' },
    ]},
  ]

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'SA'

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">✕</button>

        <div className="sidebar-logo">
          <img src="/logowithtext.jpeg" alt="Kwickly" className="sidebar-logo-img" style={{ width: 160, height: 44, borderRadius: 8 }} />
        </div>

        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(item => (
                <NavLink key={item.path} to={item.path} end={item.exact} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={onLogout} title="Click to logout">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name || 'Super Admin'}</div>
              <div className="sidebar-user-role">Logout →</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="topbar-title-wrap">
            <div className="topbar-title">{title}</div>
            <div className="topbar-breadcrumb">{platformSettings.appName || 'Kwickly'} / {title}</div>
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            {/* Theme Toggle */}
            <button className="topbar-btn" onClick={toggleTheme} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
              {isDark ? '☀️' : '🌙'}
            </button>

            <div className="topbar-live">
              <span className="live-dot" />
              Live
            </div>

            <div className="topbar-notif-wrap">
              <button className={`topbar-btn${isNotifOpen ? ' active' : ''}`} onClick={() => setNotifOpen(!isNotifOpen)} title="Notifications">
                🔔
                {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
              </button>
              {isNotifOpen && (
                <>
                  <div className="notif-overlay" onClick={() => setNotifOpen(false)} />
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <h3>Activity Log</h3>
                      <button className="mark-read-btn" onClick={markAllRead}>Mark all read</button>
                    </div>
                    <div className="notif-list">
                      {notifications.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--mid)', fontSize: 13 }}>No notifications yet</div>
                      ) : notifications.map(n => (
                        <div key={n._id} className={`notif-item ${n.read ? 'read' : 'unread'}`} onClick={() => !n.read && markOneRead(n._id)} style={{ cursor: n.read ? 'default' : 'pointer' }}>
                          <div className="notif-type-dot">{actionIcons[n.action] || '📋'}</div>
                          <div className="notif-content">
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                            <div className="notif-time">{n.timeFull || n.time}</div>
                          </div>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00B4D8', flexShrink: 0, marginTop: 4 }} />}
                        </div>
                      ))}
                    </div>
                    <div className="notif-footer">
                      <Link to="/notifications" onClick={() => setNotifOpen(false)}>View all notifications</Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
