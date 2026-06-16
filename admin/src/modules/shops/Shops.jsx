import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { TextInput, SelectInput, TextArea, FormRow, validators } from '../../components/FormInput'
import { Search, Plus, RefreshCw, Eye, Edit3, Trash2, Ban, CheckCircle, Package, Store, Copy } from 'lucide-react'

const PAGE_SIZE = 15
const KYC_VARIANT = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }

export default function Shops() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kycFilter, setKycFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [shopProducts, setShopProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Shop form
  const [showShopForm, setShowShopForm] = useState(false)
  const [editShop, setEditShop] = useState(null)
  const [shopForm, setShopForm] = useState({ name: '', category: 'General', description: '', address: '' })
  const [shopFormErrors, setShopFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Product form
  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', price: '', category: 'General', stock: 0, unit: 'Piece', brand: '', description: '' })
  const [productFormErrors, setProductFormErrors] = useState({})
  const [savingProduct, setSavingProduct] = useState(false)

  const [impersonateToken, setImpersonateToken] = useState(null)

  useEffect(() => { fetchShops() }, [])

  const fetchShops = async () => {
    setLoading(true)
    try {
      const res = await api.get('/shops')
      if (res.data.status === 'success') {
        setShops(res.data.data?.shops || res.data.data || [])
      }
    } catch {
      showToast('Failed to load shops', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = shops.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.ownerId?.name?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase())
    const matchKyc = kycFilter === 'all' || s.kyc?.status === kycFilter.toUpperCase()
    return matchSearch && matchKyc
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, kycFilter])

  // ── Shop CRUD ──
  const openAddShop = () => { setEditShop(null); setShopForm({ name: '', category: 'General', description: '', address: '' }); setShopFormErrors({}); setShowShopForm(true) }
  const openEditShop = (shop) => { setEditShop(shop); setShopForm({ name: shop.name || '', category: shop.category || 'General', description: shop.description || '', address: shop.address || '' }); setShopFormErrors({}); setShowShopForm(true) }

  const handleShopFieldChange = (field, value) => {
    setShopForm(prev => ({ ...prev, [field]: value }))
    if (shopFormErrors[field]) setShopFormErrors(prev => ({ ...prev, [field]: null }))
  }

  const saveShop = async (e) => {
    e.preventDefault()
    const errors = { name: validators.shopName(shopForm.name) }
    setShopFormErrors(errors)
    if (errors.name) return

    setSaving(true)
    try {
      if (editShop) {
        const res = await api.patch(`/shops/${editShop._id}`, shopForm)
        if (res.data.status === 'success') {
          setShops(prev => prev.map(s => s._id === editShop._id ? { ...s, ...shopForm } : s))
        }
        showToast('Shop updated successfully')
        window.dispatchEvent(new Event('admin-action'))
      } else {
        await api.post('/shops', shopForm)
        showToast('Shop created successfully')
        fetchShops()
        window.dispatchEvent(new Event('admin-action'))
      }
      setShowShopForm(false)
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteShop = async (id) => {
    try {
      const res = await api.delete(`/shops/${id}`)
      if (res.data.status === 'success') {
        setShops(prev => prev.filter(s => s._id !== id))
        showToast('Shop deleted')
        if (detail?._id === id) setDetail(null)
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch {
      showToast('Failed to delete shop', 'error')
    }
    setConfirm(null)
  }

  const handleToggle = async (id) => {
    try {
      const res = await api.patch(`/admin/shops/${id}/toggle`)
      if (res.data.status === 'success') {
        setShops(prev => prev.map(s => s._id === id ? res.data.data : s))
        if (detail?._id === id) setDetail(res.data.data)
        showToast('Shop status updated')
        window.dispatchEvent(new Event('admin-action'))
      }
    } catch {
      showToast('Failed to toggle shop', 'error')
    }
    setConfirm(null)
  }

  const handleKycAction = async (id, status) => {
    try {
      const res = await api.patch(`/admin/shops/${id}/kyc`, { status })
      if (res.data.status === 'success') {
        setShops(prev => prev.map(s => s._id === id ? res.data.data : s))
        if (detail?._id === id) setDetail(res.data.data)
        showToast(`KYC ${status.toLowerCase()}`)
      }
    } catch {
      showToast('Failed to update KYC', 'error')
    }
    setConfirm(null)
  }

  const handleImpersonate = async (ownerId) => {
    if (!ownerId) { showToast('No owner linked', 'error'); return }
    try {
      const res = await api.post(`/admin/users/${ownerId}/impersonate`)
      if (res.data.status === 'success') {
        setImpersonateToken(res.data.data.token)
        showToast('Token generated')
      }
    } catch {
      showToast('Failed to generate token', 'error')
    }
  }

  const copyToken = (token) => {
    navigator.clipboard.writeText(token)
    showToast('Token copied to clipboard')
  }

  // ── Detail / Products ──
  const openDetail = async (shop) => {
    setDetail(shop)
    setShopProducts([])
    setImpersonateToken(null)
    setLoadingProducts(true)
    try {
      const res = await api.get(`/products?shopId=${shop._id}`)
      if (res.data.status === 'success') setShopProducts(res.data.data || [])
    } catch { /* silent */ } finally {
      setLoadingProducts(false)
    }
  }

  // ── Product CRUD ──
  const openAddProduct = () => { setEditProduct(null); setProductForm({ name: '', price: '', category: 'General', stock: 0, unit: 'Piece', brand: '', description: '' }); setProductFormErrors({}); setShowProductForm(true) }
  const openEditProduct = (p) => { setEditProduct(p); setProductForm({ name: p.name || '', price: p.price || '', category: p.category || 'General', stock: p.stock || 0, unit: p.unit || 'Piece', brand: p.brand || '', description: p.description || '' }); setProductFormErrors({}); setShowProductForm(true) }

  const handleProductFieldChange = (field, value) => {
    setProductForm(prev => ({ ...prev, [field]: value }))
    if (productFormErrors[field]) setProductFormErrors(prev => ({ ...prev, [field]: null }))
  }

  const saveProduct = async (e) => {
    e.preventDefault()
    const errors = { name: validators.required(productForm.name, 'Product name'), price: validators.price(productForm.price) }
    setProductFormErrors(errors)
    if (errors.name || errors.price) return

    setSavingProduct(true)
    try {
      const fd = new FormData()
      Object.entries(productForm).forEach(([k, v]) => fd.append(k, v))
      fd.append('shopId', detail._id)
      if (editProduct) {
        await api.patch(`/products/${editProduct._id}`, fd)
      } else {
        await api.post('/products', fd)
      }
      showToast('Product saved')
      setShowProductForm(false)
      openDetail(detail)
    } catch {
      showToast('Failed to save product', 'error')
    } finally {
      setSavingProduct(false)
    }
  }

  const deleteProduct = async (id) => {
    try {
      await api.delete(`/products/${id}`)
      showToast('Product deleted')
      openDetail(detail)
    } catch {
      showToast('Failed to delete product', 'error')
    }
    setConfirm(null)
  }

  const stats = {
    total: shops.length,
    approved: shops.filter(s => s.kyc?.status === 'APPROVED').length,
    pending: shops.filter(s => s.kyc?.status === 'PENDING').length,
    online: shops.filter(s => s.isOnline).length,
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Shop Management</div>
          <div className="page-subtitle">Manage all registered shops — view, verify KYC, manage products and visibility</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={openAddShop}><Plus size={16} /> Add Shop</button>
          <button className="btn-secondary" onClick={fetchShops}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Shops', value: stats.total, color: '#2EF7F0' },
          { label: 'KYC Approved', value: stats.approved, color: '#10B981' },
          { label: 'Pending Review', value: stats.pending, color: '#F59E0B' },
          { label: 'Online Now', value: stats.online, color: '#8B5CF6' },
        ].map(s => (
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
          <input placeholder="Search shops, owner, category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {[
            { value: 'all', label: 'All' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'REJECTED', label: 'Rejected' },
          ].map(f => (
            <button
              key={f.value}
              className={`filter-tab ${kycFilter === f.value ? 'active' : ''}`}
              onClick={() => setKycFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading"><span>Loading shops...</span></div>
        ) : paged.length === 0 ? (
          <EmptyState icon="🏪" title="No shops found" description={search ? 'Try a different search term' : 'No shops registered yet'} action={<button className="btn-primary" onClick={openAddShop}><Plus size={16} /> Add First Shop</button>} />
        ) : (
          <>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Location</th>
                    <th>Orders</th>
                    <th>Wallet</th>
                    <th>KYC</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(shop => (
                    <tr key={shop._id}>
                      <td>
                        <div className="cell-primary">{shop.name}</div>
                        <div className="cell-muted">Since {new Date(shop.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
                      </td>
                      <td><span className="badge badge-primary">{shop.category || 'General'}</span></td>
                      <td>
                        <div className="cell-primary">{shop.ownerId?.name || '—'}</div>
                        <div className="cell-muted">{shop.ownerId?.phone || '—'}</div>
                      </td>
                      <td><div className="cell-muted" style={{ maxWidth: 140 }}>{shop.address || '—'}</div></td>
                      <td><strong>{shop.totalOrders ?? 0}</strong></td>
                      <td><strong>₹{(shop.wallet?.balance ?? 0).toLocaleString('en-IN')}</strong></td>
                      <td><span className={`badge badge-${KYC_VARIANT[shop.kyc?.status] || 'gray'}`}>{shop.kyc?.status || 'PENDING'}</span></td>
                      <td><span className={`badge ${shop.isOnline ? 'badge-success' : 'badge-gray'}`}>{shop.isOnline ? 'Online' : 'Offline'}</span></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-icon" title="View" onClick={() => openDetail(shop)}><Eye size={15} /></button>
                          <button className="btn-icon" title="Edit" onClick={() => openEditShop(shop)}><Edit3 size={15} /></button>
                          {shop.kyc?.status === 'PENDING' && (
                            <>
                              <button className="btn-icon success" title="Approve KYC" onClick={() => handleKycAction(shop._id, 'APPROVED')}><CheckCircle size={15} /></button>
                              <button className="btn-icon danger" title="Reject KYC" onClick={() => handleKycAction(shop._id, 'REJECTED')}><Ban size={15} /></button>
                            </>
                          )}
                          <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete_shop', id: shop._id, name: shop.name })}>
                            <Trash2 size={15} />
                          </button>
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
          <div className="drawer" style={{ width: 520 }}>
            <div className="drawer-header">
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Shop Details</div>
                <div className="cell-muted">{detail._id}</div>
              </div>
              <button className="modal-close" onClick={() => { setDetail(null); setImpersonateToken(null); }}>✕</button>
            </div>
            <div className="drawer-body">
              {/* Shop Info */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg, #F97316, #DC2626)', borderRadius: 12 }}>
                  <Store size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{detail.name}</div>
                  <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{detail.category || 'General'} · {detail.address || 'No address'}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <span className={`badge badge-${KYC_VARIANT[detail.kyc?.status] || 'gray'}`}>KYC: {detail.kyc?.status}</span>
                    <span className={`badge ${detail.isOnline ? 'badge-success' : 'badge-gray'}`}>{detail.isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</div>
              <div className="detail-grid">
                <div className="detail-row"><span>Owner</span><strong>{detail.ownerId?.name || '—'} · {detail.ownerId?.phone || '—'}</strong></div>
                <div className="detail-row"><span>Address</span><strong>{detail.address || '—'}</strong></div>
                <div className="detail-row"><span>Total Orders</span><strong>{detail.totalOrders ?? 0}</strong></div>
                <div className="detail-row"><span>Wallet</span><strong>₹{(detail.wallet?.balance ?? 0).toLocaleString('en-IN')}</strong></div>
                <div className="detail-row"><span>Rating</span><strong>{detail.rating || 'No ratings'}</strong></div>
                <div className="detail-row"><span>Delivery</span><strong>{detail.delivery?.radiusKm || 3}km · ₹{detail.delivery?.fee || 40} fee</strong></div>
                <div className="detail-row"><span>Hours</span><strong>{detail.businessHours?.monFri || '9 AM - 10 PM'}</strong></div>
                <div className="detail-row"><span>Subscription</span><strong>{detail.subscription?.plan || 'FREE_TRIAL'}</strong></div>
              </div>

              {/* KYC Actions */}
              {detail.kyc?.status === 'PENDING' && (
                <>
                  <div className="divider" />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleKycAction(detail._id, 'APPROVED')}>Approve KYC</button>
                    <button className="btn-danger" style={{ flex: 1 }} onClick={() => handleKycAction(detail._id, 'REJECTED')}>Reject KYC</button>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="divider" />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className={detail.isOnline ? 'btn-danger' : 'btn-primary'}
                  style={{ flex: 1 }}
                  onClick={() => setConfirm({ type: 'toggle_shop', id: detail._id, name: detail.name })}
                >
                  {detail.isOnline ? 'Block Shop' : 'Activate Shop'}
                </button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { openEditShop(detail); setDetail(null); }}>
                  <Edit3 size={14} /> Edit
                </button>
                <button className="btn-danger" onClick={() => setConfirm({ type: 'delete_shop', id: detail._id, name: detail.name })}>
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Impersonate */}
              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Impersonate Shop Owner</div>
              {impersonateToken ? (
                <div style={{ background: 'var(--bg-dark)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 6, fontWeight: 600 }}>Temporary Login Token (1h):</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', userSelect: 'all', background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                    {impersonateToken}
                  </div>
                  <button className="btn-secondary" style={{ width: '100%', height: 32, fontSize: 12 }} onClick={() => copyToken(impersonateToken)}>
                    <Copy size={12} /> Copy Token
                  </button>
                </div>
              ) : (
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleImpersonate(detail.ownerId?._id)}>
                  Generate Login Token
                </button>
              )}

              {/* Products */}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Package size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Products ({shopProducts.length})
                </div>
                <button className="btn-primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={openAddProduct}>
                  <Plus size={14} /> Add
                </button>
              </div>
              {loadingProducts ? (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 12 }}>Loading products...</div>
              ) : shopProducts.length === 0 ? (
                <div style={{ color: 'var(--mid)', fontSize: 13, padding: 12, fontStyle: 'italic' }}>No products yet</div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto', background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  {shopProducts.map(p => (
                    <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>{p.category} · Stock: {p.stock} · {p.unit}</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginRight: 14 }}>₹{p.price}</div>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEditProduct(p)} title="Edit"><Edit3 size={14} /></button>
                        <button className="btn-icon danger" onClick={() => setConfirm({ type: 'delete_product', id: p._id, name: p.name })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Shop Modal */}
      <Modal open={showShopForm} onClose={() => setShowShopForm(false)} title={editShop ? 'Edit Shop' : 'Add New Shop'} width="520px">
        <form onSubmit={saveShop}>
          <TextInput label="Shop Name *" value={shopForm.name} onChange={e => handleShopFieldChange('name', e.target.value)} placeholder="e.g. Sharma Grocery Store" required error={shopFormErrors.name} />
          <FormRow>
            <TextInput label="Category" value={shopForm.category} onChange={e => handleShopFieldChange('category', e.target.value)} placeholder="e.g. Grocery" />
            <TextInput label="Address" value={shopForm.address} onChange={e => handleShopFieldChange('address', e.target.value)} placeholder="e.g. Sector 5, Noida" />
          </FormRow>
          <TextArea label="Description" value={shopForm.description} onChange={e => handleShopFieldChange('description', e.target.value)} placeholder="Brief description of the shop..." rows={3} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowShopForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Saving...' : editShop ? 'Update Shop' : 'Create Shop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Product Modal */}
      <Modal open={showProductForm} onClose={() => setShowProductForm(false)} title={editProduct ? 'Edit Product' : 'Add Product'} width="520px">
        <form onSubmit={saveProduct}>
          <TextInput label="Product Name *" value={productForm.name} onChange={e => handleProductFieldChange('name', e.target.value)} placeholder="e.g. Basmati Rice 5kg" required error={productFormErrors.name} />
          <FormRow>
            <TextInput label="Brand" value={productForm.brand} onChange={e => handleProductFieldChange('brand', e.target.value)} placeholder="e.g. India Gate" />
            <TextInput label="Category" value={productForm.category} onChange={e => handleProductFieldChange('category', e.target.value)} placeholder="e.g. Grocery" />
          </FormRow>
          <FormRow>
            <TextInput label="Price (₹) *" value={productForm.price} onChange={e => handleProductFieldChange('price', e.target.value)} type="number" required error={productFormErrors.price} />
            <TextInput label="Unit" value={productForm.unit} onChange={e => handleProductFieldChange('unit', e.target.value)} placeholder="e.g. Kg, Box, Piece" />
          </FormRow>
          <FormRow>
            <TextInput label="Stock" value={productForm.stock} onChange={e => handleProductFieldChange('stock', e.target.value)} type="number" required />
          </FormRow>
          <TextArea label="Description" value={productForm.description} onChange={e => handleProductFieldChange('description', e.target.value)} placeholder="Product description..." rows={2} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowProductForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={savingProduct}>
              {savingProduct ? 'Saving...' : editProduct ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modals */}
      {confirm?.type === 'toggle_shop' && (
        <ConfirmModal
          title={shops.find(s => s._id === confirm.id)?.isOnline ? 'Block Shop' : 'Activate Shop'}
          message={shops.find(s => s._id === confirm.id)?.isOnline
            ? `Block ${confirm.name}? It will be hidden from customers.`
            : `Activate ${confirm.name}? It will be visible to customers.`}
          danger={shops.find(s => s._id === confirm.id)?.isOnline}
          confirmText={shops.find(s => s._id === confirm.id)?.isOnline ? 'Block Shop' : 'Activate Shop'}
          onConfirm={() => handleToggle(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'delete_shop' && (
        <ConfirmModal
          title="Delete Shop"
          message={`Permanently delete ${confirm.name}? All products and data will be lost.`}
          confirmText="Delete Permanently"
          onConfirm={() => deleteShop(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'delete_product' && (
        <ConfirmModal
          title="Delete Product"
          message={`Remove ${confirm.name} from this shop?`}
          confirmText="Delete Product"
          onConfirm={() => deleteProduct(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
