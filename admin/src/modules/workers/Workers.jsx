import React, { useState, useEffect } from 'react'
import api from '../../services/api'

const subColors = { trial:'badge-purple', monthly:'badge-primary', annual:'badge-success', expired:'badge-danger' }
const kycColors = { APPROVED:'badge-success', PENDING:'badge-warning', REJECTED:'badge-danger' }

function ConfirmModal({ title, message, onConfirm, onClose, danger=true }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:400 }}>
        <div className="modal-header">
          <div style={{ fontWeight:800, fontSize:16 }}>{title}</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:14, color:'var(--mid)', fontFamily:'var(--font-body)', lineHeight:1.6 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger?'btn-danger':'btn-success'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

export default function Workers() {
  const [workers, setWorkers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [kycFilter, setKycFilter] = useState('all')
  const [selected, setSelected]   = useState(null)
  const [confirm, setConfirm]     = useState(null)
  const [toast, setToast]         = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [newWorker, setNewWorker] = useState({ name: '', phone: '' })

  useEffect(() => {
    fetchWorkers()
  }, [])

  const fetchWorkers = async () => {
    try {
      const response = await api.get('/admin/workers')
      if (response.data.status === 'success') {
        setWorkers(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching workers:', error)
      showToast('Error fetching workers')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),2800) }

  const addWorker = async (e) => {
    e.preventDefault()
    try {
      const response = await api.post('/admin/users', { ...newWorker, role: 'WORKER' })
      if (response.data.status === 'success') {
        showToast('Worker created successfully!')
        setShowAdd(false)
        setNewWorker({ name: '', phone: '' })
        fetchWorkers()
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create worker')
    }
  }

  const getWorker  = (id) => workers.find(w=>w._id===id)

  /* ── Actions ── */
  const updateKYC = async (id, status) => {
    try {
      const response = await api.patch(`/admin/workers/${id}/kyc`, { status })
      if (response.data.status === 'success') {
        setWorkers(prev=>prev.map(w=>w._id===id ? response.data.data : w))
        showToast(`KYC status updated to ${status}`)
      }
    } catch (error) {
      showToast('Failed to update KYC')
    }
    setConfirm(null)
  }

  const toggleSuspend = async (id) => {
    try {
        const response = await api.patch(`/admin/users/${id}/toggle-status`)
        if (response.data.status === 'success') {
          setWorkers(prev=>prev.map(w=>w._id===id ? response.data.data : w))
          showToast(`Worker status updated`)
        }
      } catch (error) {
        showToast('Failed to update status')
      }
      setConfirm(null)
  }

  const deleteWorker = async (id) => {
    try {
        const response = await api.delete(`/admin/users/${id}`)
        if (response.data.status === 'success') {
          setWorkers(prev=>prev.filter(x=>x._id!==id))
          showToast(`Worker deleted`)
        }
      } catch (error) {
        showToast('Failed to delete worker')
      }
      setConfirm(null)
  }

  const filtered = workers.filter(w => {
    const nameMatch = w.name?.toLowerCase().includes(search.toLowerCase())
    const cityMatch = w.city?.toLowerCase().includes(search.toLowerCase())
    const matchSearch = nameMatch || cityMatch
    const matchKyc = kycFilter==='all' || w.kyc?.status===kycFilter
    return matchSearch && matchKyc
  })

  const selectedFresh = selected ? workers.find(w=>w._id===selected._id) : null

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed',bottom:24,right:24,zIndex:999,background:'#0F172A',color:'white',padding:'12px 20px',borderRadius:12,fontWeight:600,fontSize:14,animation:'slideUp 0.3s ease',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">🔧 Workers</div>
          <div className="page-subtitle">{workers.length} registered service providers</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Worker</button>
          <button className="btn btn-outline" onClick={fetchWorkers}>🔄 Refresh Workers</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar" style={{ width:240 }}>
          <span>🔍</span>
          <input placeholder="Name, city..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--mid)' }}>KYC:</span>
          {['all','APPROVED','PENDING','REJECTED'].map(f=>(
            <button key={f} className={`filter-chip ${kycFilter===f?'active':''}`} onClick={()=>setKycFilter(f)}>
              {f==='all'?'All':f}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading workers...</div>
        ) : (
            <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Worker</th><th>KYC</th><th>Wallet</th>
                  <th>Subscription</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w=>(
                  <tr key={w._id} style={{ cursor:'pointer' }} onClick={()=>setSelected(w)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {w.profileImage ? (
                          <img src={w.profileImage} alt={w.name} className="avatar avatar-sm" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div className="avatar avatar-sm" style={{ background:'linear-gradient(135deg, var(--primary), var(--purple))' }}>
                            {w.name ? w.name[0] : '?'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight:600 }}>{w.name || 'Unknown'}</div>
                          <div style={{ fontSize:11, color:'var(--mid)' }}>{w.city} · {w._id.slice(-6)}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${kycColors[w.kyc?.status] || 'badge-gray'}`}>{w.kyc?.status}</span></td>
                    <td>
                      <div style={{ fontWeight:700 }}>₹{w.wallet?.balance || 0}</div>
                    </td>
                    <td>
                      <span className={`badge badge-gray`}>
                        {w.subscription?.isTrial ? 'Trial' : (w.subscription?.planId || 'None')}
                      </span>
                    </td>
                    <td>
                        <span className={`badge ${w.isVerified ?'badge-success':'badge-gray'}`}>{w.isVerified ?'Active':'Inactive'}</span>
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-outline btn-sm" onClick={()=>setSelected(w)}>View</button>
                        <button
                          className={`btn btn-sm ${w.isVerified ? 'btn-danger' : 'btn-success'}`}
                          onClick={()=>setConfirm({type:'suspend',id:w._id})}
                        >
                          {w.isVerified ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background:'var(--danger-light)',color:'var(--danger)',border:'none' }}
                          onClick={()=>setConfirm({type:'delete',id:w._id})}
                          title="Delete"
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedFresh && (
        <>
          <div className="drawer-overlay" onClick={()=>setSelected(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div style={{ fontWeight:800, fontSize:16 }}>Worker Profile</div>
              <button className="drawer-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:20 }}>
                {selectedFresh.profileImage ? (
                  <img src={selectedFresh.profileImage} alt={selectedFresh.name} className="avatar avatar-lg" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="avatar avatar-lg" style={{ background:'linear-gradient(135deg,#F97316,#EA580C)' }}>
                     {selectedFresh.name ? selectedFresh.name[0] : '?'}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight:800, fontSize:18 }}>{selectedFresh.name}</div>
                  <div style={{ color:'var(--mid)',fontFamily:'var(--font-body)',fontSize:13 }}>{selectedFresh.phone} · {selectedFresh.city}</div>
                  <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <span className={`badge ${kycColors[selectedFresh.kyc?.status] || 'badge-gray'}`}>KYC: {selectedFresh.kyc?.status}</span>
                    <span className={`badge ${selectedFresh.isVerified ? 'badge-success' : 'badge-gray'}`}>{selectedFresh.isVerified ? 'Active':'Inactive'}</span>
                  </div>
                </div>
              </div>

              <div className="divider" />
              <div style={{ fontSize:12,fontWeight:700,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10 }}>KYC Review</div>
              
              {/* Uploaded Documents Grid */}
              <div style={{ marginBottom: 16 }}>
                {selectedFresh.kyc?.documents && selectedFresh.kyc.documents.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {selectedFresh.kyc.documents.map((doc, idx) => (
                      <a key={idx} href={doc} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-dark)' }}>
                        <img 
                          src={doc} 
                          alt={`KYC Document ${idx + 1}`} 
                          style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} 
                          onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML += `<div style="padding:40px 0;text-align:center;font-size:11px;color:var(--mid)">File ${idx+1}</div>` }}
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:'var(--mid)', fontStyle:'italic', padding: '10px 0' }}>No documents uploaded yet.</div>
                )}
              </div>

              {selectedFresh.kyc?.status==='PENDING' && (
                <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                  <button className="btn btn-success" style={{ flex:1 }} onClick={()=>setConfirm({type:'kyc_approve',id:selectedFresh._id})}>✓ Approve KYC</button>
                  <button className="btn btn-danger"  style={{ flex:1 }} onClick={()=>setConfirm({type:'kyc_reject', id:selectedFresh._id})}>✕ Reject KYC</button>
                </div>
              )}

              <div className="divider" />
              <div style={{ display:'flex', gap:10 }}>
                <button
                  className={`btn ${selectedFresh.isVerified ?'btn-danger':'btn-success'}`}
                  style={{ flex:1 }}
                  onClick={()=>setConfirm({type:'suspend', id:selectedFresh._id})}
                >
                  {selectedFresh.isVerified ? '🚫 Deactivate Account' : '✓ Activate Account'}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex:1 }}
                  onClick={()=>setConfirm({type:'delete', id:selectedFresh._id})}
                >
                  🗑 Delete Account
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {confirm?.type==='kyc_approve' && (
        <ConfirmModal
          title="Approve KYC"
          message={`Approve KYC for ${getWorker(confirm.id)?.name}?`}
          danger={false}
          onConfirm={()=>updateKYC(confirm.id, 'APPROVED')}
          onClose={()=>setConfirm(null)}
        />
      )}
      {confirm?.type==='kyc_reject' && (
        <ConfirmModal
          title="Reject KYC"
          message={`Reject KYC for ${getWorker(confirm.id)?.name}?`}
          onConfirm={()=>updateKYC(confirm.id, 'REJECTED')}
          onClose={()=>setConfirm(null)}
        />
      )}
      {confirm?.type==='suspend' && (
        <ConfirmModal
          title={getWorker(confirm.id)?.isVerified ? 'Deactivate Worker' : 'Activate Worker'}
          message={getWorker(confirm.id)?.isVerified
            ? `Deactivate ${getWorker(confirm.id)?.name}?`
            : `Activate ${getWorker(confirm.id)?.name}?`}
          danger={getWorker(confirm.id)?.isVerified}
          onConfirm={()=>toggleSuspend(confirm.id)}
          onClose={()=>setConfirm(null)}
        />
      )}
      {confirm?.type==='delete' && (
        <ConfirmModal
          title="Delete Worker"
          message={`Permanently delete ${getWorker(confirm.id)?.name}?`}
          onConfirm={()=>deleteWorker(confirm.id)}
          onClose={()=>setConfirm(null)}
        />
      )}

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: 16 }}>Add New Worker</div>
              <button className="drawer-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={addWorker}>
              <div className="modal-body">
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>Full Name</label>
                  <input required placeholder="Jane Doe" value={newWorker.name} onChange={e => setNewWorker({...newWorker, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-light)', color: 'white' }} />
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>Phone Number</label>
                  <input required placeholder="9876543210" value={newWorker.phone} onChange={e => setNewWorker({...newWorker, phone: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-light)', color: 'white' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Worker</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
