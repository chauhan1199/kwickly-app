import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, MessageSquare, User, RefreshCw } from 'lucide-react'
import Badge from '../../components/Badge'
import Toast from '../../components/Toast'
import api from '../../services/api'

const STATUS_VARIANT = { PENDING:'warning', APPROVED:'success', REJECTED:'danger' }

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [filter, setFilter]           = useState('all')
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState(null)
  const [processing, setProcessing]   = useState(null)

  useEffect(() => { fetchSuggestions() }, [])

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/suggestions')
      if (res.data.status === 'success') {
        setSuggestions(res.data.data?.suggestions || res.data.data || [])
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to load suggestions'
      setToast({ message: msg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const filtered = suggestions.filter(s => filter === 'all' || s.status === filter)

  const updateStatus = async (id, status) => {
    const reason = status === 'APPROVED'
      ? 'Admin approved this suggestion'
      : 'Admin rejected this suggestion'
    setProcessing(id)
    try {
      const endpoint = status === 'APPROVED'
        ? `/admin/suggestions/${id}/approve`
        : `/admin/suggestions/${id}/reject`
      const res = await api.patch(endpoint, { reason })
      if (res.data.status === 'success') {
        setSuggestions(prev => prev.map(s => s._id === id ? res.data.data : s))
        setToast({ message: `Suggestion ${status.toLowerCase()} successfully`, type: 'success' })
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to update suggestion'
      setToast({ message: msg, type: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  const stats = {
    pending:  suggestions.filter(s => s.status === 'pending').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    rejected: suggestions.filter(s => s.status === 'rejected').length,
  }

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">💡 Category Suggestions</h1>
          <p className="page-subtitle">Workers suggesting new service categories for admin approval</p>
        </div>
        <button className="btn-secondary" onClick={fetchSuggestions} style={{ display:'flex',alignItems:'center',gap:8 }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

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
                    <strong>{s.workerId?.name || s.workerName || 'Unknown'}</strong>
                    <span className="cell-muted">{s.workerId?.city || s.workerCity || '—'}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="cell-muted">Type:</span>
                    <Badge label={s.type === 'new_category' ? 'New Category' : 'New Subcategory'} variant="info" />
                    <span style={{ fontWeight:700, fontSize:14 }}>{s.payload?.parentCategory ? `Under ${s.payload.parentCategory} → ` : ''}{s.payload?.name || s.name}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Badge label={s.status} variant={STATUS_VARIANT[s.status?.toUpperCase()] || 'neutral'} />
                  <span className="cell-muted" style={{ fontSize:12 }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="suggestion-reason">
                <MessageSquare size={13} color="var(--mid)" style={{ flexShrink:0 }} />
                <span>{s.approveReason || s.rejectReason || 'No admin feedback yet.'}</span>
              </div>

              {s.status === 'pending' && (
                <div className="suggestion-actions">
                  <button
                    className="btn-success-sm"
                    onClick={() => updateStatus(s._id, 'APPROVED')}
                    disabled={processing === s._id}
                  >
                    <CheckCircle size={14} /> {processing === s._id ? 'Approving...' : 'Approve & Add'}
                  </button>
                  <button
                    className="btn-danger-sm"
                    onClick={() => updateStatus(s._id, 'REJECTED')}
                    disabled={processing === s._id}
                  >
                    <XCircle size={14} /> {processing === s._id ? 'Rejecting...' : 'Reject'}
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
