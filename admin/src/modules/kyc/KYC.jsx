import React, { useState, useEffect } from 'react'
import api from '../../services/api'

export default function KYC() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetchPendingKYC()
  }, [])

  const fetchPendingKYC = async () => {
    try {
      const response = await api.get('/admin/pending-kyc')
      if (response.data.status === 'success') {
        setPending(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching KYC queue:', error)
      showToast('Error fetching KYC queue')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const handleUpdateStatus = async (id, status) => {
    try {
      const response = await api.patch(`/admin/workers/${id}/kyc`, { status })
      if (response.data.status === 'success') {
        setPending(prev => prev.filter(w => w._id !== id))
        showToast(`KYC ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`)
      }
    } catch (error) {
      showToast('Failed to update KYC')
    }
    setRejectModal(false)
    setSelected(null)
    setRejectReason('')
  }

  const allDocsUploaded = (docs) => {
      // In our model kyc.documents is an array of strings (URLs)
      // For this mock-to-prod transition, we'll assume if array has items, it's partially done.
      // If we want to be strict, we'd check if specific docs exist.
      return docs && docs.length >= 3 
  }

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background:'#0F172A', color:'white', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, animation:'slideUp 0.3s ease', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">🪪 KYC Verification Queue</div>
          <div className="page-subtitle">{pending.length} pending reviews · sorted oldest first</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={fetchPendingKYC}>🔄 Refresh Queue</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading queue...</div>
        ) : pending.map((w, i) => (
          <div
            key={w._id}
            className="card"
            style={{
              padding: 20, cursor: 'pointer',
              border: '1px solid var(--border)',
              transition: 'all 0.15s',
            }}
            onClick={() => setSelected(w)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--mid)', flexShrink: 0 }}>
                {i + 1}
              </div>

              <div className="avatar avatar-md" style={{ background: 'linear-gradient(135deg, var(--primary), var(--purple))', flexShrink: 0 }}>
                 {w.name ? w.name[0] : '?'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{w.name || 'Unknown'}</span>
                  {!allDocsUploaded(w.kyc?.documents) && <span className="badge badge-warning">Incomplete Docs</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>
                   {w.phone} · {w.city} · Joined {new Date(w.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-success btn-sm" onClick={() => handleUpdateStatus(w._id, 'APPROVED')}>✓ Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => { setSelected(w); setRejectModal(true); }}>✕ Reject</button>
              </div>
            </div>
          </div>
        ))}

        {!loading && pending.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">Queue is clear!</div>
            <div className="empty-state-desc">All KYC applications have been reviewed.</div>
          </div>
        )}
      </div>

      {/* Worker Detail View */}
      {selected && !rejectModal && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div style={{ fontWeight: 800, fontSize: 16 }}>KYC Review</div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg, var(--primary), var(--purple))' }}>
                  {selected.name ? selected.name[0] : '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.name}</div>
                  <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{selected.phone} · {selected.city}</div>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Documents</div>
              <div className="grid-3" style={{ marginBottom: 20 }}>
                {['Aadhaar', 'PAN', 'Selfie'].map((label, idx) => (
                  <div key={idx} className={`doc-card ${selected.kyc?.documents?.[idx] ? '' : 'rejected'}`}>
                    <div className="doc-card-img">{['🪪','📄','🤳'][idx]}</div>
                    <div className="doc-card-footer">
                      <div className="doc-card-name">{label}</div>
                      <div className="doc-card-status" style={{ color: selected.kyc?.documents?.[idx] ? 'var(--success)' : 'var(--danger)' }}>
                        {selected.kyc?.documents?.[idx] ? '✓ Uploaded' : '✗ Missing'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-success"
                  style={{ flex: 1 }}
                  onClick={() => handleUpdateStatus(selected._id, 'APPROVED')}
                >
                  ✓ Approve KYC
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => setRejectModal(true)}
                >
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
              <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16, fontFamily: 'var(--font-body)' }}>
                Please provide a reason for rejection.
              </p>
              <div className="form-group">
                <label className="form-label">Rejection Reason</label>
                <select className="form-control" value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
                  <option value="">Select a reason...</option>
                  <option>Document image is blurry or unreadable</option>
                  <option>Document does not match provided details</option>
                  <option>Expired document submitted</option>
                  <option>Selfie does not match ID photo</option>
                  <option>Suspected fraudulent documents</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setRejectModal(false); setRejectReason(''); }}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleUpdateStatus(selected._id, 'REJECTED')} disabled={!rejectReason}>✕ Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
