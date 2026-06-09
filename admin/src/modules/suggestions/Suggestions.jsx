import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, MessageSquare, User, RefreshCw } from 'lucide-react'
import Badge from '../../components/Badge'
import api from '../../services/api'

const STATUS_VARIANT = { PENDING:'warning', APPROVED:'success', REJECTED:'danger' }

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [filter, setFilter]           = useState('all')
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState('')

  useEffect(() => { fetchSuggestions() }, [])

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const res = await api.get('/categories/suggestions')
      if (res.data.status === 'success') {
        setSuggestions(res.data.data?.suggestions || res.data.data || [])
      }
    } catch (e) {
      console.error('Suggestions fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, ok = false) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = suggestions.filter(s => filter === 'all' || s.status === filter.toUpperCase())

  const updateStatus = async (id, status) => {
    try {
      const res = await api.patch(`/categories/suggestions/${id}`, { status: status.toUpperCase() })
      if (res.data.status === 'success') {
        setSuggestions(prev => prev.map(s => s._id === id ? res.data.data : s))
        showToast(`Suggestion ${status.toLowerCase()}`, true)
      }
    } catch {
      showToast('Failed to update suggestion')
    }
  }

  const stats = {
    pending:  suggestions.filter(s => s.status === 'PENDING').length,
    approved: suggestions.filter(s => s.status === 'APPROVED').length,
    rejected: suggestions.filter(s => s.status === 'REJECTED').length,
  }

  return (
    <div className="page">
      {toast && (
        <div style={{ position:'fixed',bottom:24,right:24,zIndex:999,background: toast.ok ? '#064e3b' : '#7f1d1d',color:'white',padding:'12px 20px',borderRadius:12,fontWeight:600,fontSize:14,animation:'slideUp 0.3s ease',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">💡 Category Suggestions</h1>
          <p className="page-subtitle">Workers suggesting new service categories for admin approval</p>
        </div>
        <button className="btn-secondary" onClick={fetchSuggestions} style={{ display:'flex',alignItems:'center',gap:8 }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:24 }}>
        {[
          { label:'Pending Review', value:stats.pending,  color:'#d97706' },
          { label:'Approved',       value:stats.approved, color:'#059669' },
          { label:'Rejected',       value:stats.rejected, color:'#dc2626' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:13, color:'var(--mid)', marginTop:4, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs" style={{ marginBottom:20 }}>
        {['all','pending','approved','rejected'].map(f => (
          <button key={f} className={`filter-tab ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
            {f==='pending' && stats.pending > 0 && <span className="tab-badge">{stats.pending}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:48, textAlign:'center', color:'var(--mid)' }}>Loading suggestions...</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map(s => (
            <div key={s._id} className="suggestion-card">
              <div className="suggestion-header">
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <User size={14} color="var(--mid)" />
                    <strong>{s.suggestedBy?.name || 'Unknown'}</strong>
                    <span className="cell-muted">{s.suggestedBy?.phone || '—'}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="cell-muted">Type:</span>
                    <Badge label={s.type} variant="info" />
                    <span style={{ fontWeight:700, fontSize:14 }}>{s.parentCategory?.name ? `Under ${s.parentCategory.name} → ` : ''}{s.name}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Badge label={s.status} variant={STATUS_VARIANT[s.status] || 'neutral'} />
                  <span className="cell-muted" style={{ fontSize:12 }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="suggestion-reason">
                <MessageSquare size={13} color="var(--mid)" style={{ flexShrink:0 }} />
                <span>{s.adminFeedback || 'No admin feedback.'}</span>
              </div>

              {s.status === 'PENDING' && (
                <div className="suggestion-actions">
                  <button className="btn-success-sm" onClick={() => updateStatus(s._id, 'APPROVED')}>
                    <CheckCircle size={14} /> Approve & Add
                  </button>
                  <button className="btn-danger-sm" onClick={() => updateStatus(s._id, 'REJECTED')}>
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="table-empty">No suggestions found</div>
          )}
        </div>
      )}
    </div>
  )
}
