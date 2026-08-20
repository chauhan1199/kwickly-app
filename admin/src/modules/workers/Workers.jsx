import React, { useState, useEffect, useRef, useCallback } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { useServerPagination } from '../../hooks/useServerPagination'
import Drawer from '../../components/common/Drawer'
import { TextInput, FormRow, validators } from '../../components/FormInput'
import MapPicker from '../../components/MapPicker'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Copy, MapPin, Upload, X, DollarSign, FileText, User, Home, CreditCard, Briefcase, AlertCircle } from 'lucide-react'
import WalletAdjuster from '../../components/common/WalletAdjuster'

const PAGE_SIZE = 15
const KYC_VARIANT = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }
const DOC_TYPES = ['AADHAR', 'PAN', 'LICENSE', 'OTHER']

const WORKER_FORM_TABS = [
  { key: 'basic', label: 'Basic Info', icon: User },
  { key: 'services', label: 'Services & Skills', icon: Briefcase },
  { key: 'address', label: 'Address & GPS', icon: Home },
  { key: 'banking', label: 'Banking & Payout', icon: CreditCard },
]

const emptyForm = {
  name: '', phone: '', email: '', city: '', bio: '', profileImage: '',
  addressLabel: 'Home', addressStreet: '', addressArea: '', addressCity: '', addressPincode: '',
  latitude: '', longitude: '',
  serviceRadius: 10,
  bankAccountNumber: '', bankIfsc: '', bankName: '', upiId: '',
  services: []
}

