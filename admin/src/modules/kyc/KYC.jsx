import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest';
import { getImageUrl } from '../../services/api'
import { Eye, CheckCircle, XCircle, Store, User } from 'lucide-react'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

export default function KYC() {
  const api = useAbortableRequest();
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [filter, setFilter] = useState('all')
  const [confirmApproval, setConfirmApproval] = useState(null)

  useEffect(() => { fetchPendingKYC() }, [])

  const fetchPendingKYC = async () => {
    setLoading(true)
    try {
      const response = await api.get('/admin/pending-kyc')
      if (response.data.status === 'success') setPending(response.data.data)
    } catch (error) {
      showToast('Error fetching KYC queue', 'error')
    } finally { setLoading(false) }
  }

  const showToast = (msg, type='success') => setToast({message: msg, type})

  const handleUpdateStatus = async (id, status, kycType) => {
    try {
      const endpoint = kycType === 'SHOP' ? `/admin/shops/${id}/kyc` : `/admin/workers/${id}/kyc`
      const response = await api.patch(endpoint, { status })
      if (response.data.status === 'success') {
        setPending(prev => prev.filter(item => item._id !== id))
        showToast(`KYC ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`)
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch (error) {
      showToast('Failed to update KYC', 'error')
    }
    setRejectModal(false)
    setSelected(null)
    setRejectReason('')
  }

  const filtered = pending.filter(item => {
    if (filter === 'all') return true
    return item.kycType === filter
  })

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">🪪 KYC Verification Queue</div>
          <div className="page-subtitle">{pending.length} pending reviews · sorted oldest first</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ v: 'all', l: 'All' }, { v: 'WORKER', l: 'Workers' }, { v: 'SHOP', l: 'Shops' }].map(f => (
              <button key={f.v} className={`filter-tab ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)} style={{ padding: '6px 14px', fontSize: 12 }}>{f.l}</button>
            ))}
          </div>
          <button className="btn btn-outline" onClick={fetchPendingKYC}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading queue...</div>
        ) : filtered.map((item, i) => (
          <div key={item._id} className="card" style={{ padding: 20, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s' }} onClick={() => setSelected(item)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--mid)', flexShrink: 0 }}>
                {i + 1}
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
                <button className="btn btn-success btn-sm" onClick={() => setConfirmApproval({ id: item._id, status: 'APPROVED', kycType: item.kycType, name: item.name })}>✓ Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => { setSelected(item); setRejectModal(true); }}>✕ Reject</button>
              </div>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">Queue is clear!</div>
            <div className="empty-state-desc">All KYC applications have been reviewed.</div>
          </div>
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
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{doc.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>{doc.docType || 'Document'}</div>
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
                <button className="btn btn-success" style={{ flex: 1 }} onClick={() => setConfirmApproval({ id: selected._id, status: 'APPROVED', kycType: selected.kycType, name: selected.name })}>
                  ✓ Approve KYC
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setRejectModal(true)}>
                  ✕ Reject with Reason
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: 16 }}>Reject KYC Application</div>
              <button className="drawer-close" onClick={() => { setRejectModal(false); setRejectReason(''); }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16 }}>
                Please provide a reason for rejection.
              </p>
              <div className="form-group">
                <label className="form-label">Rejection Reason</label>
                <select className="form-control" value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
                  <option value="">Select a reason...</option>
                  <option>Document image is blurry or unreadable</option>
                  <option>Document does not match provided details</option>
                  <option>Expired document submitted</option>
                  <option>Suspected fraudulent documents</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setRejectModal(false); setRejectReason(''); }}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleUpdateStatus(selected._id, 'REJECTED', selected.kycType)} disabled={!rejectReason}>✕ Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Approval Modal */}
      {confirmApproval && (
        <ConfirmModal
          title="Approve KYC"
          message={`Approve KYC for ${confirmApproval.name}? This will verify their identity.`}
          confirmText="Approve"
          onConfirm={() => { handleUpdateStatus(confirmApproval.id, confirmApproval.status, confirmApproval.kycType); setConfirmApproval(null); }}
          onClose={() => setConfirmApproval(null)}
        />
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="drawer-overlay" onClick={() => setPreviewDoc(null)} style={{ zIndex: 2000 }}>
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-card, #1a1f2e)', borderRadius: 16, padding: 20, zIndex: 2001, maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{previewDoc.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mid)' }}>{previewDoc.docType || 'Document'}</div>
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
