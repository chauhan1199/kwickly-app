import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import Toast from '../../components/Toast'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { AlertTriangle, Search, RefreshCw, Eye, MessageSquare, CheckCircle, Package, Wrench, XCircle, ChevronRight, User, Hash, FileText } from 'lucide-react'

const PAGE_SIZE = 15

export default function Disputes() {
  const api = useAbortableRequest();
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  
  const [detail, setDetail] = useState(null)
  const [resolution, setResolution] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchDisputes() }, [])

  useEffect(() => { setPage(1) }, [search, filter])

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/disputes')
      if (res.data.status === 'success') {
        setDisputes(res.data.data?.disputes || res.data.data || [])
      }
    } catch { showToast('Failed to load disputes', 'error') }
    finally { setLoading(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = disputes.filter(d => {
    const custName = (d.customerId?.name || d.customer?.name || '').toLowerCase()
    const workName = (d.workerId?.name || d.worker?.name || '').toLowerCase()
    const reasonText = (d.reason || d.description || '').toLowerCase()
    const orderId = (d.shopOrderId?.orderNumber || '').toLowerCase()
    
    const matchSearch = custName.includes(search.toLowerCase()) || 
                        workName.includes(search.toLowerCase()) || 
                        reasonText.includes(search.toLowerCase()) ||
                        orderId.includes(search.toLowerCase())
                        
    const matchStatus = filter === 'all' || d.status.toLowerCase() === filter.toLowerCase()
    
    return matchSearch && matchStatus
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleResolve = async (status) => {
    setSaving(true)
    try {
      await api.patch(`/admin/disputes/${detail._id}/status`, { status: status.toLowerCase(), resolution, refundAmount })
      showToast(`Dispute marked as ${status.toLowerCase()}`)
      window.dispatchEvent(new Event('admin-action'))
      fetchDisputes()
      setDetail(null)
    } catch (err) { showToast(err.response?.data?.message || 'Error updating dispute', 'error') }
    finally { setSaving(false) }
  }

  const columns = [
    { header: 'Reference', render: (d) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: d.jobId ? 'var(--info-light)' : 'var(--primary-light)', color: d.jobId ? 'var(--info)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {d.jobId ? <Wrench size={16} /> : <Package size={16} />}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{d.jobId ? 'Service Job' : 'Product Order'}</div>
          <div className="cell-muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {d.shopOrderId?.orderNumber || d.jobId?._id?.slice(-8) || d._id.slice(-8)}
          </div>
        </div>
      </div>
    )},
    { header: 'Customer', render: (d) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.customerId?.name || d.customer?.name || '—'}</div>
        <div className="cell-muted" style={{ fontSize: 11 }}>{d.customerId?.phone || d.customer?.phone || '—'}</div>
      </div>
    )},
    { header: 'Provider (Worker/Shop)', render: (d) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.workerId?.name || d.worker?.name || '—'}</div>
        <div className="cell-muted" style={{ fontSize: 11 }}>{d.workerId?.phone || d.worker?.phone || '—'}</div>
      </div>
    )},
    { header: 'Amount', render: (d) => {
      const amt = d.amount || d.jobId?.payment?.amount || d.shopOrderId?.total || 0;
      return <div style={{ fontWeight: 800 }}>₹{amt}</div>
    }},
    { header: 'Issue', render: (d) => (
      <div style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, color: 'var(--mid)' }}>
        <AlertTriangle size={12} color="#F59E0B" style={{ marginRight: 4, verticalAlign: 'middle' }} />
        {d.reason || d.issue || d.description || 'No details provided.'}
      </div>
    )},
    { header: 'Status', render: (d) => {
      const variant = d.status === 'resolved' || d.status === 'refunded' ? 'success' : d.status === 'open' ? 'danger' : d.status === 'in_review' ? 'warning' : 'neutral';
      return <Badge label={d.status.replace('_', ' ')} variant={variant} />
    }},
    { header: 'Actions', render: (d) => (
      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="View & Resolve" onClick={() => { setDetail(d); setResolution(d.resolutionNotes || d.resolution || '') }}><Eye size={15} /></button>
      </div>
    )}
  ];

  const stats = {
    open: disputes.filter(d => d.status === 'open').length,
    review: disputes.filter(d => d.status === 'in_review').length,
    resolved: disputes.filter(d => ['resolved', 'refunded'].includes(d.status)).length,
    total: disputes.length
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Dispute Resolution</div>
          <div className="page-subtitle">Handle customer-worker conflicts and issue refunds</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchDisputes} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #EF4444` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#EF4444' }}>{stats.open}</div>
          <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Action Required</div>
        </div>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #F59E0B` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B' }}>{stats.review}</div>
          <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>In Review</div>
        </div>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #10B981` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#10B981' }}>{stats.resolved}</div>
          <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Resolved / Refunded</div>
        </div>
        <div className="stat-card-simple" style={{ borderTop: `3px solid var(--primary)` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)' }}>{stats.total}</div>
          <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Total Disputes</div>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box"><Search size={16} /><input placeholder="Search issue, customer, or order..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div style={{ display: 'flex', background: 'var(--input-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
          {['all', 'open', 'in_review', 'resolved', 'dismissed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', background: filter === f ? 'var(--bg)' : 'transparent', border: 'none', borderRadius: 6,
              color: filter === f ? 'var(--text-primary)' : 'var(--mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize'
            }}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading disputes...</div>
        ) : paged.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={48} color="var(--mid)" opacity={0.5} />} title="No disputes found" description={search ? 'Try a different search term' : 'Good job! There are no disputes to show.'} />
        ) : (
          <>
            <Table columns={columns} data={paged} onRowClick={(d) => { setDetail(d); setResolution(d.resolutionNotes || d.resolution || ''); setRefundAmount(d.amount || d.jobId?.payment?.amount || d.shopOrderId?.total || 0) }} emptyMessage="No disputes found" />
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />}
          </>
        )}
      </div>

      {detail && (
        <Modal open={!!detail} onClose={() => !saving && setDetail(null)} title="Dispute Details" width="600px">
          <div style={{ padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {detail.jobId ? <Wrench size={18} color="var(--info)" /> : <Package size={18} color="var(--primary)" />}
                  {detail.jobId ? 'Service Job Dispute' : 'Product Order Dispute'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--mid)', fontFamily: 'monospace' }}>
                  Ref: {detail.shopOrderId?.orderNumber || detail.jobId?._id?.slice(-8) || detail._id.slice(-8)}
                </div>
              </div>
              <Badge label={detail.status.replace('_', ' ')} variant={detail.status === 'resolved' || detail.status === 'refunded' ? 'success' : detail.status === 'open' ? 'danger' : detail.status === 'in_review' ? 'warning' : 'neutral'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> CUSTOMER</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.customerId?.name || detail.customer?.name || '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--mid)', marginTop: 2 }}>{detail.customerId?.phone || detail.customer?.phone || '—'}</div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> PROVIDER</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.workerId?.name || detail.worker?.name || '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--mid)', marginTop: 2 }}>{detail.workerId?.phone || detail.worker?.phone || '—'}</div>
              </div>
            </div>

            <div style={{ background: 'var(--danger-light)', border: '1px solid #EF444444', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} /> The Complaint
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {detail.reason || detail.issue || detail.description || 'No complaint text provided by the customer.'}
              </div>
            </div>

            <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> Administrator Resolution Notes
              </label>
              <textarea 
                className="form-control" 
                rows={4} 
                placeholder="Document your findings, actions taken, or reasons for dismissal/refund..." 
                value={resolution} 
                onChange={e => setResolution(e.target.value)}
                disabled={['resolved', 'refunded', 'dismissed'].includes(detail.status) && detail.resolutionNotes}
                style={{ width: '100%', resize: 'none', marginBottom: 12 }}
              />

              <label className="form-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                 Refund Amount (₹) - Only applies if "Issue Refund" is clicked
              </label>
              <input 
                type="number"
                className="form-control"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                disabled={['resolved', 'refunded', 'dismissed'].includes(detail.status)}
                style={{ width: '100%' }}
              />
            </div>

            {['open', 'in_review'].includes(detail.status) && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn-primary" style={{ flex: 1, background: '#10B981', borderColor: '#10B981', padding: '10px' }} onClick={() => handleResolve('RESOLVED')} disabled={saving || !resolution.trim()}>
                  {saving ? <span className="spinner-sm" /> : <CheckCircle size={16} />} Mark Resolved
                </button>
                <button className="btn-primary" style={{ flex: 1, background: '#3B82F6', borderColor: '#3B82F6', padding: '10px' }} onClick={() => handleResolve('REFUNDED')} disabled={saving || !resolution.trim()}>
                  Issue Refund
                </button>
                {detail.status === 'open' && (
                  <button className="btn-secondary" style={{ flex: 1, color: '#F59E0B', borderColor: '#F59E0B', padding: '10px' }} onClick={() => handleResolve('IN_REVIEW')} disabled={saving}>
                    Escalate to Review
                  </button>
                )}
                <button className="btn-secondary" style={{ flex: 1, color: '#EF4444', borderColor: '#EF4444', padding: '10px' }} onClick={() => handleResolve('DISMISSED')} disabled={saving || !resolution.trim()}>
                  Dismiss Dispute
                </button>
              </div>
            )}
            
            {['resolved', 'refunded', 'dismissed'].includes(detail.status) && (
               <div style={{ padding: 12, textAlign: 'center', background: 'var(--success-light)', color: '#059669', borderRadius: 8, fontWeight: 600 }}>
                 This dispute was marked as {detail.status.toUpperCase()}.
               </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
