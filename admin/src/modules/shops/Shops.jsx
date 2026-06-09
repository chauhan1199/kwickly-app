import React, { useState, useEffect } from 'react'
import { Store, Search, CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import api from '../../services/api'

const KYC_VARIANT = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }

export default function Shops() {
  const [shops, setShops]           = useState([])
  const [search, setSearch]         = useState('')
  const [kycFilter, setKycFilter]   = useState('all')
  const [loading, setLoading]       = useState(true)
  const [selectedShop, setSelectedShop] = useState(null)
  const [shopProducts, setShopProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [detailModal, setDetailModal]   = useState(false)
  const [productModal, setProductModal] = useState(false)
  const [productFormData, setProductFormData] = useState({ name: '', price: '', category: 'General', stock: 0, unit: 'Piece' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [toast, setToast]               = useState('')

  useEffect(() => { fetchShops() }, [])

  const fetchShops = async () => {
    setLoading(true)
    try {
      const res = await api.get('/shops')
      if (res.data.status === 'success') {
        setShops(res.data.data?.shops || res.data.data || [])
      }
    } catch (e) {
      showToast('Failed to load shops')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, ok = false) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = shops.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
                        s.ownerId?.name?.toLowerCase().includes(search.toLowerCase())
    const matchKyc    = kycFilter === 'all' || s.kyc?.status === kycFilter.toUpperCase()
    return matchSearch && matchKyc
  })

  const handleKycAction = async (shopId, status) => {
    try {
      const res = await api.patch(`/shops/${shopId}/kyc`, { status })
      if (res.data.status === 'success') {
        setShops(prev => prev.map(s => s._id === shopId ? res.data.data : s))
        if (selectedShop?._id === shopId) setSelectedShop(res.data.data)
        showToast(`KYC ${status.toLowerCase()} successfully`, true)
      }
    } catch { showToast('Failed to update KYC') }
  }

  const openShopDetails = async (shop) => {
    setSelectedShop(shop)
    setShopProducts([])
    setDetailModal(true)
    setLoadingProducts(true)
    try {
      const res = await api.get(`/products?shopId=${shop._id}`)
      if (res.data.status === 'success') {
        setShopProducts(res.data.data || [])
      }
    } catch (e) {
      console.error('Failed to load products')
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleToggle = async (shopId) => {
    try {
      const res = await api.patch(`/shops/${shopId}/toggle`)
      if (res.data.status === 'success') {
        setShops(prev => prev.map(s => s._id === shopId ? res.data.data : s))
        if (selectedShop?._id === shopId) setSelectedShop(res.data.data)
        showToast('Shop status updated', true)
      }
    } catch { showToast('Failed to toggle shop') }
  }

  const handleOpenProductModal = (product = null) => {
    if (product) {
      setProductFormData({ ...product })
    } else {
      setProductFormData({ name: '', price: '', category: 'General', stock: 0, unit: 'Piece', brand: '', minQty: 1, attributes: [] })
    }
    setProductModal(true)
  }

  const handleSaveProduct = async (e) => {
    e.preventDefault()
    setSavingProduct(true)
    try {
      const fd = new FormData()
      Object.keys(productFormData).forEach(k => {
        if (k !== '_id' && k !== '__v' && k !== 'createdAt' && k !== 'updatedAt' && k !== 'shopId') {
          if (k === 'attributes') {
            fd.append(k, JSON.stringify(productFormData[k] || []))
          } else {
            fd.append(k, productFormData[k])
          }
        }
      })
      fd.append('shopId', selectedShop._id)

      if (productFormData._id) {
        await api.patch(`/products/${productFormData._id}`, fd)
      } else {
        await api.post('/products', fd)
      }
      showToast('Product saved successfully', true)
      setProductModal(false)
      openShopDetails(selectedShop) // refresh products
    } catch (err) {
      showToast('Failed to save product')
    } finally {
      setSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return
    try {
      await api.delete(`/products/${id}`)
      showToast('Product deleted', true)
      openShopDetails(selectedShop)
    } catch (err) {
      showToast('Failed to delete product')
    }
  }

  const handleAddAttribute = () => {
    setProductFormData(p => ({ ...p, attributes: [...(p.attributes || []), { name: '', value: '' }] }))
  }

  const handleUpdateAttribute = (i, field, val) => {
    setProductFormData(p => {
      const arr = [...(p.attributes || [])]
      arr[i] = { ...arr[i], [field]: val }
      return { ...p, attributes: arr }
    })
  }

  const handleRemoveAttribute = (i) => {
    setProductFormData(p => {
      const arr = [...(p.attributes || [])]
      arr.splice(i, 1)
      return { ...p, attributes: arr }
    })
  }

  const stats = {
    total:    shops.length,
    approved: shops.filter(s => s.kyc?.status === 'APPROVED').length,
    pending:  shops.filter(s => s.kyc?.status === 'PENDING').length,
    online:   shops.filter(s => s.isOnline).length,
  }

  return (
    <div className="page">
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed',bottom:24,right:24,zIndex:999,background: toast.ok ? '#064e3b' : '#7f1d1d',color:'white',padding:'12px 20px',borderRadius:12,fontWeight:600,fontSize:14,animation:'slideUp 0.3s ease',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">🏪 Shop Management</h1>
          <p className="page-subtitle">Review, verify, and manage all registered shops</p>
        </div>
        <button className="btn-secondary" onClick={fetchShops} style={{ display:'flex',alignItems:'center',gap:8 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          { label: 'Total Shops',    value: stats.total,    color: '#0e9aa7' },
          { label: 'KYC Approved',   value: stats.approved, color: '#059669' },
          { label: 'Pending Review', value: stats.pending,  color: '#d97706' },
          { label: 'Online Now',     value: stats.online,   color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim, var(--mid))', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search shops or owner..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={kycFilter} onChange={e => setKycFilter(e.target.value)}>
          <option value="all">All KYC Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading shops...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop</th><th>Owner</th><th>Location</th>
                <th>Orders</th><th>Wallet</th><th>KYC</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(shop => (
                <tr key={shop._id}>
                  <td>
                    <div className="cell-primary">{shop.name}</div>
                    <div className="cell-muted">Since {new Date(shop.createdAt).toLocaleDateString('en-IN', { month:'short', year:'numeric' })}</div>
                  </td>
                  <td>
                    <div className="cell-primary">{shop.ownerId?.name || '—'}</div>
                    <div className="cell-muted">{shop.ownerId?.phone || '—'}</div>
                  </td>
                  <td><div className="cell-muted" style={{ maxWidth:140 }}>{shop.address || '—'}</div></td>
                  <td><strong>{shop.totalOrders ?? 0}</strong></td>
                  <td><strong>₹{(shop.wallet?.balance ?? 0).toLocaleString('en-IN')}</strong></td>
                  <td><Badge label={shop.kyc?.status || 'PENDING'} variant={KYC_VARIANT[shop.kyc?.status] || 'neutral'} /></td>
                  <td><Badge label={shop.isOnline ? 'Online' : 'Offline'} variant={shop.isOnline ? 'success' : 'neutral'} /></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" title="View" onClick={() => openShopDetails(shop)}><Eye size={15} /></button>
                      {shop.kyc?.status === 'PENDING' && (
                        <>
                          <button className="btn-icon success" title="Approve KYC" onClick={() => handleKycAction(shop._id, 'APPROVED')}><CheckCircle size={15} /></button>
                          <button className="btn-icon danger" title="Reject KYC" onClick={() => handleKycAction(shop._id, 'REJECTED')}><XCircle size={15} /></button>
                        </>
                      )}
                      <button className={`btn-icon ${shop.isOnline ? 'danger' : 'success'}`} title={shop.isOnline ? 'Block' : 'Activate'} onClick={() => handleToggle(shop._id)}>
                        {shop.isOnline ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="table-empty">{loading ? 'Loading...' : 'No shops found'}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title="Shop Details" width="600px">
        {selectedShop && (
          <div className="detail-grid">
            {[
              ['Shop Name', selectedShop.name],
              ['Owner', `${selectedShop.ownerId?.name || '—'} · ${selectedShop.ownerId?.phone || '—'}`],
              ['Address', selectedShop.address || '—'],
              ['Total Orders', selectedShop.totalOrders ?? 0],
              ['Wallet Balance', `₹${(selectedShop.wallet?.balance ?? 0).toLocaleString('en-IN')}`],
            ].map(([k, v]) => (
              <div key={k} className="detail-row"><span>{k}</span><strong>{v}</strong></div>
            ))}
            <div className="detail-row">
              <span>KYC Status</span>
              <Badge label={selectedShop.kyc?.status || 'PENDING'} variant={KYC_VARIANT[selectedShop.kyc?.status] || 'neutral'} />
            </div>
            <div className="detail-row">
              <span>Visibility</span>
              <Badge label={selectedShop.isOnline ? 'Online' : 'Offline'} variant={selectedShop.isOnline ? 'success' : 'neutral'} />
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              {selectedShop.kyc?.status === 'PENDING' && (
                <>
                  <button className="btn-primary" onClick={() => handleKycAction(selectedShop._id, 'APPROVED')}>Approve KYC</button>
                  <button className="btn-danger"  onClick={() => handleKycAction(selectedShop._id, 'REJECTED')}>Reject KYC</button>
                </>
              )}
              <button className="btn-secondary" onClick={() => { handleToggle(selectedShop._id); setDetailModal(false) }}>
                {selectedShop.isOnline ? 'Block Shop' : 'Activate Shop'}
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16 }}>Shop Products Inventory</h3>
                <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleOpenProductModal()}>+ Add Product</button>
              </div>
              
              {loadingProducts ? (
                <div style={{ color: 'var(--mid)', fontSize: 13 }}>Loading products...</div>
              ) : shopProducts.length === 0 ? (
                <div style={{ color: 'var(--mid)', fontSize: 13 }}>No products found in this shop.</div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--surface)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                  {shopProducts.map(p => (
                    <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>
                          {p.category} · Stock: {p.stock}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)', marginRight: 16 }}>
                        ₹{p.price} / {p.unit}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-icon" onClick={() => handleOpenProductModal(p)} title="Edit"><Eye size={14} /></button>
                        <button className="btn-icon danger" onClick={() => handleDeleteProduct(p._id)} title="Delete"><XCircle size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      {/* Product Add/Edit Modal */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title={productFormData._id ? 'Edit Product' : 'Add Product'} width="400px">
        <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Product Name</label>
            <input required className="input" value={productFormData.name || ''} onChange={e => setProductFormData({...productFormData, name: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Brand</label>
              <input className="input" value={productFormData.brand || ''} onChange={e => setProductFormData({...productFormData, brand: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Category</label>
              <input className="input" value={productFormData.category || ''} onChange={e => setProductFormData({...productFormData, category: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Price (₹)</label>
              <input required type="number" className="input" value={productFormData.price || ''} onChange={e => setProductFormData({...productFormData, price: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Unit (e.g. Kg, Box)</label>
              <input className="input" value={productFormData.unit || ''} onChange={e => setProductFormData({...productFormData, unit: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Stock</label>
              <input required type="number" className="input" value={productFormData.stock || ''} onChange={e => setProductFormData({...productFormData, stock: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Min Qty</label>
              <input required type="number" className="input" value={productFormData.minQty || 1} onChange={e => setProductFormData({...productFormData, minQty: e.target.value})} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
            <textarea className="input" style={{ minHeight: '60px', resize: 'vertical' }} value={productFormData.description || ''} onChange={e => setProductFormData({...productFormData, description: e.target.value})} rows={2} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Dynamic Attributes</label>
              <button type="button" className="btn-primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={handleAddAttribute}>+ Add</button>
            </div>
            {(productFormData.attributes || []).map((attr, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="Name (e.g. Color)" value={attr.name} onChange={e => handleUpdateAttribute(i, 'name', e.target.value)} style={{ flex: 1 }} />
                <input className="input" placeholder="Value (e.g. Red)" value={attr.value} onChange={e => handleUpdateAttribute(i, 'value', e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn-icon danger" onClick={() => handleRemoveAttribute(i)}><XCircle size={16} /></button>
              </div>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={savingProduct} style={{ marginTop: 12 }}>
            {savingProduct ? 'Saving...' : 'Save Product'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