export default function Workers() {
  const api = useAbortableRequest()
  const [kycFilter, setKycFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const filterCallback = useCallback((w) => {
    const matchKyc = kycFilter === 'all' || w.kyc?.status === kycFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? w.isVerified : !w.isVerified)
    return matchKyc && matchStatus
  }, [kycFilter, statusFilter])
  
  const { data: workers, setData: setWorkers, loading, page, setPage, totalPages, total, search, setSearch, handleSearch, refresh } = useServerPagination('/admin/workers', PAGE_SIZE, filterCallback)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [workerFormTab, setWorkerFormTab] = useState('basic')
  const [extending, setExtending] = useState(false)
  const [customDays, setCustomDays] = useState('')

  const handleExtendSubscription = async (workerId, days) => {
    const numDays = Number(days)
    if (!numDays || numDays <= 0) return showToast('Please enter a valid number of days (e.g. 30)', 'error')
    setExtending(true)
    try {
      const res = await api.patch(`/admin/workers/${workerId}/extend-subscription`, { days: numDays })
      if (res.data.status === 'success') {
        showToast(`Validity extended by ${numDays} days!`)
        const updatedWorker = res.data.data?.worker || res.data.data
        const newSub = updatedWorker?.subscription || { expiryDate: res.data.data?.expiryDate, isTrial: false }
        if (detail && detail._id === workerId) {
          setDetail(prev => ({ ...prev, subscription: newSub }))
        }
        setWorkers(prev => prev.map(w => w._id === workerId ? { ...w, subscription: newSub } : w))
        setCustomDays('')
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to extend subscription', 'error')
    } finally {
      setExtending(false)
    }
  }

  const [showForm, setShowForm] = useState(false)
  const [editWorker, setEditWorker] = useState(null)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [formErrors, setFormErrors] = useState({})
  const [impersonateToken, setImpersonateToken] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [categories, setCategories] = useState([])
  
  const [docFile, setDocFile] = useState(null)
  const [docType, setDocType] = useState('AADHAR')
  const [docUploading, setDocUploading] = useState(false)
  const docInputRef = useRef(null)

  useEffect(() => { fetchCategories() }, [])

  

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories')
      if (res.data.status !== 'error') setCategories(Array.isArray(res.data) ? res.data : res.data.data || [])
    } catch {}
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  


  const renderValidity = (w) => {
    let daysLeft = 0;
    let isTrial = w.subscription?.isTrial !== false;
    if (w.subscription?.expiryDate && new Date(w.subscription.expiryDate) > new Date()) {
      daysLeft = Math.ceil((new Date(w.subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      isTrial = false;
    } else if (w.subscription?.trialEndDate && new Date(w.subscription.trialEndDate) > new Date()) {
      daysLeft = Math.ceil((new Date(w.subscription.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24));
    } else {
      daysLeft = 0;
    }
    
    const regDate = new Date(w.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--mid)' }}>Reg: {regDate}</div>
        {daysLeft <= 0 ? <Badge label="Expired" variant="danger" /> : <Badge label={`${daysLeft} Days (${isTrial ? 'Trial' : 'Plan'})`} variant={isTrial ? 'warning' : 'success'} />}
      </div>
    );
  };

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
    { header: 'Validity', render: (w) => renderValidity(w) },
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

  const paged = workers;

  useEffect(() => { setPage(1) }, [search, kycFilter, statusFilter])

  const validateForm = () => {
    const errors = {}

    // Name validation
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Full name is required'
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters'
    } else if (!/^[a-zA-Z\s.'-]+$/.test(formData.name.trim())) {
      errors.name = 'Name should only contain letters and spaces'
    }

    // Phone validation
    const cleanPhone = (formData.phone || '').replace(/\D/g, '')
    if (!cleanPhone) {
      errors.phone = 'Phone number is required'
    } else if (cleanPhone.length !== 10) {
      errors.phone = 'Phone number must be exactly 10 digits'
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = 'Enter a valid Indian mobile number starting with 6-9'
    }

    // Email validation (optional)
    if (formData.email && formData.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
        errors.email = 'Enter a valid email address (e.g. name@example.com)'
      }
    }

    // Service Radius validation
    if (formData.serviceRadius && (isNaN(formData.serviceRadius) || Number(formData.serviceRadius) < 1 || Number(formData.serviceRadius) > 100)) {
      errors.serviceRadius = 'Service radius must be between 1 and 100 km'
    }

    // Address Pincode validation (optional)
    if (formData.addressPincode && formData.addressPincode.trim()) {
      const cleanPin = formData.addressPincode.trim().replace(/\D/g, '')
      if (cleanPin.length !== 6) {
        errors.addressPincode = 'Enter a valid 6-digit Indian pincode'
      }
    }

    // Coordinates validation (optional)
    if (formData.latitude && (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90)) {
      errors.latitude = 'Latitude must be between -90 and 90'
    }
    if (formData.longitude && (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180)) {
      errors.longitude = 'Longitude must be between -180 and 180'
    }

    // Banking validations (optional)
    if (formData.bankAccountNumber && formData.bankAccountNumber.trim()) {
      const cleanAcc = formData.bankAccountNumber.trim().replace(/\D/g, '')
      if (cleanAcc.length < 8 || cleanAcc.length > 20) {
        errors.bankAccountNumber = 'Account number must be 8-20 digits'
      }
    }
    if (formData.bankIfsc && formData.bankIfsc.trim()) {
      const cleanIfsc = formData.bankIfsc.trim().toUpperCase()
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        errors.bankIfsc = 'Enter a valid 11-character IFSC code (e.g. SBIN0001234)'
      }
    }
    if (formData.upiId && formData.upiId.trim()) {
      if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(formData.upiId.trim())) {
        errors.upiId = 'Enter a valid UPI ID (e.g. user@oksbi or 9876543210@paytm)'
      }
    }

    // Services validation
    const filledServices = formData.services.filter(s => s.categoryId)
    const invalidService = filledServices.find(s => !s.subcategories?.length)
    if (invalidService) {
      errors.services = 'Select at least one subcategory for each chosen service'
    }
    const dupCats = filledServices.filter((s, i, arr) => arr.findIndex(x => x.categoryId === s.categoryId) !== i)
    if (dupCats.length > 0) {
      errors.services = 'Duplicate categories found — please remove duplicates'
    }

    setFormErrors(errors)

    // Auto-switch to tab containing error
    if (errors.name || errors.phone || errors.email || errors.serviceRadius) {
      setWorkerFormTab('basic')
    } else if (errors.services) {
      setWorkerFormTab('services')
    } else if (errors.addressPincode || errors.latitude || errors.longitude) {
      setWorkerFormTab('address')
    } else if (errors.bankAccountNumber || errors.bankIfsc || errors.upiId) {
      setWorkerFormTab('banking')
    }

    return Object.keys(errors).length === 0
  }

  const handleFieldChange = (field, value) => {
    let sanitized = value
    if (field === 'phone') {
      sanitized = value.replace(/\D/g, '').slice(0, 10)
    } else if (field === 'addressPincode') {
      sanitized = value.replace(/\D/g, '').slice(0, 6)
    } else if (field === 'bankAccountNumber') {
      sanitized = value.replace(/\D/g, '').slice(0, 20)
    } else if (field === 'bankIfsc') {
      sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)
    }

    setFormData(prev => ({ ...prev, [field]: sanitized }))
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
    setWorkerFormTab('basic')
    setFormData({ ...emptyForm })
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (w) => {
    setEditWorker(w)
    setWorkerFormTab('basic')
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
          
          window.dispatchEvent(new Event('admin-action'))
        }
      } else {
        const res = await api.post('/admin/users', { ...payload, role: 'WORKER' })
        if (res.data.status === 'success') {
          showToast('Worker created successfully')
          
          refresh()
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
      const res = await api.patch(`/admin/users/${id}/toggle-status`, {})
      if (res.data.status === 'success') {
        const updated = res.data.data
        setWorkers(prev => prev.map(w => w._id === id ? { ...w, isVerified: updated.isVerified } : w))
        if (detail?._id === id) setDetail(prev => ({ ...prev, isVerified: updated.isVerified }))
        const actionText = updated.isVerified ? 'activated' : 'deactivated'
        showToast(`Worker ${actionText} successfully`)
        
        window.dispatchEvent(new Event('admin-action'))
      } else {
        showToast(res.data.message || 'Failed to update status', 'error')
      }
    } catch (err) { 
      showToast(err.response?.data?.message || 'Failed to update status', 'error') 
    }
    setConfirm(null)
  }

  const deleteWorker = async (id) => {
    const workerName = detail?._id === id ? detail.name : workers.find(w => w._id === id)?.name || 'Worker'
    try {
      await api.delete(`/admin/users/${id}`)
      setWorkers(prev => prev.filter(w => w._id !== id))
      showToast('Worker deleted')
      if (detail?._id === id) setDetail(null)
      
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
          <button className="btn-secondary" onClick={refresh}><RefreshCw size={16} /> Refresh</button>
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
        <div className="search-box"><Search size={16} /><form onSubmit={handleSearch} style={{ display: 'flex', flex: 1, border: 'none', background: 'transparent', margin: 0, padding: 0 }}><input style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent' }} placeholder="Search by name, phone, or location..." value={search} onChange={e => setSearch(e.target.value)} /></form></div>
        <select className="filter-select" value={kycFilter} onChange={e => setKycFilter(e.target.value)}>
          <option value="all">All KYC</option><option value="APPROVED">Approved</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>{total} result{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading workers...</div>
        ) : paged.length === 0 ? (
          <EmptyState icon="🔧" title="No workers found" description={search ? 'Try a different search term' : 'No workers registered yet'} />
        ) : (
          <>
            <Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No workers registered yet"} />
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
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

                <div className="divider" />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Subscription & Validity</div>
                <div className="detail-grid" style={{ marginBottom: 14 }}>
                  <div className="detail-row"><span>Status</span><strong>{renderValidity(detail)}</strong></div>
                  <div className="detail-row"><span>Registration Date</span><strong>{new Date(detail.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                  <div className="detail-row"><span>Expiry Date</span><strong>{detail.subscription?.expiryDate ? new Date(detail.subscription.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (detail.subscription?.trialEndDate ? new Date(detail.subscription.trialEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No Active Plan')}</strong></div>
                </div>

                <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚡ Extend Validity / Grant Plan
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[15, 30, 90, 365].map(days => (
                      <button
                        key={days}
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }}
                        onClick={() => handleExtendSubscription(detail._id, days)}
                        disabled={extending}
                      >
                        +{days} Days
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Custom days (e.g. 60)..."
                      value={customDays}
                      onChange={e => setCustomDays(e.target.value)}
                      style={{ fontSize: 12, height: 34 }}
                      min={1}
                      disabled={extending}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: 12, height: 34, padding: '0 14px', whiteSpace: 'nowrap' }}
                      onClick={() => handleExtendSubscription(detail._id, customDays)}
                      disabled={extending || !customDays}
                    >
                      {extending ? 'Extending...' : 'Apply'}
                    </button>
                  </div>
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
                      <div style={{ marginTop: 14 }}>
                        <WalletAdjuster targetId={detail._id} entityType="WORKER" currentBalance={detail.wallet?.balance} onSuccess={refresh} />
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
                            <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }} onClick={() => setConfirm({ type: 'remove_kyc_doc', docIndex: idx, name: doc.type || 'document' })} title="Remove"><X size={12} /></button>
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

      {/* Add/Edit Modal (Tabbed) */}
      <Modal open={showForm} onClose={() => !saving && setShowForm(false)} title={editWorker ? 'Edit Worker' : 'Add New Worker'} width="580px">
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0, overflowX: 'auto' }}>
          {WORKER_FORM_TABS.map(tab => {
            const Icon = tab.icon
            const hasTabError = (tab.key === 'basic' && (formErrors.name || formErrors.phone || formErrors.email || formErrors.serviceRadius)) ||
              (tab.key === 'services' && formErrors.services) ||
              (tab.key === 'address' && (formErrors.addressPincode || formErrors.latitude || formErrors.longitude)) ||
              (tab.key === 'banking' && (formErrors.bankAccountNumber || formErrors.bankIfsc || formErrors.upiId))

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setWorkerFormTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: workerFormTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                  background: 'transparent',
                  color: workerFormTab === tab.key ? 'var(--primary)' : 'var(--mid)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  position: 'relative'
                }}
              >
                <Icon size={14} />
                {tab.label}
                {hasTabError && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                )}
              </button>
            )
          })}
        </div>

        <form onSubmit={saveWorker} noValidate>
          <div style={{ minHeight: 320 }}>
            {workerFormTab === 'basic' && (
              <>
                {/* Profile Image */}
                <div style={{ marginBottom: 16 }}>
                  <label className="input-label">Profile Image (Optional)</label>
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

                <TextInput
                  label="Full Name *"
                  value={formData.name}
                  onChange={e => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  required
                  error={formErrors.name}
                  disabled={saving}
                  maxLength={100}
                />
                <TextInput
                  label="Phone Number *"
                  value={formData.phone}
                  onChange={e => handleFieldChange('phone', e.target.value)}
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  required
                  error={formErrors.phone}
                  inputMode="numeric"
                  maxLength={10}
                  disabled={saving}
                  hint="Must start with 6, 7, 8, or 9"
                />
                <FormRow>
                  <TextInput
                    label="Email Address"
                    value={formData.email}
                    onChange={e => handleFieldChange('email', e.target.value)}
                    placeholder="e.g. worker@example.com"
                    type="email"
                    hint="Optional"
                    error={formErrors.email}
                    disabled={saving}
                    maxLength={100}
                  />
                  <TextInput
                    label="City"
                    value={formData.city}
                    onChange={e => handleFieldChange('city', e.target.value)}
                    placeholder="e.g. Ahmedabad"
                    hint="Optional"
                    disabled={saving}
                    maxLength={50}
                  />
                </FormRow>

                <TextInput
                  label="Service Radius (km)"
                  value={formData.serviceRadius}
                  onChange={e => handleFieldChange('serviceRadius', e.target.value)}
                  placeholder="10"
                  inputMode="numeric"
                  hint="Maximum distance worker travels for jobs (1-100 km)"
                  error={formErrors.serviceRadius}
                  disabled={saving}
                  maxLength={3}
                />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label">Bio (Optional)</label>
                    <span style={{ fontSize: 11, color: 'var(--mid)' }}>{formData.bio?.length || 0}/500</span>
                  </div>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={formData.bio}
                    onChange={e => handleFieldChange('bio', e.target.value)}
                    placeholder="Short bio about worker's skills & background..."
                    style={{ resize: 'vertical', minHeight: 52, fontSize: 13 }}
                    maxLength={500}
                    disabled={saving}
                  />
                </div>
              </>
            )}

            {workerFormTab === 'services' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Assigned Services & Skills</div>
                    <div style={{ fontSize: 11, color: 'var(--mid)' }}>Add categories and choose subcategories the worker can fulfill</div>
                  </div>
                  <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={addService} disabled={saving}>
                    <Plus size={14} /> Add Service
                  </button>
                </div>

                {formErrors.services && (
                  <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 12, fontWeight: 600, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}>
                    ⚠ {formErrors.services}
                  </div>
                )}

                {formData.services.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', background: 'var(--input-bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                    <Briefcase size={28} style={{ color: 'var(--mid)', margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>No services added yet</div>
                    <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 4 }}>Click "Add Service" above to assign service categories to this worker</div>
                  </div>
                ) : (
                  formData.services.map((svc, idx) => (
                    <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 12, background: 'var(--input-bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Service #{idx + 1}</span>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }} onClick={() => removeService(idx)} disabled={saving}>
                          <X size={16} />
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <label className="input-label">Category *</label>
                        <select
                          className="form-control"
                          value={svc.categoryId}
                          onChange={e => updateServiceCategory(idx, e.target.value)}
                          style={{ fontSize: 13 }}
                          disabled={saving}
                        >
                          <option value="">Select category</option>
                          {categories.filter(c => c.active !== false).map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      {svc.categoryId && (
                        <div>
                          <label className="input-label" style={{ marginBottom: 6 }}>Subcategories / Skills</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {getCategorySubs(svc.categoryId).map(sub => {
                              const isSelected = svc.subcategories.includes(sub.name)
                              return (
                                <button
                                  key={sub.name}
                                  type="button"
                                  className={`filter-chip ${isSelected ? 'active' : ''}`}
                                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 16 }}
                                  onClick={() => toggleSubcategory(idx, sub.name)}
                                  disabled={saving}
                                >
                                  {sub.name} {isSelected && '✓'}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {workerFormTab === 'address' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label className="input-label">Address Label</label>
                    <select
                      className="form-control"
                      value={formData.addressLabel}
                      onChange={e => handleFieldChange('addressLabel', e.target.value)}
                      style={{ fontSize: 13 }}
                      disabled={saving}
                    >
                      <option value="Home">Home</option>
                      <option value="Office">Office</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <TextInput
                    label="Pincode"
                    value={formData.addressPincode}
                    onChange={e => handleFieldChange('addressPincode', e.target.value)}
                    placeholder="e.g. 380001"
                    inputMode="numeric"
                    maxLength={6}
                    hint="6-digit Indian pincode"
                    error={formErrors.addressPincode}
                    disabled={saving}
                  />
                </div>
                <TextInput
                  label="Street / Landmark"
                  value={formData.addressStreet}
                  onChange={e => handleFieldChange('addressStreet', e.target.value)}
                  placeholder="e.g. 123 Main St, Near Railway Station"
                  hint="Optional"
                  disabled={saving}
                  maxLength={200}
                />
                <TextInput
                  label="Area / Locality"
                  value={formData.addressArea}
                  onChange={e => handleFieldChange('addressArea', e.target.value)}
                  placeholder="e.g. Andheri West"
                  hint="Optional"
                  disabled={saving}
                  maxLength={100}
                />
                <TextInput
                  label="Address City"
                  value={formData.addressCity}
                  onChange={e => handleFieldChange('addressCity', e.target.value)}
                  placeholder="e.g. Mumbai"
                  hint="Optional"
                  disabled={saving}
                  maxLength={50}
                />

                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '16px 0 10px' }}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  Base Location Coordinates <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span>
                </div>
                <MapPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onChange={({ latitude, longitude }) => {
                    handleFieldChange('latitude', latitude)
                    handleFieldChange('longitude', longitude)
                  }}
                />
              </>
            )}

            {workerFormTab === 'banking' && (
              <>
                <div style={{ marginBottom: 16, padding: 10, background: 'rgba(0, 180, 216, 0.08)', borderRadius: 8, fontSize: 12, color: 'var(--primary)', border: '1px solid rgba(0, 180, 216, 0.2)' }}>
                  💡 Payout details are used for automated earnings settlements and instant wallet withdrawals.
                </div>
                <TextInput
                  label="Bank Account Number"
                  value={formData.bankAccountNumber}
                  onChange={e => handleFieldChange('bankAccountNumber', e.target.value)}
                  placeholder="e.g. 123456789012"
                  inputMode="numeric"
                  hint="8-20 numeric digits"
                  error={formErrors.bankAccountNumber}
                  maxLength={20}
                  disabled={saving}
                />
                <FormRow>
                  <TextInput
                    label="IFSC Code"
                    value={formData.bankIfsc}
                    onChange={e => handleFieldChange('bankIfsc', e.target.value)}
                    placeholder="e.g. SBIN0001234"
                    hint="11 alphanumeric uppercase"
                    error={formErrors.bankIfsc}
                    maxLength={11}
                    disabled={saving}
                  />
                  <TextInput
                    label="Bank Name"
                    value={formData.bankName}
                    onChange={e => handleFieldChange('bankName', e.target.value)}
                    placeholder="e.g. State Bank of India"
                    hint="Optional"
                    disabled={saving}
                    maxLength={100}
                  />
                </FormRow>
                <TextInput
                  label="UPI ID"
                  value={formData.upiId}
                  onChange={e => handleFieldChange('upiId', e.target.value)}
                  placeholder="e.g. worker@oksbi or 9876543210@paytm"
                  hint="Optional"
                  error={formErrors.upiId}
                  disabled={saving}
                  maxLength={100}
                />
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving || uploading}>
              {saving ? 'Saving...' : editWorker ? 'Update Worker' : 'Create Worker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modals */}
      {confirm?.type === 'toggle' && (() => {
        const target = workers.find(w => w._id === confirm.id) || (detail?._id === confirm.id ? detail : null)
        const isActive = target?.isVerified ?? true
        return (
          <ConfirmModal
            title={isActive ? 'Deactivate Worker' : 'Activate Worker'}
            message={isActive ? `Deactivate ${confirm.name}? They will not receive new jobs.` : `Activate ${confirm.name}? They will be able to receive jobs.`}
            danger={isActive}
            confirmText={isActive ? 'Deactivate' : 'Activate'}
            onConfirm={() => toggleStatus(confirm.id)}
            onClose={() => setConfirm(null)}
          />
        )
      })()}
      {confirm?.type === 'delete' && (
        <ConfirmModal
          title="Delete Worker"
          message={`Permanently delete ${confirm.name}? This action cannot be undone.`}
          confirmText="Delete Permanently"
          onConfirm={() => deleteWorker(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'remove_kyc_doc' && (
        <ConfirmModal
          title="Remove Document"
          message={`Remove KYC ${confirm.name}?`}
          confirmText="Remove"
          onConfirm={() => removeKycDocument(confirm.docIndex)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
