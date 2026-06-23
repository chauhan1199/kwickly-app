import React, { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, FormRow, validators } from '../../components/FormInput'
import MapPicker from '../../components/MapPicker'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Copy, MapPin, Upload, X, DollarSign, FileText } from 'lucide-react'

const PAGE_SIZE = 15
const KYC_VARIANT = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }
const DOC_TYPES = ['AADHAR', 'PAN', 'LICENSE', 'OTHER']

const emptyForm = {
  name: '', phone: '', email: '', city: '', bio: '', profileImage: '',
  addressLabel: 'Home', addressStreet: '', addressArea: '', addressCity: '', addressPincode: '',
  latitude: '', longitude: '',
  serviceRadius: 10,
  bankAccountNumber: '', bankIfsc: '', bankName: '', upiId: '',
  services: []
}

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
  const [formData, setFormData] = useState({ ...emptyForm })
  const [formErrors, setFormErrors] = useState({})
  const [impersonateToken, setImpersonateToken] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [walletAmount, setWalletAmount] = useState('')
  const [walletDesc, setWalletDesc] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)
  const [docFile, setDocFile] = useState(null)
  const [docType, setDocType] = useState('AADHAR')
  const [docUploading, setDocUploading] = useState(false)
  const docInputRef = useRef(null)

  useEffect(() => { fetchWorkers(); fetchCategories() }, [])

  const fetchWorkers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/workers?limit=0')
      if (res.data.status === 'success') setWorkers(res.data.data.workers || [])
    } catch { showToast('Failed to load workers', 'error') }
    finally { setLoading(false) }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories')
      if (res.data.status !== 'error') setCategories(Array.isArray(res.data) ? res.data : res.data.data || [])
    } catch {}
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = workers.filter(w => {
    const matchSearch = w.name?.toLowerCase().includes(search.toLowerCase()) || w.city?.toLowerCase().includes(search.toLowerCase()) || w.phone?.includes(search)
    const matchKyc = kycFilter === 'all' || w.kyc?.status === kycFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? w.isVerified : !w.isVerified)
    return matchSearch && matchKyc && matchStatus
  })


  const columns = [
    { header: 'Worker', render: (w) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {w.profileImage ? <img src={w.profileImage} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>{(w.name || '?')[0]?.toUpperCase()}</div>}
        <div><div className="cell-primary">{w.name || 'Unknown'}</div><div className="cell-muted">{w.city || '—'} · ID: {w._id.slice(-6)}</div></div>
      </div>
    )},
    { header: 'Contact', render: (w) => <><div className="cell-primary">{w.phone || '—'}</div><div className="cell-muted">{w.email || 'No email'}</div></> },
    { header: 'KYC', render: (w) => <Badge label={w.kyc?.status || 'PENDING'} variant={KYC_VARIANT[w.kyc?.status] ? KYC_VARIANT[w.kyc?.status].toLowerCase() : 'neutral'} /> },
    { header: 'Services', render: (w) => <div style={{ fontSize: 12 }}>{renderServices(w.services)}</div> },
    { header: 'Wallet', render: (w) => <strong>₹{(w.wallet?.balance || 0).toLocaleString('en-IN')}</strong> },
    { header: 'Status', render: (w) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Badge label={w.isVerified ? 'Active' : 'Inactive'} variant={w.isVerified ? 'success' : 'neutral'} />
        {w.isOnline && <Badge label="Online" variant="purple" />}
      </div>
    )},
    { header: 'Actions', render: (w) => (
      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="View" onClick={() => { setDetail(w); setImpersonateToken(null); }}><Eye size={15} /></button>
        <button className="btn-icon" title="Edit" onClick={() => openEdit(w)}><Edit3 size={15} /></button>
        <button className={`btn-icon ${w.isVerified ? 'danger' : 'success'}`} title={w.isVerified ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ type: 'toggle', id: w._id, name: w.name })}>{w.isVerified ? <Ban size={15} /> : <CheckCircle size={15} />}</button>
        <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete', id: w._id, name: w.name })}><Trash2 size={15} /></button>
      </div>
    )}
  ];

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, kycFilter, statusFilter])

  const validateForm = () => {
    const errors = {}
    errors.name = validators.name(formData.name)
    errors.phone = validators.phone(formData.phone)
    errors.email = validators.email(formData.email)
    if (formData.addressPincode && !/^\d{4,10}$/.test(formData.addressPincode)) {
      errors.addressPincode = 'Pincode must be 4-10 digits'
    }
    if (formData.serviceRadius && (isNaN(formData.serviceRadius) || Number(formData.serviceRadius) < 1 || Number(formData.serviceRadius) > 100)) {
      errors.serviceRadius = 'Service radius must be between 1 and 100 km'
    }
    if (formData.bankAccountNumber && !/^\d{8,20}$/.test(formData.bankAccountNumber)) {
      errors.bankAccountNumber = 'Account number must be 8-20 digits'
    }
    if (formData.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.bankIfsc)) {
      errors.bankIfsc = 'Enter a valid IFSC code (e.g. SBIN0001234)'
    }
    const filledServices = formData.services.filter(s => s.categoryId)
    const invalidService = filledServices.find(s => !s.subcategories?.length)
    if (invalidService) {
      errors.services = 'Select at least one subcategory for each service'
    }
    const dupCats = filledServices.filter((s, i, arr) => arr.findIndex(x => x.categoryId === s.categoryId) !== i)
    if (dupCats.length > 0) {
      errors.services = 'Duplicate categories found — remove duplicates'
    }
    setFormErrors(errors)
    return Object.values(errors).every(v => !v)
  }

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: null }))
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/admin/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data.status === 'success') {
        handleFieldChange('profileImage', res.data.data.url)
        showToast('Image uploaded')
      }
    } catch { showToast('Failed to upload image', 'error') }
    finally { setUploading(false) }
  }

  const openAdd = () => {
    setEditWorker(null)
    setFormData({ ...emptyForm })
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (w) => {
    setEditWorker(w)
    const addr = w.addresses?.find(a => a.isPrimary) || w.addresses?.[0] || {}
    const workerServices = (w.services || []).map(s => ({
      categoryId: s.category?._id || s.category || '',
      subcategories: s.subcategories || []
    }))
    setFormData({
      name: w.name || '',
      phone: w.phone || '',
      email: w.email || '',
      city: w.city || '',
      bio: w.bio || '',
      profileImage: w.profileImage || '',
      addressLabel: addr.label || 'Home',
      addressStreet: addr.street || '',
      addressArea: addr.area || '',
      addressCity: addr.city || w.city || '',
      addressPincode: addr.pincode || '',
      latitude: w.activeLocation?.coordinates?.[1] || '',
      longitude: w.activeLocation?.coordinates?.[0] || '',
      serviceRadius: w.serviceRadius || 10,
      bankAccountNumber: w.wallet?.bankDetails?.accountNumber || '',
      bankIfsc: w.wallet?.bankDetails?.ifscCode || '',
      bankName: w.wallet?.bankDetails?.bankName || '',
      upiId: w.wallet?.upiId || '',
      services: workerServices
    })
    setFormErrors({})
    setShowForm(true)
  }

  const buildPayload = () => {
    const payload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      city: formData.city || undefined,
      bio: formData.bio || undefined,
      profileImage: formData.profileImage || undefined,
      serviceRadius: Number(formData.serviceRadius) || 10
    }
    if (formData.addressStreet || formData.addressCity || formData.addressPincode) {
      payload.address = {
        label: formData.addressLabel || 'Home',
        street: formData.addressStreet,
        area: formData.addressArea,
        city: formData.addressCity || formData.city,
        pincode: formData.addressPincode
      }
    }
    if (formData.latitude && formData.longitude) {
      payload.location = {
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      }
    }
    if (formData.bankAccountNumber || formData.bankIfsc || formData.bankName || formData.upiId) {
      payload.wallet = {
        bankDetails: {
          accountNumber: formData.bankAccountNumber || '',
          ifscCode: formData.bankIfsc || '',
          bankName: formData.bankName || ''
        },
        upiId: formData.upiId || ''
      }
    }
    if (formData.services.length > 0) {
      payload.services = formData.services
        .filter(s => s.categoryId)
        .map(s => ({
          category: s.categoryId,
          subcategories: s.subcategories,
          isActive: true
        }))
    }
    return payload
  }

  const saveWorker = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (editWorker) {
        const res = await api.patch(`/admin/users/${editWorker._id}`, payload)
        if (res.data.status === 'success') {
          const updated = res.data.data
          setWorkers(prev => prev.map(w => w._id === editWorker._id ? updated : w))
          if (detail?._id === editWorker._id) setDetail(updated)
          showToast('Worker updated successfully')
          try { await api.post('/admin/notifications/broadcast', { title: 'Worker Updated', message: `Admin updated profile for "${editWorker.name}"`, targetRole: 'WORKER' }) } catch {}
          window.dispatchEvent(new Event('admin-action'))
        }
      } else {
        const res = await api.post('/admin/users', { ...payload, role: 'WORKER' })
        if (res.data.status === 'success') {
          showToast('Worker created successfully')
          try { await api.post('/admin/notifications/broadcast', { title: 'New Worker Created', message: `Admin created account for "${formData.name}"`, targetRole: 'WORKER' }) } catch {}
          fetchWorkers()
          window.dispatchEvent(new Event('admin-action'))
        }
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
      if (res.data.status === 'success') {
        const updated = res.data.data
        setWorkers(prev => prev.map(w => w._id === id ? updated : w))
        if (detail?._id === id) setDetail(updated)
        const actionText = updated.isVerified ? 'activated' : 'deactivated'
        showToast(`Worker ${actionText}`)
        try { await api.post('/admin/notifications/broadcast', { title: `Worker ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`, message: `Your account has been ${actionText} by admin`, targetRole: 'WORKER' }) } catch {}
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch { showToast('Failed to update status', 'error') }
    setConfirm(null)
  }

  const deleteWorker = async (id) => {
    const workerName = detail?._id === id ? detail.name : workers.find(w => w._id === id)?.name || 'Worker'
    try {
      await api.delete(`/admin/users/${id}`)
      setWorkers(prev => prev.filter(w => w._id !== id))
      showToast('Worker deleted')
      if (detail?._id === id) setDetail(null)
      try { await api.post('/admin/notifications/broadcast', { title: 'Worker Deleted', message: `Admin deleted worker "${workerName}". Account and all data have been removed.`, targetRole: 'WORKER' }) } catch {}
      window.dispatchEvent(new Event('admin-action'))
    } catch { showToast('Failed to delete worker', 'error') }
    setConfirm(null)
  }

  const handleImpersonate = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/impersonate`)
      if (res.data.status === 'success') { setImpersonateToken(res.data.data.token); showToast('Token generated') }
    } catch { showToast('Failed to generate token', 'error') }
  }

  const copyToken = (t) => { navigator.clipboard.writeText(t); showToast('Token copied') }

  const addService = () => {
    setFormData(prev => ({ ...prev, services: [...prev.services, { categoryId: '', subcategories: [] }] }))
  }
  const removeService = (idx) => {
    setFormData(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }))
  }
  const updateServiceCategory = (idx, categoryId) => {
    setFormData(prev => {
      const services = [...prev.services]
      services[idx] = { categoryId, subcategories: [] }
      return { ...prev, services }
    })
  }
  const toggleSubcategory = (idx, subName) => {
    setFormData(prev => {
      const services = [...prev.services]
      const subs = services[idx].subcategories.includes(subName)
        ? services[idx].subcategories.filter(s => s !== subName)
        : [...services[idx].subcategories, subName]
      services[idx] = { ...services[idx], subcategories: subs }
      return { ...prev, services }
    })
  }
  const getCategorySubs = (categoryId) => {
    const cat = categories.find(c => c._id === categoryId)
    return cat?.subcategories?.filter(s => s.active !== false) || []
  }

  const adjustWallet = async (debit) => {
    if (!walletAmount || Number(walletAmount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    setWalletLoading(true)
    try {
      await api.post('/admin/wallet/adjust', {
        userId: detail._id,
        amount: Number(walletAmount),
        type: 'ADJUSTMENT',
        debit,
        description: walletDesc || `Admin ${debit ? 'debit' : 'credit'}`
      })
      showToast(`₹${walletAmount} ${debit ? 'debited from' : 'credited to'} wallet`)
      setWalletAmount('')
      setWalletDesc('')
      const res = await api.get('/admin/workers')
      if (res.data.status === 'success') {
        const updated = res.data.data.workers.find(w => w._id === detail._id)
        if (updated) {
          setDetail(updated)
          setWorkers(prev => prev.map(w => w._id === detail._id ? updated : w))
        }
      }
      window.dispatchEvent(new Event('admin-action'))
    } catch { showToast('Failed to adjust wallet', 'error') }
    finally { setWalletLoading(false) }
  }

  const uploadKycDocument = async () => {
    if (!docFile) { showToast('Select a document file', 'error'); return }
    setDocUploading(true)
    try {
      const fd = new FormData()
      fd.append('document', docFile)
      fd.append('docType', docType)
      const res = await api.post(`/admin/workers/${detail._id}/kyc-documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data.status === 'success') {
        const updated = res.data.data
        setDetail(updated)
        setWorkers(prev => prev.map(w => w._id === detail._id ? updated : w))
        setDocFile(null)
        setDocType('AADHAR')
        showToast('Document uploaded')
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch { showToast('Failed to upload document', 'error') }
    finally { setDocUploading(false) }
  }

  const removeKycDocument = async (docIndex) => {
    try {
      const res = await api.delete(`/admin/workers/${detail._id}/kyc-documents/${docIndex}`)
      if (res.data.status === 'success') {
        const updated = res.data.data
        setDetail(updated)
        setWorkers(prev => prev.map(w => w._id === detail._id ? updated : w))
        showToast('Document removed')
      }
    } catch { showToast('Failed to remove document', 'error') }
  }

  const stats = {
    total: workers.length,
    active: workers.filter(w => w.isVerified).length,
    kycPending: workers.filter(w => w.kyc?.status === 'PENDING').length,
    online: workers.filter(w => w.isOnline).length,
  }

  const getPrimaryAddress = (w) => w.addresses?.find(a => a.isPrimary) || w.addresses?.[0] || null

  const renderServices = (services) => {
    if (!services?.length) return <span style={{ color: 'var(--mid)' }}>No services</span>
    return services.map((s, i) => {
      const catId = s.category?._id || s.category
      const catName = s.category?.name || categories.find(c => c._id === catId)?.name || 'Unknown'
      return (
        <span key={i} className="badge badge-gray" style={{ fontSize: 11, marginRight: 4, marginBottom: 4 }}>
          {catName}{s.subcategories?.length ? ` (${s.subcategories.join(', ')})` : ''}
        </span>
      )
    })
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
            <Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No workers registered yet"} />
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {detail && (() => {
        const addr = getPrimaryAddress(detail)
        return (
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
                    <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{detail.phone}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge badge-${KYC_VARIANT[detail.kyc?.status] || 'gray'}`}>KYC: {detail.kyc?.status}</span>
                      <span className={`badge ${detail.isVerified ? 'badge-success' : 'badge-gray'}`}>{detail.isVerified ? 'Active' : 'Inactive'}</span>
                      {detail.isOnline && <span className="badge badge-purple">Online</span>}
                    </div>
                  </div>
                </div>
                <div className="divider" />

                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</div>
                <div className="detail-grid">
                  <div className="detail-row"><span>Phone</span><strong>{detail.phone || '—'}</strong></div>
                  <div className="detail-row"><span>Email</span><strong>{detail.email || '—'}</strong></div>
                  <div className="detail-row"><span>City</span><strong>{detail.city || addr?.city || '—'}</strong></div>
                  <div className="detail-row"><span>Bio</span><strong>{detail.bio || '—'}</strong></div>
                  <div className="detail-row"><span>Rating</span><strong>{detail.rating?.average ? `${detail.rating.average} (${detail.rating.count} reviews)` : 'No ratings'}</strong></div>
                  <div className="detail-row"><span>Service Radius</span><strong>{detail.serviceRadius || 10} km</strong></div>
                  <div className="detail-row"><span>Joined</span><strong>{new Date(detail.createdAt).toLocaleDateString('en-IN')}</strong></div>
                </div>

                {addr && (
                  <>
                    <div className="divider" />
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Address</div>
                    <div className="detail-grid">
                      <div className="detail-row"><span>Label</span><strong>{addr.label || '—'}</strong></div>
                      <div className="detail-row"><span>Street</span><strong>{addr.street || '—'}</strong></div>
                      <div className="detail-row"><span>Area</span><strong>{addr.area || '—'}</strong></div>
                      <div className="detail-row"><span>City</span><strong>{addr.city || '—'}</strong></div>
                      <div className="detail-row"><span>Pincode</span><strong>{addr.pincode || '—'}</strong></div>
                    </div>
                  </>
                )}

                {detail.activeLocation?.coordinates?.[0] !== 0 && detail.activeLocation?.coordinates?.[1] !== 0 && (
                  <>
                    <div className="divider" />
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Location</div>
                    <div className="detail-grid">
                      <div className="detail-row"><span>Latitude</span><strong>{detail.activeLocation?.coordinates?.[1]}</strong></div>
                      <div className="detail-row"><span>Longitude</span><strong>{detail.activeLocation?.coordinates?.[0]}</strong></div>
                    </div>
                  </>
                )}

                {detail.services?.length > 0 && (
                  <>
                    <div className="divider" />
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Services</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{renderServices(detail.services)}</div>
                  </>
                )}

                {(() => {
                  const hasBank = detail.wallet?.bankDetails?.accountNumber || detail.wallet?.upiId
                  return (
                    <>
                      <div className="divider" />
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Wallet & Banking</div>
                      <div className="detail-grid">
                        <div className="detail-row"><span>Balance</span><strong>₹{(detail.wallet?.balance || 0).toLocaleString('en-IN')}</strong></div>
                        {detail.wallet?.bankDetails?.accountNumber && <div className="detail-row"><span>Account No</span><strong>{detail.wallet.bankDetails.accountNumber}</strong></div>}
                        {detail.wallet?.bankDetails?.ifscCode && <div className="detail-row"><span>IFSC</span><strong>{detail.wallet.bankDetails.ifscCode}</strong></div>}
                        {detail.wallet?.bankDetails?.bankName && <div className="detail-row"><span>Bank</span><strong>{detail.wallet.bankDetails.bankName}</strong></div>}
                        {detail.wallet?.upiId && <div className="detail-row"><span>UPI</span><strong>{detail.wallet.upiId}</strong></div>}
                        {!hasBank && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--mid)', fontStyle: 'italic' }}>No bank details added</div>}
                      </div>
                      <div style={{ marginTop: 12, padding: 12, background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={12} /> Admin Wallet Adjust</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                          <input className="form-control" type="number" min="1" placeholder="Amount (₹)" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} style={{ fontSize: 13 }} />
                          <input className="form-control" placeholder="Description" value={walletDesc} onChange={e => setWalletDesc(e.target.value)} style={{ fontSize: 13 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-primary" style={{ flex: 1, fontSize: 12 }} disabled={walletLoading || !walletAmount} onClick={() => adjustWallet(false)}>
                            {walletLoading ? '...' : 'Credit ₹'}
                          </button>
                          <button className="btn-danger" style={{ flex: 1, fontSize: 12 }} disabled={walletLoading || !walletAmount} onClick={() => adjustWallet(true)}>
                            {walletLoading ? '...' : 'Debit ₹'}
                          </button>
                        </div>
                      </div>
                    </>
                  )
                })()}

                <>
                  <div className="divider" />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    KYC Documents
                  </div>
                  {detail.kyc?.documents?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 12 }}>
                      {detail.kyc.documents.map((doc, idx) => (
                        <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <a href={doc.url || doc} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                            <img src={doc.url || doc} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                          </a>
                          <div style={{ padding: '4px 6px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mid)' }}>{doc.type || 'DOC'}</span>
                            <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }} onClick={() => removeKycDocument(idx)} title="Remove"><X size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: 12, background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} /> Upload New Document</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select className="form-control" value={docType} onChange={e => setDocType(e.target.value)} style={{ fontSize: 12, flex: '0 0 120px' }}>
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input ref={docInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files?.[0] || null)} />
                      <button className="btn-secondary" style={{ fontSize: 11, flex: 1 }} onClick={() => docInputRef.current?.click()}>
                        <Upload size={12} /> {docFile ? docFile.name : 'Choose File'}
                      </button>
                    </div>
                    <button className="btn-primary" style={{ width: '100%', fontSize: 12 }} disabled={docUploading || !docFile} onClick={uploadKycDocument}>
                      {docUploading ? 'Uploading...' : 'Upload Document'}
                    </button>
                  </div>
                </>

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
        )
      })()}

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editWorker ? 'Edit Worker' : 'Add New Worker'} width="540px">
        <form onSubmit={saveWorker} noValidate style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Profile Image */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Profile Image</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {formData.profileImage ? (
                <img src={formData.profileImage} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--mid)', border: '2px dashed var(--border)' }}>👤</div>
              )}
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Image'}
                </button>
                {formData.profileImage && (
                  <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', marginLeft: 8 }} onClick={() => handleFieldChange('profileImage', '')}>Remove</button>
                )}
              </div>
            </div>
          </div>

          <TextInput label="Full Name *" value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} placeholder="e.g. John Doe" required error={formErrors.name} />
          <TextInput label="Phone Number *" value={formData.phone} onChange={e => handleFieldChange('phone', e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 9876543210" required error={formErrors.phone} inputMode="numeric" maxLength={15} />
          <FormRow>
            <TextInput label="Email" value={formData.email} onChange={e => handleFieldChange('email', e.target.value)} placeholder="e.g. john@example.com" type="email" hint="Optional" error={formErrors.email} />
            <TextInput label="City" value={formData.city} onChange={e => handleFieldChange('city', e.target.value)} placeholder="e.g. Mumbai" hint="Optional" />
          </FormRow>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Bio</label>
            <textarea className="form-control" rows={2} value={formData.bio} onChange={e => handleFieldChange('bio', e.target.value)} placeholder="Short bio about the worker" style={{ resize: 'vertical', minHeight: 48, fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <TextInput label="Service Radius (km)" value={formData.serviceRadius} onChange={e => handleFieldChange('serviceRadius', e.target.value)} placeholder="10" inputMode="numeric" hint="How far the worker can travel" error={formErrors.serviceRadius} />
          </div>

          <div className="divider" style={{ margin: '16px 0' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Address</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Label</label>
              <select className="form-control" value={formData.addressLabel} onChange={e => handleFieldChange('addressLabel', e.target.value)} style={{ fontSize: 13 }}>
                <option value="Home">Home</option>
                <option value="Office">Office</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <TextInput label="Pincode" value={formData.addressPincode} onChange={e => handleFieldChange('addressPincode', e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 400001" inputMode="numeric" maxLength={10} hint="Optional" error={formErrors.addressPincode} />
          </div>
          <TextInput label="Street / Landmark" value={formData.addressStreet} onChange={e => handleFieldChange('addressStreet', e.target.value)} placeholder="e.g. 123 Main St" hint="Optional" />
          <TextInput label="Area / Locality" value={formData.addressArea} onChange={e => handleFieldChange('addressArea', e.target.value)} placeholder="e.g. Andheri West" hint="Optional" />
          <TextInput label="Address City" value={formData.addressCity} onChange={e => handleFieldChange('addressCity', e.target.value)} placeholder="e.g. Mumbai" hint="Optional" />

          <div className="divider" style={{ margin: '16px 0' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            <MapPin size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Map Location <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span>
          </div>
          <MapPicker
            latitude={formData.latitude}
            longitude={formData.longitude}
            onChange={({ latitude, longitude }) => {
              handleFieldChange('latitude', latitude)
              handleFieldChange('longitude', longitude)
            }}
          />

          <div className="divider" style={{ margin: '16px 0' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Services
            <button type="button" className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', textTransform: 'none', letterSpacing: 0 }} onClick={addService}><Plus size={12} /> Add Service</button>
          </div>
          {formData.services.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 12 }}>No services added. Click "Add Service" to assign categories.</div>
          )}
          {formErrors.services && (
            <div style={{ fontSize: 12, color: '#EF4444', marginTop: -8, marginBottom: 10, fontWeight: 600 }}>⚠ {formErrors.services}</div>
          )}
          {formData.services.map((svc, idx) => (
            <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--input-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)' }}>Service {idx + 1}</span>
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }} onClick={() => removeService(idx)}><X size={14} /></button>
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={svc.categoryId} onChange={e => updateServiceCategory(idx, e.target.value)} style={{ fontSize: 13 }}>
                  <option value="">Select category</option>
                  {categories.filter(c => c.active !== false).map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {svc.categoryId && (
                <div style={{ marginTop: 8 }}>
                  <label className="form-label">Subcategories</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {getCategorySubs(svc.categoryId).map(sub => (
                      <button key={sub.name} type="button" className={`filter-chip ${svc.subcategories.includes(sub.name) ? 'active' : ''}`} style={{ fontSize: 11 }} onClick={() => toggleSubcategory(idx, sub.name)}>
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="divider" style={{ margin: '16px 0' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Banking Details <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span></div>
          <TextInput label="Bank Account Number" value={formData.bankAccountNumber} onChange={e => handleFieldChange('bankAccountNumber', e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 1234567890" inputMode="numeric" hint="8-20 digits" error={formErrors.bankAccountNumber} maxLength={20} />
          <FormRow>
            <TextInput label="IFSC Code" value={formData.bankIfsc} onChange={e => handleFieldChange('bankIfsc', e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" hint="4 letters + 6 digits" error={formErrors.bankIfsc} maxLength={11} />
            <TextInput label="Bank Name" value={formData.bankName} onChange={e => handleFieldChange('bankName', e.target.value)} placeholder="e.g. SBI" hint="Optional" />
          </FormRow>
          <TextInput label="UPI ID" value={formData.upiId} onChange={e => handleFieldChange('upiId', e.target.value)} placeholder="e.g. user@upi" hint="Optional" />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving || uploading}>{saving ? 'Saving...' : editWorker ? 'Update Worker' : 'Create Worker'}</button>
          </div>
        </form>
      </Modal>

      {confirm?.type === 'toggle' && <ConfirmModal title={workers.find(w => w._id === confirm.id)?.isVerified ? 'Deactivate Worker' : 'Activate Worker'} message={workers.find(w => w._id === confirm.id)?.isVerified ? `Deactivate ${confirm.name}?` : `Activate ${confirm.name}?`} danger={workers.find(w => w._id === confirm.id)?.isVerified} onConfirm={() => toggleStatus(confirm.id)} onClose={() => setConfirm(null)} />}
      {confirm?.type === 'delete' && <ConfirmModal title="Delete Worker" message={`Permanently delete ${confirm.name}?`} confirmText="Delete" onConfirm={() => deleteWorker(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>
  )
}
