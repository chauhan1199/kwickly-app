import React, { useState, useEffect, useRef, useCallback } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { useServerPagination } from '../../hooks/useServerPagination'
import Drawer from '../../components/common/Drawer'
import WalletAdjuster from '../../components/common/WalletAdjuster'
import { TextInput, validators } from '../../components/FormInput'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import useAdminRefresh from '../../hooks/useAdminRefresh'
import MapPicker from '../../components/MapPicker'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Copy, MapPin, Upload, DollarSign, Briefcase, ShoppingBag, User, Home, CreditCard, AlertCircle } from 'lucide-react'

const PAGE_SIZE = 15

const CUSTOMER_FORM_TABS = [
  { key: 'basic', label: 'Basic Info', icon: User },
  { key: 'address', label: 'Address', icon: Home },
  { key: 'banking', label: 'Banking', icon: CreditCard },
  { key: 'location', label: 'Location', icon: MapPin },
]

const emptyForm = {
  name: '', phone: '', email: '', city: '', bio: '', profileImage: '',
  addressLabel: 'Home', addressStreet: '', addressArea: '', addressCity: '', addressPincode: '',
  latitude: '', longitude: '',
  upiId: '', bankName: '', accountNumber: '', ifscCode: ''
}

export default function Users() {
  const api = useAbortableRequest()
  const [filter, setFilter] = useState('all')
  const filterCallback = useCallback((c) => {
    if (filter === 'all') return true
    const status = c.isVerified ? 'active' : 'inactive'
    return filter === status
  }, [filter])

  const { data: customers, setData: setCustomers, loading, page, setPage, totalPages, total, search, setSearch, handleSearch, refresh, meta } = useServerPagination('/admin/customers', PAGE_SIZE, filterCallback)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [customerFormTab, setCustomerFormTab] = useState('basic')
  const [editUser, setEditUser] = useState(null)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [formErrors, setFormErrors] = useState({})
  const [impersonateToken, setImpersonateToken] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [detailTab, setDetailTab] = useState('details')
  const [customerJobs, setCustomerJobs] = useState([])
  const [customerOrders, setCustomerOrders] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const columns = [
    {
      header: 'Customer', render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {c.profileImage ? <img src={c.profileImage} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{(c.name || '?')[0]?.toUpperCase()}</div>}
          <div><div className="cell-primary">{c.name || 'Unknown'}</div><div className="cell-muted">ID: {c._id.slice(-6)}</div></div>
        </div>
      )
    },
    { header: 'Contact', render: (c) => <><div className="cell-primary">{c.phone || '—'}</div><div className="cell-muted">{c.email || 'No email'}</div></> },
    { header: 'Location', render: (c) => <div className="cell-muted">{c.city || '—'}</div> },
    { header: 'Joined', render: (c) => <div className="cell-muted">{new Date(c.createdAt).toLocaleDateString('en-IN')}</div> },
    { header: 'Status', render: (c) => <Badge label={c.isVerified ? 'Active' : 'Inactive'} variant={c.isVerified ? 'success' : 'neutral'} /> },
    {
      header: 'Actions', render: (c) => (
        <div className="action-btns" onClick={(e) => e.stopPropagation()}>
          <button className="btn-icon" title="View" onClick={() => { openDetail(c); }}><Eye size={15} /></button>
          <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><Edit3 size={15} /></button>
          <button className={`btn-icon ${c.isVerified ? 'danger' : 'success'}`} title={c.isVerified ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ type: 'toggle', id: c._id, name: c.name })}>{c.isVerified ? <Ban size={15} /> : <CheckCircle size={15} />}</button>
          <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete', id: c._id, name: c.name })}><Trash2 size={15} /></button>
        </div>
      )
    }
  ];

  const paged = customers;

  useEffect(() => { setPage(1) }, [search, filter])
  useAdminRefresh(refresh)

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

    // Pincode validation (optional)
    if (formData.addressPincode && formData.addressPincode.trim()) {
      const cleanPin = formData.addressPincode.trim().replace(/\D/g, '')
      if (cleanPin.length !== 6) {
        errors.addressPincode = 'Enter a valid 6-digit Indian pincode'
      }
    }

    // UPI ID validation (optional)
    if (formData.upiId && formData.upiId.trim()) {
      if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(formData.upiId.trim())) {
        errors.upiId = 'Enter a valid UPI ID (e.g. user@oksbi or 9876543210@paytm)'
      }
    }

    // Account Number validation (optional)
    if (formData.accountNumber && formData.accountNumber.trim()) {
      const cleanAcc = formData.accountNumber.trim().replace(/\D/g, '')
      if (cleanAcc.length < 9 || cleanAcc.length > 18) {
        errors.accountNumber = 'Account number must be 9 to 18 digits'
      }
    }

    // IFSC Code validation (optional)
    if (formData.ifscCode && formData.ifscCode.trim()) {
      const cleanIfsc = formData.ifscCode.trim().toUpperCase()
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        errors.ifscCode = 'Enter a valid 11-character IFSC code (e.g. HDFC0001234)'
      }
    }

    // Coordinates validation (optional)
    if (formData.latitude && (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90)) {
      errors.latitude = 'Latitude must be between -90 and 90'
    }
    if (formData.longitude && (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180)) {
      errors.longitude = 'Longitude must be between -180 and 180'
    }

    setFormErrors(errors)

    // Automatically navigate to the tab containing the error
    if (errors.name || errors.phone || errors.email) {
      setCustomerFormTab('basic')
    } else if (errors.addressPincode) {
      setCustomerFormTab('address')
    } else if (errors.upiId || errors.accountNumber || errors.ifscCode) {
      setCustomerFormTab('banking')
    } else if (errors.latitude || errors.longitude) {
      setCustomerFormTab('location')
    }

    return Object.keys(errors).length === 0
  }

  const openAdd = () => {
    setEditUser(null)
    setCustomerFormTab('basic')
    setFormData({ ...emptyForm })
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setCustomerFormTab('basic')
    const addr = user.addresses?.find(a => a.isPrimary) || user.addresses?.[0] || {}
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      city: user.city || '',
      bio: user.bio || '',
      profileImage: user.profileImage || '',
      addressLabel: addr.label || 'Home',
      addressStreet: addr.street || '',
      addressArea: addr.area || '',
      addressCity: addr.city || user.city || '',
      addressPincode: addr.pincode || '',
      latitude: user.activeLocation?.coordinates?.[1] || '',
      longitude: user.activeLocation?.coordinates?.[0] || '',
      upiId: user.wallet?.upiId || '',
      bankName: user.wallet?.bankDetails?.bankName || '',
      accountNumber: user.wallet?.bankDetails?.accountNumber || '',
      ifscCode: user.wallet?.bankDetails?.ifscCode || ''
    })
    setFormErrors({})
    setShowForm(true)
  }

  const handleFieldChange = (field, value) => {
    let sanitized = value
    if (field === 'phone') {
      sanitized = value.replace(/\D/g, '').slice(0, 10)
    } else if (field === 'addressPincode') {
      sanitized = value.replace(/\D/g, '').slice(0, 6)
    } else if (field === 'accountNumber') {
      sanitized = value.replace(/\D/g, '').slice(0, 18)
    } else if (field === 'ifscCode') {
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

  const saveUser = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    const payload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      city: formData.city || undefined,
      bio: formData.bio || undefined,
      profileImage: formData.profileImage || undefined,
      address: (formData.addressStreet || formData.addressCity || formData.addressPincode) ? {
        label: formData.addressLabel || 'Home',
        street: formData.addressStreet,
        area: formData.addressArea,
        city: formData.addressCity || formData.city,
        pincode: formData.addressPincode
      } : undefined,
      location: (formData.latitude && formData.longitude) ? {
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      } : undefined,
      wallet: (formData.upiId || formData.bankName || formData.accountNumber || formData.ifscCode) ? {
        upiId: formData.upiId || undefined,
        bankDetails: (formData.bankName || formData.accountNumber || formData.ifscCode) ? {
          bankName: formData.bankName || undefined,
          accountNumber: formData.accountNumber || undefined,
          ifscCode: formData.ifscCode || undefined
        } : undefined
      } : undefined
    }

    try {
      if (editUser) {
        const res = await api.patch(`/admin/users/${editUser._id}`, payload)
        if (res.data.status === 'success') {
          const updated = res.data.data
          setCustomers(prev => prev.map(c => c._id === editUser._id ? updated : c))
          if (detail?._id === editUser._id) setDetail(updated)
          showToast('Customer updated successfully')

          window.dispatchEvent(new Event('admin-action'))
        }
      } else {
        const res = await api.post('/admin/users', { ...payload, role: 'CUSTOMER' })
        if (res.data.status === 'success') {
          showToast('Customer created successfully')

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
    } finally { setSaving(false) }
  }

  const toggleStatus = async (id) => {
    try {
      const res = await api.patch(`/admin/users/${id}/toggle-status`, {})
      if (res.data.status === 'success') {
        const updated = res.data.data
        setCustomers(prev => prev.map(c => c._id === id ? { ...c, isVerified: updated.isVerified } : c))
        if (detail?._id === id) setDetail(prev => ({ ...prev, isVerified: updated.isVerified }))
        const actionText = updated.isVerified ? 'activated' : 'deactivated'
        showToast(`Customer ${actionText} successfully`)

        window.dispatchEvent(new Event('admin-action'))
      } else {
        showToast(res.data.message || 'Failed to update status', 'error')
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error')
    }
    setConfirm(null)
  }

  const deleteCustomer = async (id) => {
    const custName = detail?._id === id ? detail.name : customers.find(c => c._id === id)?.name || 'Customer'
    try {
      const res = await api.delete(`/admin/users/${id}`)
      if (res.data.status === 'success') {
        setCustomers(prev => prev.filter(c => c._id !== id))
        showToast('Customer deleted')
        if (detail?._id === id) setDetail(null)

        window.dispatchEvent(new Event('admin-action'))
      }
    } catch { showToast('Failed to delete customer', 'error') }
    setConfirm(null)
  }

  const openDetail = (user) => { setDetail(user); setImpersonateToken(null); setDetailTab('details'); setCustomerJobs([]); setCustomerOrders([]); }

  const fetchCustomerJobs = async (customerId) => {
    setLoadingJobs(true)
    try {
      const res = await api.get(`/admin/customers/${customerId}/jobs`)
      if (res.data.status === 'success') setCustomerJobs(res.data.data?.jobs || res.data.data || [])
    } catch { setCustomerJobs([]) }
    finally { setLoadingJobs(false) }
  }

  const fetchCustomerOrders = async (customerId) => {
    setLoadingOrders(true)
    try {
      const res = await api.get(`/admin/customers/${customerId}/orders`)
      if (res.data.status === 'success') setCustomerOrders(res.data.data?.orders || res.data.data || [])
    } catch { setCustomerOrders([]) }
    finally { setLoadingOrders(false) }
  }

  const handleDetailTabChange = (tab) => {
    setDetailTab(tab)
    if (tab === 'jobs' && detail && customerJobs.length === 0) fetchCustomerJobs(detail._id)
    if (tab === 'orders' && detail && customerOrders.length === 0) fetchCustomerOrders(detail._id)
  }



  const handleImpersonate = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/impersonate`)
      if (res.data.status === 'success') { setImpersonateToken(res.data.data.token); showToast('Token generated') }
    } catch { showToast('Failed to generate token', 'error') }
  }

  const copyToken = (t) => { navigator.clipboard.writeText(t); showToast('Token copied') }

  // Platform-wide counts from the server; page-slice fallback only while stats load
  const stats = {
    total,
    active: meta?.stats?.active ?? customers.filter(c => c.isVerified).length,
    inactive: meta?.stats?.inactive ?? customers.filter(c => !c.isVerified).length,
  }

  const getPrimaryAddress = (user) => user.addresses?.find(a => a.isPrimary) || user.addresses?.[0] || null

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Customer Management</div>
          <div className="page-subtitle">Manage all registered customers — view, edit, activate or deactivate</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Add Customer</button>
          <button className="btn-secondary" onClick={refresh}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: total, color: '#00B4D8' },
          { label: 'Active', value: stats.active, color: '#10B981' },
          { label: 'Inactive', value: stats.inactive, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <form onSubmit={handleSearch} style={{ display: 'flex', flex: 1, border: 'none', background: 'transparent', margin: 0, padding: 0 }}><input style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent' }} placeholder="Search by name, phone, or email..." value={search} onChange={e => setSearch(e.target.value)} /></form>
        </div>
        <div className="filter-tabs">
          {[
            { value: 'all', label: 'All', count: stats.total },
            { value: 'active', label: 'Active', count: stats.active },
            { value: 'inactive', label: 'Inactive', count: stats.inactive },
          ].map(f => (
            <button key={f.value} className={`filter-tab ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>
              {f.label}
              {f.count > 0 && f.value !== 'all' && <span className="tab-badge">{f.count}</span>}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {total} result{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="table-loading"><span>Loading customers...</span></div>
        ) : paged.length === 0 ? (
          <EmptyState icon="👤" title="No customers found" description={search ? 'Try a different search term' : 'No customers registered yet'} />
        ) : (
          <>
            <Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No customers registered yet"} />
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {detail && (() => {
        const addr = getPrimaryAddress(detail)
        return (
          <>
            <Drawer open={!!detail} onClose={() => { setDetail(null); setImpersonateToken(null); }} title="Customer Profile" subtitle={detail?._id} width={540}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                {detail.profileImage ? (
                  <img src={detail.profileImage} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg, var(--primary), var(--purple))' }}>
                    {(detail.name || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{detail.name || 'Unknown'}</div>
                  <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{detail.phone}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <span className={`badge ${detail.isVerified ? 'badge-success' : 'badge-gray'}`}>{detail.isVerified ? 'Active' : 'Inactive'}</span>
                    {detail.isOnline && <span className="badge badge-purple">Online</span>}
                  </div>
                </div>
              </div>

              <div className="divider" />

              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--input-bg)', borderRadius: 8, padding: 4 }}>
                {[
                  { key: 'details', label: 'Details', icon: Eye },
                  { key: 'jobs', label: 'Jobs', icon: Briefcase },
                  { key: 'orders', label: 'Orders', icon: ShoppingBag },
                ].map(tab => (
                  <button key={tab.key} className={`btn-secondary`} style={{ flex: 1, fontSize: 12, padding: '8px 0', background: detailTab === tab.key ? 'var(--primary)' : 'transparent', color: detailTab === tab.key ? '#fff' : 'var(--mid)', border: 'none', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={() => handleDetailTabChange(tab.key)}>
                    <tab.icon size={13} /> {tab.label}
                  </button>
                ))}
              </div>

              {/* Details Tab */}
              {detailTab === 'details' && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</div>
                  <div className="detail-grid">
                    <div className="detail-row"><span>Phone</span><strong>{detail.phone || '—'}</strong></div>
                    <div className="detail-row"><span>Email</span><strong>{detail.email || '—'}</strong></div>
                    <div className="detail-row"><span>City</span><strong>{detail.city || addr?.city || '—'}</strong></div>
                    <div className="detail-row"><span>Bio</span><strong>{detail.bio || '—'}</strong></div>
                    <div className="detail-row"><span>Joined</span><strong>{new Date(detail.createdAt).toLocaleDateString('en-IN')}</strong></div>
                    <div className="detail-row"><span>Status</span><strong>{detail.isVerified ? 'Active' : 'Inactive'}</strong></div>
                    <div className="detail-row"><span>Online</span><strong>{detail.isOnline ? 'Yes' : 'No'}</strong></div>
                    <div className="detail-row"><span>Wallet Balance</span><strong>₹{(detail.wallet?.balance || 0).toLocaleString('en-IN')}</strong></div>
                    <div className="detail-row"><span>Rating from workers</span><strong>{detail.customerRating?.count ? `${Number(detail.customerRating.average || 0).toFixed(1)}★ (${detail.customerRating.count} rating${detail.customerRating.count !== 1 ? 's' : ''})` : 'No ratings yet'}</strong></div>
                    <div className="detail-row"><span>KYC Status</span><strong>{detail.kyc?.status || 'PENDING'}</strong></div>
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

                  {(detail.wallet?.upiId || detail.wallet?.bankDetails?.accountNumber) && (
                    <>
                      <div className="divider" />
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Banking & Payout Info</div>
                      <div className="detail-grid">
                        <div className="detail-row"><span>UPI ID</span><strong>{detail.wallet?.upiId || '—'}</strong></div>
                        <div className="detail-row"><span>Bank Name</span><strong>{detail.wallet?.bankDetails?.bankName || '—'}</strong></div>
                        <div className="detail-row"><span>Account No</span><strong>{detail.wallet?.bankDetails?.accountNumber || '—'}</strong></div>
                        <div className="detail-row"><span>IFSC Code</span><strong>{detail.wallet?.bankDetails?.ifscCode || '—'}</strong></div>
                      </div>
                    </>
                  )}

                  {detail.activeLocation?.coordinates?.[0] !== 0 && detail.activeLocation?.coordinates?.[1] !== 0 && (
                    <>
                      <div className="divider" />
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Location</div>
                      <div className="detail-grid">
                        <div className="detail-row"><span>Latitude</span><strong>{detail.activeLocation?.coordinates?.[1] || '—'}</strong></div>
                        <div className="detail-row"><span>Longitude</span><strong>{detail.activeLocation?.coordinates?.[0] || '—'}</strong></div>
                      </div>
                    </>
                  )}

                  {/* Wallet Management */}
                  <div className="divider" />
                  <WalletAdjuster targetId={detail._id} entityType="CUSTOMER" currentBalance={detail.wallet?.balance} onSuccess={refresh} />

                  <div className="divider" />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Actions</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className={detail.isVerified ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }} onClick={() => setConfirm({ type: 'toggle', id: detail._id, name: detail.name })}>
                      {detail.isVerified ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { openEdit(detail); setDetail(null); }}><Edit3 size={14} /> Edit</button>
                    <button className="btn-danger" onClick={() => setConfirm({ type: 'delete', id: detail._id, name: detail.name })}><Trash2 size={14} /></button>
                  </div>
                  <div className="divider" />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Impersonate</div>
                  {impersonateToken ? (
                    <div style={{ background: 'var(--input-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 6, fontWeight: 600 }}>Temporary Login Token (1h):</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', userSelect: 'all', background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 8 }}>{impersonateToken}</div>
                      <button className="btn-secondary" style={{ width: '100%', height: 32, fontSize: 12 }} onClick={() => copyToken(impersonateToken)}><Copy size={12} /> Copy Token</button>
                    </div>
                  ) : (
                    <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleImpersonate(detail._id)}>Generate Login Token</button>
                  )}
                </>
              )}

              {/* Jobs Tab */}
              {detailTab === 'jobs' && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    <Briefcase size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Customer Jobs
                  </div>
                  {loadingJobs ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--mid)' }}>Loading jobs...</div>
                  ) : customerJobs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--mid)' }}>No jobs found for this customer</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customerJobs.map(job => (
                        <div key={job._id} style={{ padding: 12, background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{job.title || job.category || 'Job'}{job.subcategory ? ` · ${job.subcategory}` : ''}</div>
                            <span className={`badge badge-${['COMPLETED', 'PAID', 'CLOSED'].includes(job.status) ? 'success' : job.status === 'CANCELLED' ? 'danger' : job.status === 'IN_PROGRESS' ? 'primary' : 'gray'}`}>{job.status || 'UNKNOWN'}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mid)' }}>
                            {job.category && <span>Category: {job.category}</span>}
                            {job.payment?.amount != null && <span> · ₹{job.payment.amount}</span>}
                            {job.rating?.score && <span> · Gave worker {job.rating.score}★</span>}
                            {job.customerRating?.score && <span> · Rated {job.customerRating.score}★ by worker</span>}
                            {job.createdAt && <span> · {new Date(job.createdAt).toLocaleDateString('en-IN')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Orders Tab */}
              {detailTab === 'orders' && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    <ShoppingBag size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Customer Orders
                  </div>
                  {loadingOrders ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--mid)' }}>Loading orders...</div>
                  ) : customerOrders.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--mid)' }}>No orders found for this customer</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customerOrders.map(order => (
                        <div key={order._id} style={{ padding: 12, background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Order #{order.orderNumber || order._id?.slice(-6) || '—'}{order.shopId?.name ? ` · ${order.shopId.name}` : ''}</div>
                            <span className={`badge badge-${order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : order.status === 'IN_PROGRESS' ? 'primary' : 'gray'}`}>{order.status || 'UNKNOWN'}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mid)' }}>
                            {order.total != null && <span>Total: ₹{order.total}</span>}
                            {order.items?.length != null && <span> · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>}
                            {order.createdAt && <span> · {new Date(order.createdAt).toLocaleDateString('en-IN')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Drawer>
          </>
        )
      })()}

      {/* Add/Edit Form Modal (Tabbed) */}
      <Modal open={showForm} onClose={() => !saving && setShowForm(false)} title={editUser ? 'Edit Customer' : 'Add New Customer'} width="560px">
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0, overflowX: 'auto' }}>
          {CUSTOMER_FORM_TABS.map(tab => {
            const Icon = tab.icon
            const hasTabError = (tab.key === 'basic' && (formErrors.name || formErrors.phone || formErrors.email)) ||
              (tab.key === 'address' && formErrors.addressPincode) ||
              (tab.key === 'banking' && (formErrors.upiId || formErrors.accountNumber || formErrors.ifscCode)) ||
              (tab.key === 'location' && (formErrors.latitude || formErrors.longitude))

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCustomerFormTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: customerFormTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                  background: 'transparent',
                  color: customerFormTab === tab.key ? 'var(--primary)' : 'var(--mid)',
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

        <form onSubmit={saveUser} noValidate>
          <div style={{ minHeight: 300 }}>
            {customerFormTab === 'basic' && (
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
                  placeholder="e.g. Shyam Chauhan"
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
                  hint="10-digit Indian mobile number starting with 6-9"
                />
                <TextInput
                  label="Email Address"
                  value={formData.email}
                  onChange={e => handleFieldChange('email', e.target.value)}
                  placeholder="e.g. customer@example.com"
                  type="email"
                  hint="Optional — for notifications & receipts"
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
                    placeholder="Short bio about the customer..."
                    style={{ resize: 'vertical', minHeight: 52, fontSize: 13 }}
                    maxLength={500}
                    disabled={saving}
                  />
                </div>
              </>
            )}

            {customerFormTab === 'address' && (
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
                      <option value="Work">Work</option>
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
                  placeholder="e.g. 123, Dwarkesh Heavens, Opp. Bus Stand"
                  hint="Optional"
                  disabled={saving}
                  maxLength={200}
                />
                <TextInput
                  label="Area / Locality"
                  value={formData.addressArea}
                  onChange={e => handleFieldChange('addressArea', e.target.value)}
                  placeholder="e.g. Chandkheda"
                  hint="Optional"
                  disabled={saving}
                  maxLength={100}
                />
                <TextInput
                  label="Address City"
                  value={formData.addressCity}
                  onChange={e => handleFieldChange('addressCity', e.target.value)}
                  placeholder="e.g. Ahmedabad"
                  hint="Optional"
                  disabled={saving}
                  maxLength={50}
                />
              </>
            )}

            {customerFormTab === 'banking' && (
              <>
                <div style={{ marginBottom: 16, padding: 10, background: 'rgba(0, 180, 216, 0.08)', borderRadius: 8, fontSize: 12, color: 'var(--primary)', border: '1px solid rgba(0, 180, 216, 0.2)' }}>
                  💡 Banking & UPI details are optional and used for customer refunds, wallet payouts, or cashbacks.
                </div>
                <TextInput
                  label="UPI ID"
                  value={formData.upiId}
                  onChange={e => handleFieldChange('upiId', e.target.value)}
                  placeholder="e.g. user@oksbi or 9876543210@paytm"
                  hint="Optional"
                  error={formErrors.upiId}
                  disabled={saving}
                  maxLength={100}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <TextInput
                    label="Bank Name"
                    value={formData.bankName}
                    onChange={e => handleFieldChange('bankName', e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    hint="Optional"
                    disabled={saving}
                    maxLength={100}
                  />
                  <TextInput
                    label="Account Number"
                    value={formData.accountNumber}
                    onChange={e => handleFieldChange('accountNumber', e.target.value)}
                    placeholder="e.g. 50100234567"
                    hint="9-18 digits"
                    inputMode="numeric"
                    maxLength={18}
                    error={formErrors.accountNumber}
                    disabled={saving}
                  />
                </div>
                <TextInput
                  label="IFSC Code"
                  value={formData.ifscCode}
                  onChange={e => handleFieldChange('ifscCode', e.target.value)}
                  placeholder="e.g. HDFC0001234"
                  hint="11 alphanumeric characters"
                  maxLength={11}
                  error={formErrors.ifscCode}
                  disabled={saving}
                />
              </>
            )}

            {customerFormTab === 'location' && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  GPS Delivery Coordinates <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span>
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
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving || uploading}>
              {saving ? 'Saving...' : editUser ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modals */}
      {confirm?.type === 'toggle' && (() => {
        const target = customers.find(c => c._id === confirm.id) || (detail?._id === confirm.id ? detail : null)
        const isActive = target?.isVerified ?? true
        return (
          <ConfirmModal
            title={isActive ? 'Deactivate Customer' : 'Activate Customer'}
            message={isActive ? `Deactivate ${confirm.name}? They will not be able to use the platform.` : `Activate ${confirm.name}? They will regain access to the platform.`}
            danger={isActive}
            confirmText={isActive ? 'Deactivate' : 'Activate'}
            onConfirm={() => toggleStatus(confirm.id)}
            onClose={() => setConfirm(null)}
          />
        )
      })()}
      {confirm?.type === 'delete' && (
        <ConfirmModal title="Delete Customer" message={`Permanently delete ${confirm.name}? This action cannot be undone.`}
          confirmText="Delete Permanently" onConfirm={() => deleteCustomer(confirm.id)} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
