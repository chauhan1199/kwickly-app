import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, FormRow, validators } from '../../components/FormInput'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Shield, ShieldOff, Copy } from 'lucide-react'

const PAGE_SIZE = 15
const KYC_VARIANT = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }

export default function Workers() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kycFilter, setKycFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editWorker, setEditWorker] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', city: '' })
  const [formErrors, setFormErrors] = useState({})
  const [impersonateToken, setImpersonateToken] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchWorkers() }, [])

  const fetchWorkers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/workers')
      if (res.data.status === 'success') setWorkers(res.data.data.workers || [])
    } catch { showToast('Failed to load workers', 'error') }
    finally { setLoading(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = workers.filter(w => {
    const matchSearch = w.name?.toLowerCase().includes(search.toLowerCase()) || w.city?.toLowerCase().includes(search.toLowerCase()) || w.phone?.includes(search)
    const matchKyc = kycFilter === 'all' || w.kyc?.status === kycFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? w.isVerified : !w.isVerified)
    return matchSearch && matchKyc && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, kycFilter, statusFilter])

  const validateForm = () => {
    const errors = {}
    errors.name = validators.name(formData.name)
    errors.phone = validators.phone(formData.phone)
    errors.email = validators.email(formData.email)
    setFormErrors(errors)
    return !errors.name && !errors.phone && !errors.email
  }

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: null }))
  }

  const openAdd = () => { setEditWorker(null); setFormData({ name: '', phone: '', email: '', city: '' }); setFormErrors({}); setShowForm(true) }
  const openEdit = (w) => { setEditWorker(w); setFormData({ name: w.name || '', phone: w.phone || '', email: w.email || '', city: w.city || '' }); setFormErrors({}); setShowForm(true) }

  const saveWorker = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setSaving(true)
    try {
      if (editWorker) {
        await api.patch(`/admin/users/${editWorker._id}`, formData)
        setWorkers(prev => prev.map(w => w._id === editWorker._id ? { ...w, ...formData } : w))
        showToast('Worker updated successfully')
        window.dispatchEvent(new Event('admin-action'))
      } else {
        await api.post('/admin/users', { ...formData, role: 'WORKER' })
        showToast('Worker created successfully')
        fetchWorkers()
        window.dispatchEvent(new Event('admin-action'))
      }
      setShowForm(false)
    } catch (err) {
      const data = err.response?.data
      const specificErrors = data?.errors
      if (Array.isArray(specificErrors) && specificErrors.length > 0) {
        showToast(specificErrors.join('. '), 'error')
      } else {
        showToast(data?.message || 'Operation failed', 'error')
      }
    }
    finally { setSaving(false) }
  }

  const toggleStatus = async (id) => {
    try {
      const res = await api.patch(`/admin/users/${id}/toggle-status`)
      if (res.data.status === 'success') { setWorkers(prev => prev.map(w => w._id === id ? res.data.data : w)); showToast('Worker status updated'); window.dispatchEvent(new Event('admin-action')) }
    } catch { showToast('Failed to update status', 'error') }
    setConfirm(null)
  }

  const deleteWorker = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`)
      setWorkers(prev => prev.filter(w => w._id !== id))
      showToast('Worker deleted')
      if (detail?._id === id) setDetail(null)
      window.dispatchEvent(new Event('admin-action'))
    } catch { showToast('Failed to delete worker', 'error') }
    setConfirm(null)
  }

  const updateKYC = async (id, status) => {
    try {
      const res = await api.patch(`/admin/workers/${id}/kyc`, { status })
      if (res.data.status === 'success') { setWorkers(prev => prev.map(w => w._id === id ? res.data.data : w)); if (detail?._id === id) setDetail(res.data.data); showToast(`KYC ${status.toLowerCase()}`); window.dispatchEvent(new Event('admin-action')) }
    } catch { showToast('Failed to update KYC', 'error') }
    setConfirm(null)
  }

  const handleImpersonate = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/impersonate`)
      if (res.data.status === 'success') { setImpersonateToken(res.data.data.token); showToast('Token generated') }
    } catch { showToast('Failed to generate token', 'error') }
  }

  const copyToken = (t) => { navigator.clipboard.writeText(t); showToast('Token copied') }

  const stats = {
    total: workers.length,
    active: workers.filter(w => w.isVerified).length,
    kycPending: workers.filter(w => w.kyc?.status === 'PENDING').length,
    online: workers.filter(w => w.isOnline).length,
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Worker Management</div>
          <div className="page-subtitle">Manage all service providers — view, verify KYC, activate or deactivate</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Add Worker</button>
          <button className="btn-secondary" onClick={fetchWorkers}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Workers', value: stats.total, color: '#00B4D8' },
          { label: 'Active', value: stats.active, color: '#10B981' },
          { label: 'KYC Pending', value: stats.kycPending, color: '#F59E0B' },
          { label: 'Online Now', value: stats.online, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-box"><Search size={16} /><input placeholder="Search by name, city, phone..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter-select" value={kycFilter} onChange={e => setKycFilter(e.target.value)}>
          <option value="all">All KYC</option><option value="APPROVED">Approved</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading workers...</div>
        ) : paged.length === 0 ? (
          <EmptyState icon="🔧" title="No workers found" description={search ? 'Try a different search term' : 'No workers registered yet'} />
        ) : (
          <>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Worker</th><th>Contact</th><th>KYC</th><th>Wallet</th><th>Subscription</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {paged.map(w => (
                    <tr key={w._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {w.profileImage ? <img src={w.profileImage} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>{(w.name || '?')[0]?.toUpperCase()}</div>}
                          <div><div className="cell-primary">{w.name || 'Unknown'}</div><div className="cell-muted">{w.city || '—'} · ID: {w._id.slice(-6)}</div></div>
                        </div>
                      </td>
                      <td><div className="cell-primary">{w.phone || '—'}</div><div className="cell-muted">{w.email || 'No email'}</div></td>
                      <td><span className={`badge badge-${KYC_VARIANT[w.kyc?.status] || 'gray'}`}>{w.kyc?.status || 'PENDING'}</span></td>
                      <td><strong>₹{(w.wallet?.balance || 0).toLocaleString('en-IN')}</strong></td>
                      <td><span className="badge badge-gray">{w.subscription?.isTrial ? 'Trial' : (w.subscription?.planId || 'None')}</span></td>
                      <td><span className={`badge ${w.isVerified ? 'badge-success' : 'badge-gray'}`}>{w.isVerified ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-icon" title="View" onClick={() => { setDetail(w); setImpersonateToken(null); }}><Eye size={15} /></button>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(w)}><Edit3 size={15} /></button>
                          <button className={`btn-icon ${w.isVerified ? 'danger' : 'success'}`} title={w.isVerified ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ type: 'toggle', id: w._id, name: w.name })}>{w.isVerified ? <Ban size={15} /> : <CheckCircle size={15} />}</button>
                          <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete', id: w._id, name: w.name })}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {detail && (
        <>
          <div className="drawer-overlay" onClick={() => { setDetail(null); setImpersonateToken(null); }} />
          <div className="drawer">
            <div className="drawer-header">
              <div><div style={{ fontWeight: 800, fontSize: 16 }}>Worker Profile</div><div className="cell-muted">{detail._id}</div></div>
              <button className="modal-close" onClick={() => { setDetail(null); setImpersonateToken(null); }}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                {detail.profileImage ? <img src={detail.profileImage} alt="" className="avatar avatar-lg" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>{(detail.name || '?')[0]?.toUpperCase()}</div>}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{detail.name}</div>
                  <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{detail.phone} · {detail.city}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge badge-${KYC_VARIANT[detail.kyc?.status] || 'gray'}`}>KYC: {detail.kyc?.status}</span>
                    <span className={`badge ${detail.isVerified ? 'badge-success' : 'badge-gray'}`}>{detail.isVerified ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</div>
              <div className="detail-grid">
                <div className="detail-row"><span>Phone</span><strong>{detail.phone || '—'}</strong></div>
                <div className="detail-row"><span>Email</span><strong>{detail.email || '—'}</strong></div>
                <div className="detail-row"><span>City</span><strong>{detail.city || '—'}</strong></div>
                <div className="detail-row"><span>Wallet</span><strong>₹{(detail.wallet?.balance || 0).toLocaleString('en-IN')}</strong></div>
                <div className="detail-row"><span>Subscription</span><strong>{detail.subscription?.isTrial ? 'Trial' : (detail.subscription?.planId || 'None')}</strong></div>
                <div className="detail-row"><span>Rating</span><strong>{detail.rating?.average ? `${detail.rating.average} (${detail.rating.count} reviews)` : 'No ratings'}</strong></div>
                <div className="detail-row"><span>Online</span><strong>{detail.isOnline ? 'Yes' : 'No'}</strong></div>
                <div className="detail-row"><span>Joined</span><strong>{new Date(detail.createdAt).toLocaleDateString('en-IN')}</strong></div>
              </div>
              {detail.kyc?.documents?.length > 0 && (
                <>
                  <div className="divider" />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>KYC Documents</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {detail.kyc.documents.map((doc, idx) => (
                      <a key={idx} href={doc.url || doc} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={doc.url || doc} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                      </a>
                    ))}
                  </div>
                </>
              )}
              {detail.kyc?.status === 'PENDING' && (
                <>
                  <div className="divider" />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={() => setConfirm({ type: 'kyc_approve', id: detail._id, name: detail.name })}><Shield size={14} /> Approve KYC</button>
                    <button className="btn-danger" style={{ flex: 1 }} onClick={() => setConfirm({ type: 'kyc_reject', id: detail._id, name: detail.name })}><ShieldOff size={14} /> Reject KYC</button>
                  </div>
                </>
              )}
              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Actions</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className={detail.isVerified ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }} onClick={() => setConfirm({ type: 'toggle', id: detail._id, name: detail.name })}>{detail.isVerified ? 'Deactivate' : 'Activate'}</button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { openEdit(detail); setDetail(null); }}><Edit3 size={14} /> Edit</button>
                <button className="btn-danger" onClick={() => setConfirm({ type: 'delete', id: detail._id, name: detail.name })}><Trash2 size={14} /></button>
              </div>
              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Impersonate</div>
              {impersonateToken ? (
                <div style={{ background: 'var(--input-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 6, fontWeight: 600 }}>Token (1h):</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', userSelect: 'all', background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 8 }}>{impersonateToken}</div>
                  <button className="btn-secondary" style={{ width: '100%', height: 32, fontSize: 12 }} onClick={() => copyToken(impersonateToken)}><Copy size={12} /> Copy</button>
                </div>
              ) : <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleImpersonate(detail._id)}>Generate Token</button>}
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editWorker ? 'Edit Worker' : 'Add New Worker'} width="480px">
        <form onSubmit={saveWorker} noValidate>
          <TextInput label="Full Name *" value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} placeholder="e.g. Jane Doe" required error={formErrors.name} />
          <TextInput label="Phone Number *" value={formData.phone} onChange={e => handleFieldChange('phone', e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 9876543210" required error={formErrors.phone} inputMode="numeric" maxLength={15} />
          <FormRow>
            <TextInput label="Email" value={formData.email} onChange={e => handleFieldChange('email', e.target.value)} placeholder="e.g. jane@example.com" type="email" hint="Optional" error={formErrors.email} />
            <TextInput label="City" value={formData.city} onChange={e => handleFieldChange('city', e.target.value)} placeholder="e.g. Mumbai" hint="Optional" />
          </FormRow>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : editWorker ? 'Update Worker' : 'Create Worker'}</button>
          </div>
        </form>
      </Modal>

      {confirm?.type === 'toggle' && <ConfirmModal title={workers.find(w => w._id === confirm.id)?.isVerified ? 'Deactivate Worker' : 'Activate Worker'} message={workers.find(w => w._id === confirm.id)?.isVerified ? `Deactivate ${confirm.name}?` : `Activate ${confirm.name}?`} danger={workers.find(w => w._id === confirm.id)?.isVerified} onConfirm={() => toggleStatus(confirm.id)} onClose={() => setConfirm(null)} />}
      {confirm?.type === 'kyc_approve' && <ConfirmModal title="Approve KYC" message={`Approve KYC for ${confirm.name}?`} danger={false} confirmText="Approve KYC" onConfirm={() => updateKYC(confirm.id, 'APPROVED')} onClose={() => setConfirm(null)} />}
      {confirm?.type === 'kyc_reject' && <ConfirmModal title="Reject KYC" message={`Reject KYC for ${confirm.name}?`} onConfirm={() => updateKYC(confirm.id, 'REJECTED')} onClose={() => setConfirm(null)} />}
      {confirm?.type === 'delete' && <ConfirmModal title="Delete Worker" message={`Permanently delete ${confirm.name}?`} confirmText="Delete" onConfirm={() => deleteWorker(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>
  )
}
