import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, FormRow } from '../../components/FormInput'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { Search, RefreshCw, Eye, Ban, Users, Copy } from 'lucide-react'

const PAGE_SIZE = 15
const STATUS_VARIANT = {
  BROADCASTING: 'info', QUOTES_RECEIVED: 'warning', ALLOCATED: 'primary',
  ARRIVING: 'purple', IN_PROGRESS: 'warning', COMPLETED: 'success',
  PAID: 'success', CLOSED: 'gray', CANCELLED: 'danger'
}
const STATUS_LABEL = {
  BROADCASTING: 'Broadcasting', QUOTES_RECEIVED: 'Quotes Received', ALLOCATED: 'Allocated',
  ARRIVING: 'Arriving', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed',
  PAID: 'Paid', CLOSED: 'Closed', CANCELLED: 'Cancelled'
}

export default function Jobs() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailQuotes, setDetailQuotes] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [reassignModal, setReassignModal] = useState(null)
  const [selectedWorker, setSelectedWorker] = useState('')
  const [impersonateToken, setImpersonateToken] = useState(null)

  useEffect(() => { fetchJobs(); fetchWorkers() }, [])

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/jobs/all')
      if (res.data.status === 'success') setJobs(res.data.data.jobs || [])
    } catch { showToast('Failed to load jobs', 'error') }
    finally { setLoading(false) }
  }

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/admin/workers')
      if (res.data.status === 'success') setWorkers(res.data.data.workers || [])
    } catch { /* silent */ }
  }

  const fetchJobDetail = async (job) => {
    setLoadingDetail(true)
    setDetail(job)
    setImpersonateToken(null)
    try {
      const res = await api.get(`/admin/jobs/${job._id}`)
      if (res.data.status === 'success') {
        setDetailQuotes(res.data.data.quotes || [])
      }
    } catch { /* use existing data */ }
    finally { setLoadingDetail(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const cancelJob = async (id) => {
    try {
      await api.patch(`/admin/jobs/${id}/cancel`)
      setJobs(prev => prev.map(j => j._id === id ? { ...j, status: 'CANCELLED' } : j))
      showToast('Job cancelled')
      if (detail?._id === id) setDetail(prev => ({ ...prev, status: 'CANCELLED' }))
    } catch { showToast('Failed to cancel job', 'error') }
    setConfirm(null)
  }

  const reassignWorker = async () => {
    if (!selectedWorker || !reassignModal) return
    try {
      await api.patch(`/admin/jobs/${reassignModal._id}/reassign`, { workerId: selectedWorker })
      fetchJobs()
      showToast('Worker reassigned successfully')
    } catch { showToast('Failed to reassign', 'error') }
    setReassignModal(null)
    setSelectedWorker('')
  }

  const handleImpersonate = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/impersonate`)
      if (res.data.status === 'success') { setImpersonateToken(res.data.data.token); showToast('Token generated') }
    } catch { showToast('Failed to generate token', 'error') }
  }

  const copyToken = (t) => { navigator.clipboard.writeText(t); showToast('Copied') }

  const filtered = jobs.filter(j => {
    const name = j.customerId?.name || j.customer || ''
    const worker = j.workerId?.name || j.worker || ''
    const id = j._id?.toString().slice(-6) || ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      worker.toLowerCase().includes(search.toLowerCase()) ||
      id.includes(search.toLowerCase()) ||
      (j.category || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })





  const columns = [
    { header: 'Job ID', render: (j) => {
        const fj = formatJob(j);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{fj.id}</span>
            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(j._id); showToast('Copied') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', padding: 2 }}><Copy size={12} /></button>
          </div>
        );
    }},
    { header: 'Customer', render: (j) => <div className="cell-primary" style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>{formatJob(j).customer}</div> },
    { header: 'Worker', render: (j) => {
        const fj = formatJob(j);
        return <div className={fj.worker === '—' ? 'cell-muted' : 'cell-primary'} style={{ cursor: fj.worker !== '—' ? 'pointer' : 'default' }} onClick={() => fj.worker !== '—' && navigate('/workers')}>{fj.worker}</div>;
    }},
    { header: 'Category', render: (j) => <Badge label={formatJob(j).category} variant="info" /> },
    { header: 'Amount', render: (j) => <strong>{formatJob(j).amount}</strong> },
    { header: 'Fee', render: (j) => <strong style={{ color: 'var(--success)' }}>{formatJob(j).fee}</strong> },
    { header: 'Status', render: (j) => {
        const fj = formatJob(j);
        return <Badge label={STATUS_LABEL[fj.status] || fj.status} variant={STATUS_VARIANT[fj.status] ? STATUS_VARIANT[fj.status].toLowerCase() : 'neutral'} />;
    }},
    { header: 'Date', render: (j) => <div style={{ fontSize: 12, color: 'var(--mid)' }}>{formatJob(j).date}</div> },
    { header: 'Actions', render: (j) => {
        const fj = formatJob(j);
        return (
          <div className="action-btns" onClick={(e) => e.stopPropagation()}>
            <button className="btn-icon" title="View Details" onClick={() => fetchJobDetail(j)}><Eye size={15} /></button>
            {j.workerId && ['ALLOCATED', 'IN_PROGRESS', 'ARRIVING'].includes(j.status) && (
                <button className="btn-icon" title="Reassign Worker" onClick={() => { setReassignModal(fj); setSelectedWorker(''); }}><Users size={15} /></button>
            )}
            {['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS'].includes(j.status) && (
              <button className="btn-icon danger" title="Cancel Job" onClick={() => setConfirm({ type: 'cancel', id: j._id, name: `Job #${j._id.slice(-6)}` })}><Ban size={15} /></button>
            )}
          </div>
        );
    }}
  ];

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const stats = {
    total: jobs.length,
    active: jobs.filter(j => ['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'IN_PROGRESS'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'COMPLETED' || j.status === 'PAID').length,
    cancelled: jobs.filter(j => j.status === 'CANCELLED').length,
  }

  const formatJob = (j) => ({
    id: j._id?.toString().slice(-6) || '—',
    _id: j._id,
    customer: j.customerId?.name || j.customer || 'Unknown',
    customerId: j.customerId?._id || j.customerId,
    worker: j.workerId?.name || j.worker || '—',
    workerId: j.workerId?._id || j.workerId,
    category: j.category,
    city: j.addressDetails || j.locationName || '—',
    date: new Date(j.createdAt).toLocaleDateString('en-IN'),
    amount: `₹${j.payment?.amount || 0}`,
    fee: `₹${j.payment?.platformFee || 0}`,
    status: j.status,
    priority: j.priority || 'normal',
    description: j.description || '',
  })

  const formatDetail = (j) => {
    const d = formatJob(j)
    d.amount = `₹${j.payment?.amount || 0}`
    d.fee = `₹${j.payment?.platformFee || 0}`
    d.workerPayout = `₹${j.payment?.workerPayout || 0}`
    d.paymentStatus = j.payment?.status || 'PENDING'
    d.timeSlot = j.timeSlot || '—'
    d.preferredDate = j.preferredDate ? new Date(j.preferredDate).toLocaleDateString('en-IN') : '—'
    return d
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Job Management</div>
          <div className="page-subtitle">Manage all service jobs — reassign workers, cancel, and oversee on behalf of users</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchJobs}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Jobs', value: stats.total, color: '#2EF7F0' },
          { label: 'Active', value: stats.active, color: '#F59E0B' },
          { label: 'Completed', value: stats.completed, color: '#10B981' },
          { label: 'Cancelled', value: stats.cancelled, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search job ID, customer, worker, category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {['all', 'BROADCASTING', 'ALLOCATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(f => (
            <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : STATUS_LABEL[f] || f}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading jobs...</div>
        ) : paged.length === 0 ? (
          <EmptyState icon="📋" title="No jobs found" description={search ? 'Try a different search' : 'No jobs created yet'} />
        ) : (
          <>
            <Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No jobs found"} />
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {detail && (() => {
        const fd = formatDetail(detail)
        return (
          <>
            <div className="drawer-overlay" onClick={() => { setDetail(null); setImpersonateToken(null); }} />
            <div className="drawer" style={{ width: 520 }}>
              <div className="drawer-header">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Job Details</div>
                  <div className="cell-muted">{fd.id}</div>
                </div>
                <button className="modal-close" onClick={() => { setDetail(null); setImpersonateToken(null); }}>✕</button>
              </div>
              <div className="drawer-body">
                {/* Status Banner */}
                <div style={{ background: 'var(--bg-dark)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                  <span className={`badge badge-${STATUS_VARIANT[fd.status] || 'gray'}`} style={{ fontSize: 13, padding: '6px 16px' }}>
                    {STATUS_LABEL[fd.status] || fd.status}
                  </span>
                </div>

                {/* Details */}
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</div>
                <div className="detail-grid">
                  <div className="detail-row"><span>Customer</span><strong style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => { setDetail(null); navigate('/users') }}>{fd.customer}</strong></div>
                  <div className="detail-row"><span>Worker</span><strong style={{ cursor: fd.worker !== '—' ? 'pointer' : 'default', color: fd.worker !== '—' ? 'var(--primary)' : 'var(--mid)' }} onClick={() => fd.worker !== '—' && navigate('/workers')}>{fd.worker}</strong></div>
                  <div className="detail-row"><span>Category</span><strong>{fd.category}</strong></div>
                  <div className="detail-row"><span>Location</span><strong>{fd.city}</strong></div>
                  <div className="detail-row"><span>Date</span><strong>{fd.date}</strong></div>
                  <div className="detail-row"><span>Preferred Date</span><strong>{fd.preferredDate}</strong></div>
                  <div className="detail-row"><span>Time Slot</span><strong>{fd.timeSlot}</strong></div>
                  <div className="detail-row"><span>Amount</span><strong>{fd.amount}</strong></div>
                  <div className="detail-row"><span>Platform Fee</span><strong style={{ color: 'var(--success)' }}>{fd.fee}</strong></div>
                  <div className="detail-row"><span>Worker Payout</span><strong>{fd.workerPayout}</strong></div>
                  <div className="detail-row"><span>Payment Status</span><strong>{fd.paymentStatus}</strong></div>
                </div>

                {fd.description && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>Description</div>
                    <div style={{ background: 'var(--bg-dark)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--dark)', lineHeight: 1.6 }}>{fd.description}</div>
                  </>
                )}

                {/* Quotes */}
                {detailQuotes.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Worker Quotes ({detailQuotes.length})</div>
                    {detailQuotes.map((q, i) => (
                      <div key={i} style={{ background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)', padding: 14, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{q.workerId?.name || 'Worker'}</div>
                            <div style={{ fontSize: 11, color: 'var(--mid)' }}>₹{q.amount} · {q.message || 'No message'}</div>
                          </div>
                          <span className={`badge badge-${q.status === 'ACCEPTED' ? 'success' : q.status === 'REJECTED' ? 'danger' : 'warning'}`}>{q.status}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Actions */}
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Admin Actions</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {fd.worker !== '—' && ['ALLOCATED', 'IN_PROGRESS'].includes(fd.status) && (
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setReassignModal(fd); setSelectedWorker(''); setDetail(null) }}>
                      <Users size={14} /> Reassign
                    </button>
                  )}
                  {['BROADCASTING', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS'].includes(fd.status) && (
                    <button className="btn-danger" style={{ flex: 1 }} onClick={() => { setConfirm({ type: 'cancel', id: fd._id, name: `Job #${fd.id}` }); setDetail(null) }}>
                      <Ban size={14} /> Cancel Job
                    </button>
                  )}
                </div>

                {/* Impersonate customer */}
                {fd.customerId && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Impersonate Customer</div>
                    {impersonateToken ? (
                      <div style={{ background: 'var(--bg-dark)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 6, fontWeight: 600 }}>Token (1h):</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', userSelect: 'all', background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 8 }}>{impersonateToken}</div>
                        <button className="btn-secondary" style={{ width: '100%', height: 32, fontSize: 12 }} onClick={() => copyToken(impersonateToken)}><Copy size={12} /> Copy Token</button>
                      </div>
                    ) : (
                      <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleImpersonate(fd.customerId)}>Generate Customer Token</button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Reassign Modal */}
      <Modal open={!!reassignModal} onClose={() => { setReassignModal(null); setSelectedWorker(''); }} title="Reassign Worker" width="480px">
        {reassignModal && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
              Reassign job <strong>#{reassignModal.id}</strong> from <strong>{reassignModal.worker}</strong> to a new worker.
            </p>
            <div className="form-group">
              <label className="form-label">Select Worker</label>
              <select className="form-control" value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)}>
                <option value="">Choose worker...</option>
                {workers.filter(w => w.isVerified && w._id !== reassignModal.workerId).map(w => (
                  <option key={w._id} value={w._id}>{w.name} ({w.city || 'Unknown'} · ₹{w.wallet?.balance || 0})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setReassignModal(null); setSelectedWorker(''); }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} disabled={!selectedWorker} onClick={reassignWorker}>Reassign</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Modal */}
      {confirm?.type === 'cancel' && (
        <ConfirmModal
          title="Cancel Job"
          message={`Cancel ${confirm.name}? This action is done on behalf of the user and cannot be undone.`}
          confirmText="Cancel Job"
          onConfirm={() => cancelJob(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
