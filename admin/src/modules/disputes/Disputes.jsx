import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, MessageSquare, RefreshCw } from 'lucide-react'
import Badge  from '../../components/Badge'
import Modal  from '../../components/Modal'
import api from '../../services/api'

const STATUS_VARIANT = { OPEN:'danger', RESOLVED:'success', DISMISSED:'neutral', IN_REVIEW:'warning', open:'danger', resolved:'success', dismissed:'neutral', in_review:'warning' }

export default function Disputes() {
  const [disputes, setDisputes]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [selected, setSelected]     = useState(null)
  const [modal, setModal]           = useState(false)
  const [resolution, setResolution] = useState('')
  const [toast, setToast]           = useState('')

  useEffect(() => { fetchDisputes() }, [])

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/disputes')
      if (res.data.status === 'success') {
        setDisputes(res.data.data?.disputes || res.data.data || [])
      }
    } catch (e) {
      console.error('Disputes fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, ok = false) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = disputes.filter(d => filter === 'all' || d.status.toLowerCase() === filter.toLowerCase())

  const stats = {
    open:     disputes.filter(d => d.status.toLowerCase() === 'open').length,
    resolved: disputes.filter(d => d.status.toLowerCase() === 'resolved').length,
    total:    disputes.length,
  }

  const openDispute = (d) => { setSelected(d); setResolution(d.resolution || ''); setModal(true) }

  const resolveDispute = async (status) => {
    try {
      const res = await api.patch(`/admin/disputes/${selected._id}/status`, { status: status.toLowerCase(), resolution })
      if (res.data.status === 'success') {
        setDisputes(prev => prev.map(d => d._id === selected._id ? res.data.data : d))
        showToast(`Dispute marked as ${status.toLowerCase()}`, true)
      }
    } catch {
      showToast('Failed to update dispute status')
    }
    setModal(false)
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
          <h1 className="page-title">⚖️ Dispute Resolution</h1>
          <p className="page-subtitle">Handle customer–worker disputes and issue resolutions</p>
        </div>
        <button className="btn-secondary" onClick={fetchDisputes} style={{ display:'flex',alignItems:'center',gap:8 }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:24 }}>
        {[
          { label:'Open Disputes',  value:stats.open,     color:'#dc2626' },
          { label:'Resolved',       value:stats.resolved, color:'#059669' },
          { label:'Total',          value:stats.total,    color:'#0e9aa7' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:13, color:'var(--mid)', marginTop:4, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs" style={{ marginBottom:20 }}>
        {['all','open','resolved','dismissed'].map(f => (
          <button key={f} className={`filter-tab ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
            {f==='open' && stats.open > 0 && <span className="tab-badge">{stats.open}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:48, textAlign:'center', color:'var(--mid)' }}>Loading disputes...</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map(d => (
            <div key={d._id} className="dispute-card" onClick={() => openDispute(d)}>
              <div className="dispute-top">
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <AlertTriangle size={16} color={d.status.toLowerCase()==='open'?'#dc2626':'#6b7280'} />
                    <strong style={{ fontSize:15 }}>{d.jobCategory || d.jobId?.category || 'Service'} Dispute</strong>
                    <Badge label={d.status.toUpperCase()} variant={STATUS_VARIANT[d.status]||'neutral'} />
                  </div>
                  <div style={{ display:'flex', gap:24, flexWrap: 'wrap' }}>
                    <div>
                      <div className="cell-muted" style={{ fontSize:11 }}>CUSTOMER</div>
                      <strong>{d.customer?.name || d.customerId?.name || '—'}</strong>
                      <div className="cell-muted">{d.customer?.phone || d.customerId?.phone || '—'}</div>
                    </div>
                    <div>
                      <div className="cell-muted" style={{ fontSize:11 }}>WORKER</div>
                      <strong>{d.worker?.name || d.workerId?.name || '—'}</strong>
                      <div className="cell-muted">{d.worker?.phone || d.workerId?.phone || '—'}</div>
                    </div>
                    <div>
                      <div className="cell-muted" style={{ fontSize:11 }}>AMOUNT</div>
                      <strong>₹{d.amount || d.jobId?.payment?.amount || 0}</strong>
                    </div>
                  </div>
                </div>
                <span className="cell-muted" style={{ fontSize:12 }}>
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="dispute-reason">
                <MessageSquare size={13} color="#92400e" style={{ flexShrink:0 }} />
                <span>{d.reason || d.description || 'No details provided.'}</span>
              </div>
              {d.resolution && (
                <div className="dispute-resolution">
                  <CheckCircle size={13} color="#166534" style={{ flexShrink:0 }} />
                  <span>{d.resolution}</span>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="table-empty">No disputes found</div>}
        </div>
      )}

      {/* Resolution Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Resolve Dispute" width="580px">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom:20 }}>
              <div className="detail-row"><span>Category</span><strong>{selected.jobCategory || selected.jobId?.category || 'Service'}</strong></div>
              <div className="detail-row"><span>Customer</span><strong>{selected.customer?.name || selected.customerId?.name || '—'}</strong></div>
              <div className="detail-row"><span>Worker</span><strong>{selected.worker?.name || selected.workerId?.name || '—'}</strong></div>
              <div className="detail-row"><span>Amount</span><strong>₹{selected.amount || selected.jobId?.payment?.amount || 0}</strong></div>
              <div className="detail-row"><span>Complaint</span><span style={{ color:'var(--dark)', maxWidth:300 }}>{selected.reason || selected.description}</span></div>
            </div>
            <label className="input-label">Resolution Notes *</label>
            <textarea
              className="textarea-field"
              rows={4}
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="Describe the resolution action taken (e.g. Refund processed, Worker warned)..."
            />
            <div style={{ display:'flex', gap:12, marginTop:20 }}>
              <button className="btn-primary" onClick={() => resolveDispute('RESOLVED')} disabled={!resolution.trim()}>
                Mark Resolved
              </button>
              <button className="btn-secondary" onClick={() => resolveDispute('DISMISSED')}>
                Dismiss
              </button>
              <button className="btn-danger" onClick={() => resolveDispute('IN_REVIEW')}>
                Escalate
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
