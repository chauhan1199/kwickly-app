import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../../config'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError } from '../../utils/errorUtils'
import EmptyState from '../../components/EmptyState'
import Toast from '../../components/Toast'

const RANGE_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', quarter: 'Quarter', year: 'Year', all: 'All Time' }

export default function Dashboard() {
  const api = useAbortableRequest();
  const navigate = useNavigate()
  const [chartMode, setChartMode] = useState('jobs')
  const [range, setRange] = useState('week')
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalWorkers: 0,
    totalShops: 0,
    activeJobs: 0,
    totalRevenue: 0,
    activities: [],
    topWorkers: []
  })
  const [loading, setLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [toast, setToast] = useState(null)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [activitySearch, setActivitySearch] = useState('')

  useEffect(() => {
    fetchStats()
    let socket
    try {
      const token = localStorage.getItem('kwickly_admin_token')
      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
      })
      socket.on('DASHBOARD_UPDATE', () => fetchStats())
    } catch {}
    return () => { if (socket) socket.disconnect() }
  }, [range])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setFetchFailed(false)
      const res = await api.get(`/admin/stats?range=${range}`)
      if (res.data.status === 'success') setStats(res.data.data)
      else setFetchFailed(true)
    } catch (err) {
      // Ignore aborted requests (caused by range change or component unmount)
      if (isAbortError(err)) return
      setFetchFailed(true)
      setToast({ msg: 'Failed to load dashboard data', type: 'error' })
    } finally { setLoading(false) }
  }

  const s = stats || { totalCustomers: 0, totalWorkers: 0, totalShops: 0, activeJobs: 0, totalRevenue: 0, activities: [], topWorkers: [], chartData: [] }
  const filteredActivities = useMemo(() => (s.activities || []).filter(a => !activitySearch || a.text?.toLowerCase().includes(activitySearch.toLowerCase())), [s.activities, activitySearch])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading dashboard...</div>

  if (fetchFailed) return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <EmptyState
        icon="⚠️"
        title="Couldn't load dashboard data"
        description="The server didn't respond. Check your connection and try again."
        action={<button className="btn btn-primary" onClick={() => fetchStats()}>↻ Retry</button>}
      />
    </div>
  )

  const chartData = s.chartData || []
  const maxJobs = chartData.length > 0 ? Math.max(...chartData.map(d => d.jobs)) : 100
  const maxRev = chartData.length > 0 ? Math.max(...chartData.map(d => d.revenue)) : 10000

  const kpis = [
    { label: 'Active Jobs', value: s.activeJobs, icon: '📋', color: '#2EF7F0', route: '/jobs' },
    { label: 'Revenue', value: `₹${(s.totalRevenue || 0).toLocaleString('en-IN')}`, icon: '💰', color: '#10B981', route: '/payouts' },
    { label: 'Workers', value: s.totalWorkers, icon: '🔧', color: '#F59E0B', route: '/workers' },
    { label: 'Customers', value: s.totalCustomers, icon: '👤', color: '#8B5CF6', route: '/users' },
    { label: 'Shops', value: s.totalShops, icon: '🏪', color: '#EF4444', route: '/shops' },
  ]

  const activityColor = (c) => c === 'blue' ? '#2EF7F0' : c === 'green' ? '#10B981' : c === 'orange' ? '#F59E0B' : c === 'purple' ? '#8B5CF6' : '#EF4444'

  const parseJobId = (text) => {
    const m = text.match(/#([a-f0-9]+)/i)
    return m ? m[1] : null
  }

  const handleActivityClick = (a) => {
    const jobId = parseJobId(a.text)
    if (jobId) navigate('/jobs')
    else if (a.text?.toLowerCase().includes('order')) navigate('/orders')
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="kpi-card"
            style={{ borderTop: `3px solid ${k.color}`, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onClick={() => navigate(k.route)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{k.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--dark)', letterSpacing: '-1px', lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 500, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">⚡ Recent Activity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(s.activities || []).length > 5 && (
              <button className="btn btn-outline btn-sm" onClick={() => setShowAllActivity(true)}>View All →</button>
            )}
          </div>
        </div>
        <div className="card-body" style={{ padding: '0 20px 8px' }}>
          {(s.activities || []).length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mid)', padding: '24px 0', fontSize: 13 }}>No recent activity</div>
          ) : (
            (s.activities || []).slice(0, 5).map((a, i, arr) => (
              <div
                key={i}
                onClick={() => handleActivityClick(a)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: activityColor(a.color), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{a.text}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(a.time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid-2 dash-grid-2" style={{ gap: 16, marginBottom: 16 }}>
        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📈 Performance · {RANGE_LABELS[range]}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.keys(RANGE_LABELS).map(r => (
                <button key={r} className={`btn btn-sm ${range === r ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setRange(r)}>
                  {RANGE_LABELS[r]}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
              <button className={`btn btn-sm ${chartMode === 'jobs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setChartMode('jobs')}>Jobs</button>
              <button className={`btn btn-sm ${chartMode === 'revenue' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setChartMode('revenue')}>Revenue</button>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              {chartData.map((d, i) => {
                const val = chartMode === 'jobs' ? d.jobs : d.revenue
                const max = chartMode === 'jobs' ? maxJobs : maxRev
                const pct = max > 0 ? (val / max) * 100 : 0
                return (
                  <div key={i} className="chart-bar" style={{ height: `${pct}%` }}
                    title={chartMode === 'jobs' ? `${d.jobs} jobs` : `₹${d.revenue.toLocaleString('en-IN')}`} />
                )
              })}
            </div>
            <div className="chart-labels">
              {chartData.map((d, i) => <div key={i} className="chart-label">{d.day}</div>)}
            </div>
          </div>
        </div>

        {/* Top Workers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏆 Top Performers</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/workers')}>View All →</button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Worker</th><th>Category</th><th>Jobs</th><th>Rating</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(s.topWorkers || []).length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mid)', fontSize: 13 }}>No top performers yet</td></tr>
                ) : (s.topWorkers || []).map((w, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate('/workers')}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm" style={{ background: `hsl(${i * 47 + 200}, 70%, 50%)` }}>
                          {w.name?.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span style={{ fontWeight: 600 }}>{w.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{w.cat || w.category}</span></td>
                    <td style={{ fontWeight: 700 }}>{w.jobs || w.totalJobs || 0}</td>
                    <td><span style={{ color: '#FBBF24', marginRight: 4 }}>★</span><span style={{ fontWeight: 700 }}>{w.rating || '—'}</span></td>
                    <td><span className={`badge ${w.status === 'online' ? 'badge-success' : 'badge-gray'}`}>{w.status === 'online' ? 'Online' : 'Offline'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* All Activity Modal */}
      {showAllActivity && (
        <div className="modal-overlay" onClick={() => { setShowAllActivity(false); setActivitySearch(''); }}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">All Activity</h3>
              <button className="modal-close" onClick={() => { setShowAllActivity(false); setActivitySearch(''); }}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '0 24px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <div className="search-box">
                  <span>🔍</span>
                  <input placeholder="Search activities..." value={activitySearch} onChange={e => setActivitySearch(e.target.value)} autoFocus />
                </div>
              </div>
              {filteredActivities.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mid)', padding: '32px 0', fontSize: 13 }}>{activitySearch ? 'No matching activities' : 'No activity yet'}</div>
              ) : (
                filteredActivities.map((a, i, arr) => (
                  <div key={i} onClick={() => { setShowAllActivity(false); setActivitySearch(''); handleActivityClick(a); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: activityColor(a.color), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{a.text}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(a.time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
