import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import api from '../../services/api'

// Removed static chartData and maxJobs

export default function Dashboard() {
  const [chartMode, setChartMode] = useState('jobs')
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalWorkers: 0,
    activeJobs: 0,
    totalRevenue: 0,
    activities: [],
    topWorkers: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()

    // Connect socket for real-time dashboard updates
    let socket
    try {
      socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        transports: ['websocket'],
        reconnectionAttempts: 3,
      })
      socket.on('DASHBOARD_UPDATE', () => fetchStats())
    } catch (e) {
      console.warn('Socket connection failed, continuing without real-time updates')
    }

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats')
      if (response.data.status === 'success') {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>Initializing dashboard...</div>

  const s = stats || {
    totalCustomers: 0,
    totalWorkers: 0,
    activeJobs: 0,
    totalRevenue: 0,
    activities: [],
    topWorkers: [],
    chartData: []
  }

  const currentChartData = s.chartData || []
  const maxJobs = currentChartData.length > 0 ? Math.max(...currentChartData.map(d => d.jobs)) : 100
  const maxRev = currentChartData.length > 0 ? Math.max(...currentChartData.map(x => x.revenue)) : 10000

  const kpis = [
    { label: 'Active Jobs', value: s.activeJobs, change: '+12%', up: true, icon: '📋', color: 'blue' },
    { label: 'Total Revenue', value: `₹${(s.totalRevenue || 0).toLocaleString('en-IN')}`, change: '+8.4%', up: true, icon: '💰', color: 'green' },
    { label: 'Total Workers', value: s.totalWorkers, change: '+5%', up: true, icon: '🔧', color: 'orange' },
    { label: 'Total Customers', value: s.totalCustomers, change: '+21%', up: true, icon: '👤', color: 'purple' },
  ]

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <div className="card-title">🚀 Dashboard Overview</div>
        <button className="btn btn-outline btn-sm" onClick={fetchStats}>🔄 Refresh Stats</button>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <div className={`kpi-icon ${k.color}`}>{k.icon}</div>
            <div className="kpi-value">{loading ? '...' : k.value}</div>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-change ${k.up ? 'up' : 'down'}`}>
              {k.up ? '↑' : '↓'} {k.change} this week
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 dash-grid-2" style={{ gap: 16, marginBottom: 16 }}>
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📈 Weekly Performance</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn btn-sm ${chartMode === 'jobs' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartMode('jobs')}
              >Jobs</button>
              <button
                className={`btn btn-sm ${chartMode === 'revenue' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartMode('revenue')}
              >Revenue</button>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              {currentChartData.map((d, i) => {
                const val = chartMode === 'jobs' ? d.jobs : d.revenue
                const max = chartMode === 'jobs' ? maxJobs : maxRev
                const pct = max > 0 ? (val / max) * 100 : 0
                return (
                  <div
                    key={i}
                    className="chart-bar"
                    style={{ height: `${pct}%` }}
                    title={chartMode === 'jobs' ? `${d.jobs} jobs` : `₹${d.revenue.toLocaleString('en-IN')}`}
                  />
                )
              })}
            </div>
            <div className="chart-labels">
              {currentChartData.map((d, i) => <div key={i} className="chart-label">{d.day}</div>)}
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚡ Live Activity</div>
            <span className="badge badge-success">Real-time</span>
          </div>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div className="timeline">
              {(s.activities || []).map((a, i) => (
                <div key={i} className="activity-item">
                  <span className={`activity-dot ${a.color}`} style={{ marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div className="activity-text">{a.text}</div>
                    <div className="activity-time">
                        {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {(!s.activities || s.activities.length === 0) && (
                <div style={{ textAlign:'center', color:'var(--mid)', padding:20, fontSize:13 }}>No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Workers */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🏆 Top Performers This Month</div>
          <button className="btn btn-outline btn-sm">View All Workers →</button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Category</th>
                <th>Jobs Done</th>
                <th>Rating</th>
                <th>Earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(s.topWorkers && s.topWorkers.length > 0 ? s.topWorkers : []).map((w, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        className="avatar avatar-sm"
                        style={{ background: `hsl(${i * 47 + 200}, 70%, 50%)` }}
                      >
                        {w.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontWeight: 600 }}>{w.name}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-primary">{w.cat || w.category}</span></td>
                  <td style={{ fontWeight: 700 }}>{w.jobs || w.totalJobs || 0}</td>
                  <td>
                    <span style={{ color: '#FBBF24', marginRight: 4 }}>★</span>
                    <span style={{ fontWeight: 700 }}>{w.rating || '—'}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{w.earned || `₹${(w.totalEarned || 0).toLocaleString('en-IN')}`}</td>
                  <td>
                    <span className={`badge ${w.status === 'online' ? 'badge-success' : 'badge-gray'}`}>
                      {w.status === 'online' ? '● Online' : '○ Offline'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
