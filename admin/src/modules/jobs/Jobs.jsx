import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, FormRow } from '../../components/FormInput'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import useAdminRefresh from '../../hooks/useAdminRefresh'
import { DISPUTE_RESOLUTIONS } from '../../utils/jobDisputes'
import { Search, RefreshCw, Eye, Ban, Users, Copy, FileText, Download } from 'lucide-react'

const PAGE_SIZE = 15
const CREDIT_TXN_TYPES = ['JOB_CREDIT', 'REFUND', 'ORDER_CREDIT', 'REFERRAL_BONUS', 'TOPUP', 'TRANSFER_RECEIVED']
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN') : '—'
const STATUS_VARIANT = {
  BROADCASTING: 'info', QUOTES_RECEIVED: 'warning', ALLOCATED: 'primary',
  ARRIVING: 'purple', IN_PROGRESS: 'warning', COMPLETED: 'success',
  PAID: 'success', CLOSED: 'gray', CANCELLED: 'danger', DISPUTED: 'danger'
}
const STATUS_LABEL = {
  BROADCASTING: 'Broadcasting', QUOTES_RECEIVED: 'Quotes Received', ALLOCATED: 'Allocated',
  ARRIVING: 'Arriving', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed',
  PAID: 'Paid', CLOSED: 'Closed', CANCELLED: 'Cancelled', DISPUTED: 'Disputed'
}

