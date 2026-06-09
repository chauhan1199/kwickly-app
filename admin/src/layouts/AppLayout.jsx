import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'



const pageTitles = {
  '/':              'Dashboard',
  '/users':         'Customer Management',
  '/workers':       'Worker Management',
  '/shops':         'Shop Management',
  '/jobs':          'Job Management',
  '/kyc':           'KYC Verification',
  '/categories':    'Service Categories',
  '/payouts':       'Payouts & Wallet',
  '/subscriptions': 'Subscription Plans',
  '/ledger':        'Ledger',
  '/disputes':      'Disputes',
  '/suggestions':   'Category Suggestions',
  '/notifications': 'Push Notifications',
  '/reports':       'Reports & Analytics',
  '/admin-users':   'Admin Profile & Security',
  '/settings':      'Platform Settings',
}

import api from '../services/api'
import { io } from 'socket.io-client'

export default function AppLayout({ onLogout }) {
  const location      = useLocation()
  const title         = pageTitles[location.pathname] || 'Kwickly Admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isNotifOpen, setNotifOpen] = useState(false)
  
  const [notifications, setNotifications] = useState([])
  const [badges, setBadges] = useState({ kyc: 0, workers: 0, payouts: 0, support: 0, disputes: 0, suggestions: 0, categories: 0 })
  const [platformSettings, setPlatformSettings] = useState({ appName: 'Kwickly', logoUrl: '', iconUrl: '' })

  useEffect(() => {
    fetchNotifications()
    fetchBadges()
    fetchSettings()

    // Real-time updates
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')
    
    socket.on('NOTIFICATION', (data) => {
      setNotifications(prev => [{
        id: Date.now(),
        title: data.title,
        message: data.message,
        time: 'Just now',
        type: data.targetRole === 'WORKER' ? 'warning' : 'info',
        read: false
      }, ...prev])
    })

    socket.on('DASHBOARD_UPDATE', () => {
      fetchBadges()
    })

    return () => socket.disconnect()
  }, [])

  const fetchBadges = async () => {
    try {
      const resp = await api.get('/admin/badges')
      if (resp.data.status === 'success') {
        setBadges(resp.data.data)
      }
    } catch (e) {
      console.error('Error fetching badges:', e)
    }
  }

  const fetchSettings = async () => {
    try {
      const resp = await api.get('/admin/settings')
      if (resp.data.status === 'success') {
        setPlatformSettings(resp.data.data)
        document.title = `${resp.data.data.appName} Admin`
      }
    } catch (e) {
      console.error('Error fetching settings:', e)
    }
  }

  const navSections = [
    {
      label: 'Platform',
      items: [
        { path: '/',           label: 'Dashboard',    icon: '📊', exact: true },
        { path: '/users',      label: 'Customers',    icon: '👤' },
        { path: '/workers',    label: 'Workers',      icon: '🔧', badge: badges.workers },
        { path: '/shops',      label: 'Shops',        icon: '🏪' },
        { path: '/jobs',       label: 'Jobs',         icon: '📋' },
        { path: '/kyc',        label: 'KYC Queue',    icon: '🪪', badge: badges.kyc },
        { path: '/categories', label: 'Categories',   icon: '📂', badge: badges.categories },
      ],
    },
    {
      label: 'Platform Ext',
      items: [
        { path: '/disputes',   label: 'Disputes',     icon: '⚖️', badge: badges.disputes },
        { path: '/suggestions', label: 'Suggestions',  icon: '💡', badge: badges.suggestions },
      ]
    },
    {
      label: 'Finance',
      items: [
        { path: '/payouts',       label: 'Payouts',        icon: '💰', badge: badges.payouts },
        { path: '/ledger',        label: 'Ledger',         icon: '📖' },
        { path: '/subscriptions', label: 'Subscriptions',  icon: '🎯' },
      ],
    },
    {
      label: 'Communications',
      items: [
        { path: '/notifications', label: 'Notifications',  icon: '📣' },
      ],
    },
    {
      label: 'System & Analytics',
      items: [
        { path: '/reports',     label: 'Reports',     icon: '📈' },
        { path: '/admin-users', label: 'Admin Profile', icon: '🔐' },
        { path: '/settings',    label: 'Settings',    icon: '⚙️' },
      ],
    },
  ]

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/admin/notifications')
      if (response.data.status === 'success') {
        const data = response.data.data.map(n => ({
          id: n._id,
          title: n.title,
          message: n.message,
          time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: n.targetRole === 'WORKER' ? 'warning' : 'info',
          read: true // Assuming archived ones are read
        }))
        setNotifications(data)
      }
    } catch (e) {
      console.error('Error fetching notifications:', e)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])
  useEffect(() => {
    const h = (e) => { 
      if (e.key === 'Escape') { 
        setSidebarOpen(false)
        setNotifOpen(false)
      } 
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">✕</button>

        <div className="sidebar-logo" style={{ flexDirection: platformSettings.logoUrl ? 'column' : 'row', alignItems: platformSettings.logoUrl ? 'flex-start' : 'center', gap: platformSettings.logoUrl ? '12px' : '12px' }}>
          {platformSettings.logoUrl ? (
            <img src={platformSettings.logoUrl} alt="Logo" className="sidebar-custom-logo" />
          ) : (
            <>
              <div className="sidebar-logo-icon-wrap">
                <svg viewBox="0 0 100 100" className="logo-svg" fill="none">
                  <path d="M50 10 A40 40 0 1 1 10 50 A40 40 0 0 1 50 10" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                  <path d="M50 10 L60 0 M50 10 L60 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                  <path d="M30 70 V45 L50 30 L70 45 V70 H30 Z" fill="currentColor" />
                  <path d="M48 70 V58 H52 V70" stroke="var(--sidebar-bg)" strokeWidth="4" />
                </svg>
              </div>
              <div className="sidebar-logo-text-group">
                <div className="sidebar-logo-text">{platformSettings.appName}</div>
                <div className="sidebar-logo-subtext">Admin Control Panel</div>
              </div>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
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
            <div className="sidebar-user-avatar">SA</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Super Admin</div>
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
            <div className="topbar-breadcrumb">{platformSettings.appName} / {title}</div>
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <div className="topbar-live">
              <span className="live-dot" />
              Live
            </div>
            <div className="topbar-notif-wrap">
              <button 
                className={`topbar-btn${isNotifOpen ? ' active' : ''}`} 
                onClick={() => setNotifOpen(!isNotifOpen)}
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
              </button>

              {isNotifOpen && (
                <>
                  <div className="notif-overlay" onClick={() => setNotifOpen(false)} />
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <h3>Notifications</h3>
                      <button className="mark-read-btn" onClick={markAllRead}>Mark all read</button>
                    </div>
                    <div className="notif-list">
                      {notifications.map(n => (
                        <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`}>
                          <div className={`notif-type-dot ${n.type}`} />
                          <div className="notif-content">
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                            <div className="notif-time">{n.time}</div>
                          </div>
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
