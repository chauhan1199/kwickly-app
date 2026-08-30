import React, { useState, useEffect, useCallback } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest';
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import { getImageUrl } from '../../services/api'
import { Eye, CheckCircle, XCircle, Store, User, Search, Download, RefreshCw } from 'lucide-react'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'

const PAGE_SIZE = 15
const EXPORT_CHUNK = 50 // backend caps limit at 50

export default function KYC() {
  const api = useAbortableRequest();
  const [pending, setPending] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ workers: 0, shops: 0 })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [filter, setFilter] = useState('all')
  const [confirmApproval, setConfirmApproval] = useState(null)
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingKycId, setPendingKycId] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Debounce the search box so the server query fires after typing stops
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  // Server-side pagination + search + kycType filter
  const fetchPendingKYC = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    try {
      const response = await api.get('/admin/pending-kyc', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: searchQuery || undefined,
          kycType: filter === 'all' ? undefined : filter
        }
      })
      if (response.data.status === 'success') {
        const data = response.data.data || {}
        setPending(data.items || [])
        setTotal(typeof data.total === 'number' ? data.total : (data.items || []).length)
        setTotalPages(data.totalPages || Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)))
        if (data.stats) setStats({ workers: data.stats.workers || 0, shops: data.stats.shops || 0 })
      } else {
        setFetchError(true)
      }
    } catch (error) {
      if (isAbortError(error)) return
      setFetchError(true)
      showToast(extractErrorMessage(error, 'Failed to load KYC queue'), 'error')
    } finally { setLoading(false) }
  }, [page, searchQuery, filter])

  useEffect(() => { fetchPendingKYC() }, [fetchPendingKYC])

  const showToast = (msg, type='success') => setToast({message: msg, type})

  const handleUpdateStatus = async (id, status, kycType) => {
    if (pendingKycId) return
    setPendingKycId(id)
    try {
      const endpoint = kycType === 'SHOP' ? `/admin/shops/${id}/kyc` : `/admin/workers/${id}/kyc`
      const payload = { status }
      if (status === 'REJECTED' && rejectReason.trim()) {
        payload.reason = rejectReason.trim()
      }
      const response = await api.patch(endpoint, payload)
      if (response.data.status === 'success') {
        showToast(`KYC ${status === 'APPROVED' ? 'Approved' : 'Rejected'} successfully`)
        window.dispatchEvent(new Event('admin-action'))
        // Refresh the current server-paged view (drops the reviewed row, fixes totals)
        fetchPendingKYC()
      } else {
        showToast(response.data.message || 'Failed to update KYC', 'error')
      }
    } catch (error) {
      showToast(extractErrorMessage(error, 'Failed to update KYC'), 'error')
    } finally {
      setPendingKycId(null)
      setRejectModal(false)
      setSelected(null)
      setRejectReason('')
      setConfirmApproval(null)
    }
  }

  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // Fetch every page of the current filter (not just the visible page)
      const all = []
      let p = 1
      while (p <= 200) { // hard cap of 10000 rows
        const res = await api.get('/admin/pending-kyc', {
          params: {
            page: p,
            limit: EXPORT_CHUNK,
            search: searchQuery || undefined,
            kycType: filter === 'all' ? undefined : filter
          }
        })
        const batch = res.data?.data?.items || []
        all.push(...batch)
        if (batch.length < EXPORT_CHUNK) break
        p += 1
      }
      if (all.length === 0) { showToast('No KYC applications to export', 'info'); return }
      const headers = ['Name', 'Type', 'Phone', 'City', 'Documents', 'Submitted On', 'KYC Status']
      const rows = all.map(item => [
        item.name || 'Unknown',
        item.kycType || '',
        item.phone || '',
        item.city || '',
        item.kyc?.documents?.length || 0,
        item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '',
        item.kyc?.status || 'PENDING'
      ])
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pending-kyc-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`${all.length} KYC applications exported`)
    } catch (err) {
      if (!isAbortError(err)) showToast(extractErrorMessage(err, 'Failed to export KYC data'), 'error')
    } finally { setExporting(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">🪪 KYC Verification Queue</div>
          <div className="page-subtitle">{total} pending reviews · {stats.workers} workers · {stats.shops} shops · sorted oldest first</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search name, phone, city..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ v: 'all', l: 'All' }, { v: 'WORKER', l: 'Workers' }, { v: 'SHOP', l: 'Shops' }].map(f => (
              <button key={f.v} className={`filter-tab ${filter === f.v ? 'active' : ''}`} onClick={() => { setFilter(f.v); setPage(1) }} style={{ padding: '6px 14px', fontSize: 12 }}>{f.l}</button>
            ))}
          </div>
          <button className="btn-secondary" onClick={exportCsv} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {exporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="btn btn-outline" onClick={() => fetchPendingKYC()} disabled={loading}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading queue...</div>
        ) : fetchError ? (
          <EmptyState
            icon="⚠️"
            title="Couldn't load the KYC queue"
            description="The server didn't respond. Check your connection and try again."
            action={<button className="btn btn-primary" onClick={() => fetchPendingKYC()}>↻ Retry</button>}
          />
        ) : pending.map((item, i) => (
          <div key={item._id} className="card" style={{ padding: 20, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s' }} onClick={() => setSelected(item)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--mid)', flexShrink: 0 }}>
                {(page - 1) * PAGE_SIZE + i + 1}
              </div>

              <div className="avatar avatar-md" style={{ background: item.kycType === 'SHOP' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, var(--primary), var(--purple))', flexShrink: 0 }}>
                {item.name ? item.name[0] : '?'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{item.name || 'Unknown'}</span>
                  <span className={`badge badge-${item.kycType === 'SHOP' ? 'success' : 'info'}`} style={{ fontSize: 10 }}>
                    {item.kycType === 'SHOP' ? <><Store size={10} /> Shop</> : <><User size={10} /> Worker</>}
                  </span>
                  {(!item.kyc?.documents || item.kyc.documents.length === 0) && <span className="badge badge-warning">No Docs</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mid)' }}>
                  {item.phone} · {item.kyc?.documents?.length || 0} document(s) · Joined {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-success btn-sm" disabled={pendingKycId === item._id} onClick={() => setConfirmApproval({ id: item._id, status: 'APPROVED', kycType: item.kycType, name: item.name })}>
                  {pendingKycId === item._id ? '…' : '✓ Approve'}
                </button>
                <button className="btn btn-danger btn-sm" disabled={pendingKycId === item._id} onClick={() => { setSelected(item); setRejectModal(true); }}>✕ Reject</button>
              </div>
            </div>
          </div>
        ))}

        {!loading && !fetchError && total === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">Queue is clear!</div>
            <div className="empty-state-desc">{search ? 'Try a different search term' : 'All KYC applications have been reviewed.'}</div>
          </div>
        )}

        {!loading && !fetchError && total > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>

      {/* Detail Drawer */}
      {selected && !rejectModal && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div style={{ fontWeight: 800, fontSize: 16 }}>KYC Review — {selected.kycType === 'SHOP' ? 'Shop' : 'Worker'}</div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                <div className="avatar avatar-lg" style={{ background: selected.kycType === 'SHOP' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, var(--primary), var(--purple))' }}>
                  {selected.name ? selected.name[0] : '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.name}</div>
                  <div style={{ color: 'var(--mid)' }}>{selected.phone}{selected.city ? ` · ${selected.city}` : ''}</div>
                </div>
              </div>

              {/* KYC Documents */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Documents ({selected.kyc?.documents?.length || 0})
              </div>

              {selected.kyc?.documents?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {selected.kyc.documents.map((doc, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#f8fafc' }}>
                          {doc.name || `${doc.type || doc.docType || 'Identity'} Document`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{doc.type || doc.docType || 'ID Proof'}</span>
                          {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {doc.url && <button className="btn-icon" title="Preview" onClick={() => setPreviewDoc(doc)}><Eye size={14} /></button>}
                        {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Open in Tab" style={{ textDecoration: 'none' }}>↗</a>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 16, fontStyle: 'italic', marginBottom: 20, textAlign: 'center', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  No documents uploaded yet
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-success" style={{ flex: 1 }} disabled={pendingKycId === selected._id} onClick={() => setConfirmApproval({ id: selected._id, status: 'APPROVED', kycType: selected.kycType, name: selected.name })}>
                  {pendingKycId === selected._id ? 'Processing…' : '✓ Approve KYC'}
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} disabled={pendingKycId === selected._id} onClick={() => setRejectModal(true)}>
                  ✕ Reject with Reason
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => { setRejectModal(false); setRejectReason(''); }} title="Reject KYC Application" width="460px">
        <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16 }}>
          Please specify a reason for rejecting this KYC application. The user will be notified to correct and re-upload their documents.
        </p>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Rejection Reason *</label>
          <select className="form-control" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">Select a reason...</option>
            <option value="Document image is blurry or unreadable">Document image is blurry or unreadable</option>
            <option value="Document does not match provided profile details">Document does not match provided profile details</option>
            <option value="Expired or invalid document submitted">Expired or invalid document submitted</option>
            <option value="Incomplete or cropped document">Incomplete or cropped document</option>
            <option value="Suspected fraudulent documents">Suspected fraudulent documents</option>
            <option value="Other verification discrepancy">Other verification discrepancy</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setRejectModal(false); setRejectReason(''); }}>Cancel</button>
          <button type="button" className="btn-danger" style={{ flex: 1 }} onClick={() => handleUpdateStatus(selected._id, 'REJECTED', selected.kycType)} disabled={!rejectReason || pendingKycId === selected._id}>
            {pendingKycId === selected._id ? 'Processing…' : '✕ Confirm Rejection'}
          </button>
        </div>
      </Modal>

      {/* Confirm Approval Modal */}
      {confirmApproval && (
        <ConfirmModal
          title="Approve KYC"
          message={`Approve KYC for ${confirmApproval.name}? This will verify their identity.`}
          confirmText="Approve"
          loading={pendingKycId === confirmApproval.id}
          onConfirm={() => handleUpdateStatus(confirmApproval.id, confirmApproval.status, confirmApproval.kycType)}
          onClose={() => setConfirmApproval(null)}
        />
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="drawer-overlay" onClick={() => setPreviewDoc(null)} style={{ zIndex: 2000 }}>
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-card, #1a1f2e)', borderRadius: 16, padding: 20, zIndex: 2001, maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{previewDoc.name || `${previewDoc.type || 'Identity'} Document`}</div>
                <div style={{ fontSize: 12, color: 'var(--mid)' }}>{previewDoc.type || previewDoc.docType || 'Document'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={getImageUrl(previewDoc.url)} target="_blank" rel="noopener noreferrer" style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: 'var(--text)' }}>Open in Tab</a>
                <button className="btn-icon" onClick={() => setPreviewDoc(null)} title="Close">✕</button>
              </div>
            </div>
            {previewDoc.url?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={getImageUrl(previewDoc.url)} alt={previewDoc.name} style={{ maxWidth: '80vw', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain', background: '#000' }} />
            ) : previewDoc.url?.match(/\.pdf$/i) ? (
              <iframe src={getImageUrl(previewDoc.url)} title={previewDoc.name} style={{ width: '80vw', height: '70vh', border: 'none', borderRadius: 8 }} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📄</div>
                <div>Preview not available for this file type</div>
                <a href={getImageUrl(previewDoc.url)} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-block', padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>Open File</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