export default function Jobs() {
  const api = useAbortableRequest();
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [reassigning, setReassigning] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailQuotes, setDetailQuotes] = useState([])
  const [detailTxns, setDetailTxns] = useState([])
  const [resolveModal, setResolveModal] = useState(null)
  const [resolution, setResolution] = useState('DEDUCT_FROM_WORKER')
  const [resolveNote, setResolveNote] = useState('')
  const [resolving, setResolving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [reassignModal, setReassignModal] = useState(null)
  const [selectedWorker, setSelectedWorker] = useState('')
  const [impersonateToken, setImpersonateToken] = useState(null)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, cancelled: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting] = useState(false)

  // Debounce the search box so the server query fires after typing stops
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    try {
      const res = await api.get('/admin/jobs/all', { params: { page, limit: PAGE_SIZE, status: statusFilter, search: searchQuery } })
      if (res.data.status === 'success') {
        setJobs(res.data.data.jobs || [])
        if (typeof res.data.data.totalJobs === 'number') setTotal(res.data.data.totalJobs)
      } else setFetchError(true)
    } catch (err) {
      if (isAbortError(err)) return
      setFetchError(true)
      showToast(extractErrorMessage(err, 'Failed to load jobs'), 'error')
    }
    finally { setLoading(false) }
  }, [page, statusFilter, searchQuery])

  // KPI counts computed server-side (a tiny limit=1 request per status returns the matching total)
  const fetchStats = useCallback(async () => {
    const statuses = ['all', 'BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'DISPUTED', 'COMPLETED', 'PAID', 'CLOSED', 'CANCELLED']
    try {
      const results = await Promise.all(statuses.map(status =>
        api.get('/admin/jobs/all', { params: { page: 1, limit: 1, status, search: searchQuery } })
          .then(r => r.data?.data?.totalJobs || 0)
          .catch(() => 0)
      ))
      const [all, broadcasting, quotes, allocated, arriving, inProgress, disputed, completed, paid, closed, cancelled] = results
      setStats({
        total: all,
        active: broadcasting + quotes + allocated + arriving + inProgress + disputed,
        completed: completed + paid + closed,
        cancelled,
      })
    } catch { /* keep previous stats */ }
  }, [searchQuery])

  useEffect(() => { fetchJobs() }, [fetchJobs])
  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchWorkers() }, [])
  useAdminRefresh(() => { fetchJobs(); fetchStats() })

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/admin/workers', { params: { limit: 500 } })
      if (res.data.status === 'success') setWorkers(res.data.data.workers || [])
    } catch { /* silent */ }
  }

  const fetchJobDetail = async (job) => {
    setLoadingDetail(true)
    setDetail(job)
    setDetailQuotes([])
    setDetailTxns([])
    setImpersonateToken(null)
    try {
      const res = await api.get(`/admin/jobs/${job._id}`)
      if (res.data.status === 'success') {
        if (res.data.data.job) setDetail(res.data.data.job)
        setDetailQuotes(res.data.data.quotes || [])
        setDetailTxns(res.data.data.walletTxns || [])
      }
    } catch { /* use existing data */ }
    finally { setLoadingDetail(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const resolveDispute = async () => {
    if (!resolveModal || resolving) return
    setResolving(true)
    try {
      const res = await api.patch(`/admin/jobs/${resolveModal._id}/resolve-dispute`, { resolution, adminNote: resolveNote })
      const updated = res.data?.data
      setJobs(prev => prev.map(j => j._id === resolveModal._id ? { ...j, status: updated?.status || 'CLOSED' } : j))
      if (detail?._id === resolveModal._id) fetchJobDetail(detail)
      showToast('Dispute resolved')
      fetchStats()
      window.dispatchEvent(new Event('admin-action'))
      setResolveModal(null)
      setResolveNote('')
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to resolve dispute'), 'error')
    } finally { setResolving(false) }
  }

  const cancelJob = async (id) => {
    if (actionId) return
    setActionId(id)
    try {
      await api.patch(`/admin/jobs/${id}/cancel`)
      setJobs(prev => prev.map(j => j._id === id ? { ...j, status: 'CANCELLED' } : j))
      showToast('Job cancelled')
      if (detail?._id === id) setDetail(prev => ({ ...prev, status: 'CANCELLED' }))
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to cancel job'), 'error')
    } finally {
      setActionId(null)
      setConfirm(null)
    }
  }

  const reassignWorker = async () => {
    if (!selectedWorker || !reassignModal || reassigning) return
    setReassigning(true)
    try {
      await api.patch(`/admin/jobs/${reassignModal._id}/reassign`, { workerId: selectedWorker })
      fetchJobs()
      showToast('Worker reassigned successfully')
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reassign'), 'error')
    } finally {
      setReassigning(false)
      setReassignModal(null)
      setSelectedWorker('')
    }
  }

  const handleImpersonate = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/impersonate`)
      if (res.data.status === 'success') { setImpersonateToken(res.data.data.token); showToast('Token generated') }
    } catch { showToast('Failed to generate token', 'error') }
  }

  const copyToken = (t) => { navigator.clipboard.writeText(t); showToast('Copied') }

  // Search + status filtering is done server-side; `total` reflects the filtered result count
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paged = jobs

  useEffect(() => { setPage(1) }, [statusFilter])

  const statsCards = useMemo(() => [
    { label: 'Total Jobs', value: stats.total, color: '#2EF7F0' },
    { label: 'Active', value: stats.active, color: '#F59E0B' },
    { label: 'Completed', value: stats.completed, color: '#10B981' },
    { label: 'Cancelled', value: stats.cancelled, color: '#EF4444' },
  ], [stats])

  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // Fetch every page of the current filter (not just the visible page)
      const all = []
      let p = 1
      const CHUNK = 100
      while (p <= 50) { // hard cap of 5000 rows
        const res = await api.get('/admin/jobs/all', { params: { page: p, limit: CHUNK, status: statusFilter, search: searchQuery } })
        const batch = res.data?.data?.jobs || []
        all.push(...batch)
        if (batch.length < CHUNK) break
        p += 1
      }
      if (all.length === 0) { showToast('No jobs to export', 'info'); return }
      const headers = ['Job ID', 'Customer', 'Worker', 'Category', 'City', 'Amount', 'Platform Fee', 'Status', 'Created At']
      const rows = all.map(j => [
        j._id,
        j.customerId?.name || j.customer || '',
        j.workerId?.name || j.worker || '',
        j.category + (j.subcategory ? ` - ${j.subcategory}` : ''),
        j.addressDetails?.city || j.locationName || '',
        j.payment?.amount || 0,
        j.payment?.platformFee || 0,
        j.status,
        j.createdAt ? new Date(j.createdAt).toLocaleString('en-IN') : ''
      ])
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jobs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`${all.length} jobs exported`)
    } catch (err) {
      if (!isAbortError(err)) showToast(extractErrorMessage(err, 'Failed to export jobs'), 'error')
    } finally { setExporting(false) }
  }
  const columns = [
    { header: 'Job ID', render: (j) => {
        const fj = formatJob(j);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{fj.id}</span>
            <button className="copy-btn" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(j._id); showToast('Copied') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', padding: 2 }}><Copy size={12} /></button>
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
            {['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING'].includes(j.status) && (
              <button className="btn-icon danger" title="Cancel Job" onClick={() => setConfirm({ type: 'cancel', id: j._id, name: `Job #${j._id.slice(-6)}` })}><Ban size={15} /></button>
            )}
          </div>
        );
    }}
  ];

  const formatJob = (j) => ({
    id: j._id?.toString().slice(-6) || '—',
    _id: j._id,
    customer: j.customerId?.name || j.customer || 'Unknown',
    customerId: j.customerId?._id || j.customerId,
    worker: j.workerId?.name || j.worker || '—',
    workerId: j.workerId?._id || j.workerId,
    category: j.category + (j.subcategory ? ` - ${j.subcategory}` : ''),
    city: j.addressDetails?.city || j.locationName || '—',
    fullAddress: j.addressDetails?.fullAddress || '—',
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
    d.gst = `₹${j.payment?.gst ?? j.payment?.gstAmount ?? 0}`
    d.paymentMethod = j.payment?.method || '—'
    d.startedAt = fmtDateTime(j.startedAt)
    d.completedAt = fmtDateTime(j.completionDetails?.completedAt)
    d.cancelReason = j.cancelReason || ''
    d.workerRating = j.rating?.score ? `${j.rating.score}★${j.rating.review ? ` — ${j.rating.review}` : ''}` : '—'
    d.customerRating = j.customerRating?.score ? `${j.customerRating.score}★${j.customerRating.review ? ` — ${j.customerRating.review}` : ''}` : '—'
    d.dispute = j.dispute?.reportedAt ? j.dispute : null
    d.timeSlot = j.timeSlot || '—'
    d.preferredDate = j.preferredDate ? new Date(j.preferredDate).toLocaleDateString('en-IN') : '—'
    d.media = j.media || []
    d.completionMedia = j.completionDetails?.media || []
    d.completionReport = j.completionDetails?.report || ''
    d.arrivalOtp = j.security?.arrivalOtp || '—'
    d.completionOtp = j.security?.completionOtp || '—'
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
          <button className="btn-secondary" onClick={exportCsv} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {statsCards.map(s => (
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
          {['all', 'BROADCASTING', 'ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED'].map(f => (
            <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : STATUS_LABEL[f] || f}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {total} result{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading jobs...</div>
        ) : fetchError ? (
          <EmptyState
            icon="⚠️"
            title="Couldn't load jobs"
            description="The server didn't respond. Check your connection and try again."
            action={<button className="btn btn-primary" onClick={() => fetchJobs()}>↻ Retry</button>}
          />
        ) : paged.length === 0 ? (
          <EmptyState icon="📋" title="No jobs found" description={search ? 'Try a different search' : 'No jobs created yet'} />
        ) : (
          <>
            <Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No jobs found"} />
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
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
                  <div className="detail-row"><span>Location</span><strong>{fd.fullAddress}</strong></div>
                  <div className="detail-row"><span>Date</span><strong>{fd.date}</strong></div>
                  <div className="detail-row"><span>Preferred Date</span><strong>{fd.preferredDate}</strong></div>
                  <div className="detail-row"><span>Time Slot</span><strong>{fd.timeSlot}</strong></div>
                  <div className="detail-row"><span>Amount</span><strong>{fd.amount}</strong></div>
                  <div className="detail-row"><span>Platform Fee</span><strong style={{ color: 'var(--success)' }}>{fd.fee}</strong></div>
                  <div className="detail-row"><span>Worker Payout</span><strong>{fd.workerPayout}</strong></div>
                  <div className="detail-row"><span>GST</span><strong>{fd.gst}</strong></div>
                  <div className="detail-row"><span>Payment Status</span><strong>{fd.paymentStatus}</strong></div>
                  <div className="detail-row"><span>Payment Method</span><strong>{fd.paymentMethod}</strong></div>
                  <div className="detail-row"><span>Started At</span><strong>{fd.startedAt}</strong></div>
                  <div className="detail-row"><span>Completed At</span><strong>{fd.completedAt}</strong></div>
                  {fd.cancelReason && <div className="detail-row"><span>Cancel Reason</span><strong>{fd.cancelReason}</strong></div>}
                  <div className="detail-row"><span>Customer → Worker Rating</span><strong>{fd.workerRating}</strong></div>
                  <div className="detail-row"><span>Worker → Customer Rating</span><strong>{fd.customerRating}</strong></div>
                  {fd.arrivalOtp !== '—' && <div className="detail-row"><span>Arrival OTP</span><strong>{fd.arrivalOtp}</strong></div>}
                  {fd.completionOtp !== '—' && <div className="detail-row"><span>Completion OTP</span><strong>{fd.completionOtp}</strong></div>}
                </div>

                {fd.description && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>Description</div>
                    <div style={{ background: 'var(--bg-dark)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--dark)', lineHeight: 1.6 }}>{fd.description}</div>
                  </>
                )}

                {fd.media && fd.media.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>Job Images</div>
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                      {fd.media.map((m, i) => (
                        <a key={i} href={m} target="_blank" rel="noopener noreferrer">
                          <img src={m} alt="Job Media" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                        </a>
                      ))}
                    </div>
                  </>
                )}

                {(fd.completionReport || (fd.completionMedia && fd.completionMedia.length > 0)) && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>Completion Details</div>
                    <div style={{ background: 'var(--bg-dark)', borderRadius: 10, padding: 14 }}>
                      {fd.completionReport && <div style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.6, marginBottom: fd.completionMedia?.length ? 12 : 0 }}>{fd.completionReport}</div>}
                      {fd.completionMedia && fd.completionMedia.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                          {fd.completionMedia.map((m, i) => (
                            <a key={i} href={m} target="_blank" rel="noopener noreferrer">
                              <img src={m} alt="Completion Media" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {fd.dispute && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>Dispute</div>
                    <div className="detail-grid">
                      <div className="detail-row"><span>Reported By</span><strong>{fd.dispute.reportedBy || '—'}</strong></div>
                      <div className="detail-row"><span>Amount Received</span><strong>₹{fd.dispute.amountReceived ?? 0}</strong></div>
                      <div className="detail-row"><span>Short Amount</span><strong style={{ color: 'var(--danger)' }}>₹{fd.dispute.shortAmount ?? 0}</strong></div>
                      <div className="detail-row"><span>Reason</span><strong>{fd.dispute.reason || '—'}</strong></div>
                      <div className="detail-row"><span>Reported At</span><strong>{fmtDateTime(fd.dispute.reportedAt)}</strong></div>
                      <div className="detail-row"><span>Dispute Status</span><strong>{fd.dispute.status || 'OPEN'}</strong></div>
                      {fd.dispute.resolution && <div className="detail-row"><span>Resolution</span><strong>{fd.dispute.resolution}{fd.dispute.adminNote ? ` — ${fd.dispute.adminNote}` : ''}</strong></div>}
                    </div>
                  </>
                )}

                {detailTxns.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Wallet Transactions ({detailTxns.length})</div>
                    {detailTxns.map(t => {
                      const credit = t.direction ? t.direction === 'CREDIT' : CREDIT_TXN_TYPES.includes(t.type)
                      return (
                        <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{t.type}{t.status && t.status !== 'COMPLETED' ? ` · ${t.status}` : ''}</div>
                            <div style={{ fontSize: 11, color: 'var(--mid)' }}>{t.description || '—'} · {fmtDateTime(t.createdAt)}</div>
                          </div>
                          <strong style={{ color: credit ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>{credit ? '+' : '−'}₹{t.amount}</strong>
                        </div>
                      )
                    })}
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
                  {fd.status === 'DISPUTED' && (
                    <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setResolveModal(fd); setResolution('DEDUCT_FROM_WORKER'); setResolveNote('') }}>
                      Resolve Dispute
                    </button>
                  )}
                  {['COMPLETED', 'PAID', 'CLOSED'].includes(fd.status) && (
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => window.open(`/receipt/${fd._id}`, '_blank')}>
                      <FileText size={14} /> View Receipt
                    </button>
                  )}
                  {['BROADCASTING', 'QUOTES_RECEIVED', 'ALLOCATED', 'ARRIVING'].includes(fd.status) && (
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
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setReassignModal(null); setSelectedWorker(''); }} disabled={reassigning}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} disabled={!selectedWorker || reassigning} onClick={reassignWorker}>{reassigning ? 'Reassigning…' : 'Reassign'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Resolve Dispute Modal */}
      <Modal open={!!resolveModal} onClose={() => !resolving && setResolveModal(null)} title="Resolve Dispute" width="480px">
        {resolveModal && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
              Resolve the part-payment dispute on job <strong>#{resolveModal.id}</strong>. The job will be closed.
            </p>
            <div className="form-group">
              <label className="form-label">Resolution</label>
              <select className="form-control" value={resolution} onChange={e => setResolution(e.target.value)}>
                {DISPUTE_RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Admin note</label>
              <textarea className="form-control" rows={3} value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="Optional note for the record" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setResolveModal(null)} disabled={resolving}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} disabled={resolving} onClick={resolveDispute}>{resolving ? 'Resolving…' : 'Resolve'}</button>
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
          loading={actionId === confirm.id}
          onConfirm={() => cancelJob(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
