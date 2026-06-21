import React, { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, validators } from '../../components/FormInput'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import MapPicker from '../../components/MapPicker'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Copy, MapPin, Upload, DollarSign, Briefcase, ShoppingBag } from 'lucide-react'

const PAGE_SIZE = 15

const emptyForm = {
  name: '', phone: '', email: '', city: '', bio: '', profileImage: '',
  addressLabel: 'Home', addressStreet: '', addressArea: '', addressCity: '', addressPincode: '',
  latitude: '', longitude: ''
}

export default function Users() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [formErrors, setFormErrors] = useState({})
  const [impersonateToken, setImpersonateToken] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [walletAmount, setWalletAmount] = useState('')
  const [walletDesc, setWalletDesc] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)

  const [detailTab, setDetailTab] = useState('details')
  const [customerJobs, setCustomerJobs] = useState([])
  const [customerOrders, setCustomerOrders] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => { fetchCustomers() }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/customers')
      if (res.data.status === 'success') setCustomers(res.data.data.customers || [])
    } catch { showToast('Failed to load customers', 'error') }
    finally { setLoading(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = customers.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
    const status = c.isVerified ? 'active' : 'inactive'
    const matchFilter = filter === 'all' || status === filter
    return matchSearch && matchFilter
  })








  const columns = [
    { header: 'Customer', render: (c) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {c.profileImage ? <img src={c.profileImage} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{(c.name || '?')[0]?.toUpperCase()}</div>}
        <div><div className="cell-primary">{c.name || 'Unknown'}</div><div className="cell-muted">ID: {c._id.slice(-6)}</div></div>
      </div>
    )},
    { header: 'Contact', render: (c) => <><div className="cell-primary">{c.phone || '—'}</div><div className="cell-muted">{c.email || 'No email'}</div></> },
    { header: 'Location', render: (c) => <div className="cell-muted">{c.city || '—'}</div> },
    { header: 'Joined', render: (c) => <div className="cell-muted">{new Date(c.createdAt).toLocaleDateString('en-IN')}</div> },
    { header: 'Status', render: (c) => <Badge label={c.isVerified ? 'Active' : 'Inactive'} variant={c.isVerified ? 'success' : 'neutral'} /> },
    { header: 'Actions', render: (c) => (
      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="View" onClick={() => { openDetail(c); }}><Eye size={15} /></button>
        <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><Edit3 size={15} /></button>
        <button className={`btn-icon ${c.isVerified ? 'danger' : 'success'}`} title={c.isVerified ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ type: 'toggle', id: c._id, name: c.name })}>{c.isVerified ? <Ban size={15} /> : <CheckCircle size={15} />}</button>
        <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete', id: c._id, name: c.name })}><Trash2 size={15} /></button>
      </div>
    )}
  ];

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filter])

  const validateForm = () => {
    const errors = {}
    errors.name = validators.name(formData.name)
    errors.phone = validators.phone(formData.phone)
    errors.email = validators.email(formData.email)
    if (formData.addressPincode && !/^\d{4,10}$/.test(formData.addressPincode)) {
      errors.addressPincode = 'Pincode must be 4-10 digits'
    }
    if (formData.latitude && (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90)) {
      errors.latitude = 'Latitude must be between -90 and 90'
    }
    if (formData.longitude && (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180)) {
      errors.longitude = 'Longitude must be between -180 and 180'
    }
    setFormErrors(errors)
    return !errors.name && !errors.phone && !errors.email && !errors.addressPincode && !errors.latitude && !errors.longitude
  }

  const openAdd = () => {
    setEditUser(null)
    setFormData({ ...emptyForm })
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
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
      longitude: user.activeLocation?.coordinates?.[0] || ''
    })
    setFormErrors({})
    setShowForm(true)
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
          try { await api.post('/admin/notifications/broadcast', { title: 'Customer Updated', message: `Admin updated profile for "${formData.name}"`, targetRole: 'CUSTOMER' }) } catch {}
          window.dispatchEvent(new Event('admin-action'))
        }
      } else {
        const res = await api.post('/admin/users', { ...payload, role: 'CUSTOMER' })
        if (res.data.status === 'success') {
          showToast('Customer created successfully')
          try { await api.post('/admin/notifications/broadcast', { title: 'New Customer Created', message: `Admin created account for "${formData.name}"`, targetRole: 'CUSTOMER' }) } catch {}
          fetchCustomers()
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
      const res = await api.patch(`/admin/users/${id}/toggle-status`)
      if (res.data.status === 'success') {
        const updated = res.data.data
        setCustomers(prev => prev.map(c => c._id === id ? updated : c))
        if (detail?._id === id) setDetail(updated)
        const actionText = updated.isVerified ? 'activated' : 'deactivated'
        showToast(`Customer ${actionText}`)
        try { await api.post('/admin/notifications/broadcast', { title: `Customer ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`, message: `Your account has been ${actionText} by admin`, targetRole: 'CUSTOMER' }) } catch {}
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch { showToast('Failed to update status', 'error') }
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
        try { await api.post('/admin/notifications/broadcast', { title: 'Customer Deleted', message: `Admin deleted customer "${custName}". Account and all data have been removed.`, targetRole: 'CUSTOMER' }) } catch {}
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch { showToast('Failed to delete customer', 'error') }
    setConfirm(null)
  }

  const openDetail = (user) => { setDetail(user); setImpersonateToken(null); setDetailTab('details'); setCustomerJobs([]); setCustomerOrders([]); setWalletAmount(''); setWalletDesc('') }

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
      try { await api.post('/admin/notifications/broadcast', { title: `Wallet ${debit ? 'Debited' : 'Credited'}`, message: `₹${walletAmount} ${debit ? 'debited from' : 'credited to' } "${detail.name}" wallet${walletDesc ? '. ' + walletDesc : ''}`, targetRole: 'CUSTOMER' }) } catch {}
      setWalletAmount('')
      setWalletDesc('')
      const res = await api.get('/admin/customers')
      if (res.data.status === 'success') {
        const updated = res.data.data.customers.find(c => c._id === detail._id)
        if (updated) {
          setDetail(updated)
          setCustomers(prev => prev.map(c => c._id === detail._id ? updated : c))
        }
      }
      window.dispatchEvent(new Event('admin-action'))
    } catch { showToast('Failed to adjust wallet', 'error') }
    finally { setWalletLoading(false) }
  }

  const handleImpersonate = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/impersonate`)
      if (res.data.status === 'success') { setImpersonateToken(res.data.data.token); showToast('Token generated') }
    } catch { showToast('Failed to generate token', 'error') }
  }

  const copyToken = (t) => { navigator.clipboard.writeText(t); showToast('Token copied') }

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.isVerified).length,
    inactive: customers.filter(c => !c.isVerified).length,
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
          <button className="btn-secondary" onClick={fetchCustomers}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: stats.total, color: '#00B4D8' },
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
          <input placeholder="Search by name, phone, or email..." value={search} onChange={e => setSearch(e.target.value)} />
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
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
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
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {detail && (() => {
        const addr = getPrimaryAddress(detail)
        return (
          <>
            <div className="drawer-overlay" onClick={() => { setDetail(null); setImpersonateToken(null); }} />
            <div className="drawer" style={{ width: 540 }}>
              <div className="drawer-header">
                <div><div style={{ fontWeight: 800, fontSize: 16 }}>Customer Profile</div><div className="cell-muted">{detail._id}</div></div>
                <button className="modal-close" onClick={() => { setDetail(null); setImpersonateToken(null); }}>✕</button>
              </div>
              <div className="drawer-body">
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
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                      <DollarSign size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      Wallet Management
                    </div>
                    <div style={{ padding: 12, background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
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
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{job.title || job.category?.name || 'Job'}</div>
                              <span className={`badge badge-${job.status === 'COMPLETED' ? 'success' : job.status === 'CANCELLED' ? 'danger' : job.status === 'IN_PROGRESS' ? 'primary' : 'gray'}`}>{job.status || 'UNKNOWN'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mid)' }}>
                              {job.category?.name && <span>Category: {job.category.name}</span>}
                              {job.payment?.amount != null && <span> · ₹{job.payment.amount}</span>}
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
                              <div style={{ fontSize: 13, fontWeight: 700 }}>Order #{order._id?.slice(-6) || '—'}</div>
                              <span className={`badge badge-${order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : order.status === 'IN_PROGRESS' ? 'primary' : 'gray'}`}>{order.status || 'UNKNOWN'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mid)' }}>
                              {order.totalAmount != null && <span>Total: ₹{order.totalAmount}</span>}
                              {order.items?.length != null && <span> · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>}
                              {order.createdAt && <span> · {new Date(order.createdAt).toLocaleDateString('en-IN')}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Add/Edit Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editUser ? 'Edit Customer' : 'Add New Customer'} width="540px">
        <form onSubmit={saveUser} noValidate>
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
          <TextInput label="Email" value={formData.email} onChange={e => handleFieldChange('email', e.target.value)} placeholder="e.g. john@example.com" type="email" hint="Optional" error={formErrors.email} />
          <TextInput label="City" value={formData.city} onChange={e => handleFieldChange('city', e.target.value)} placeholder="e.g. Mumbai" hint="Optional" />

          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Bio</label>
            <textarea className="form-control" rows={2} value={formData.bio} onChange={e => handleFieldChange('bio', e.target.value)} placeholder="Short bio about the customer" style={{ resize: 'vertical', minHeight: 48, fontSize: 13 }} />
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
          <TextInput label="Street / Landmark" value={formData.addressStreet} onChange={e => handleFieldChange('addressStreet', e.target.value)} placeholder="e.g. 123 Main St, near Park" hint="Optional" />
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

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving || uploading}>
              {saving ? 'Saving...' : editUser ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modals */}
      {confirm?.type === 'toggle' && (
        <ConfirmModal title={customers.find(c => c._id === confirm.id)?.isVerified ? 'Deactivate Customer' : 'Activate Customer'}
          message={customers.find(c => c._id === confirm.id)?.isVerified ? `Deactivate ${confirm.name}? They will not be able to use the platform.` : `Activate ${confirm.name}? They will regain access to the platform.`}
          danger={customers.find(c => c._id === confirm.id)?.isVerified}
          confirmText={customers.find(c => c._id === confirm.id)?.isVerified ? 'Deactivate' : 'Activate'}
          onConfirm={() => toggleStatus(confirm.id)} onClose={() => setConfirm(null)} />
      )}
      {confirm?.type === 'delete' && (
        <ConfirmModal title="Delete Customer" message={`Permanently delete ${confirm.name}? This action cannot be undone.`}
          confirmText="Delete Permanently" onConfirm={() => deleteCustomer(confirm.id)} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
