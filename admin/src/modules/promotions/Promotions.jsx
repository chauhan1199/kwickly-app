import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

const emptyBanner = { title: '', subtitle: '', imageUrl: '', linkType: 'NONE', linkValue: '', position: 'HOME_TOP', isActive: true, priority: 0 }
const emptyPromo = { code: '', title: '', description: '', type: 'FLAT_DISCOUNT', value: 0, minOrderAmount: 0, maxUsesTotal: 100, maxUsesPerUser: 1, isActive: true }

export default function Promotions() {
  const [banners, setBanners] = useState([])
  const [promos, setPromos] = useState([])
  const [tab, setTab] = useState('banners')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyBanner)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const showToast = (message, type = 'success') => setToast({ message, type })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [b, p] = await Promise.all([
        api.get('/admin/promotions/banners/all').catch(() => ({ data: { data: [] } })),
        api.get('/admin/promotions/promotions').catch(() => ({ data: { data: [] } }))
      ])
      setBanners(b.data.data || [])
      setPromos(p.data.data || [])
    } catch (e) { console.error(e); showToast('Failed to load data', 'error') }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      const endpoint = tab === 'banners'
        ? (editing ? `/admin/promotions/banners/${editing._id}` : '/admin/promotions/banners')
        : (editing ? `/admin/promotions/promotions/${editing._id}` : '/admin/promotions/promotions')
      const method = editing ? 'patch' : 'post'
      await api[method](endpoint, form)
      setShowForm(false)
      setEditing(null)
      setForm(tab === 'banners' ? emptyBanner : emptyPromo)
      loadData()
    } catch (e) { showToast('Error: ' + (e.response?.data?.message || e.message), 'error') }
  }

  const handleDelete = async (id) => {
    setConfirmModal({
      message: 'Delete this item?',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          const endpoint = tab === 'banners'
            ? `/admin/promotions/banners/${id}`
            : `/admin/promotions/promotions/${id}`
          await api.delete(endpoint)
          loadData()
        } catch (e) { showToast('Error deleting', 'error') }
      }
    })
  }

  const handleEdit = (item) => {
    setEditing(item)
    setForm({ ...item })
    setShowForm(true)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Promotions & Banners</h2>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null); setForm(tab === 'banners' ? emptyBanner : emptyPromo) }}>
          + Add {tab === 'banners' ? 'Banner' : 'Promo'}
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'banners' ? 'active' : ''}`} onClick={() => setTab('banners')}>
          Banners ({banners.length})
        </button>
        <button className={`tab ${tab === 'promos' ? 'active' : ''}`} onClick={() => setTab('promos')}>
          Promo Codes ({promos.length})
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? 'Edit' : 'Add'} {tab === 'banners' ? 'Banner' : 'Promo Code'}</h3>
            {tab === 'banners' ? (
              <div className="form-grid">
                <label>Title<input value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} /></label>
                <label>Subtitle<input value={form.subtitle || ''} onChange={e => setForm({...form, subtitle: e.target.value})} /></label>
                <label>Image URL<input value={form.imageUrl || ''} onChange={e => setForm({...form, imageUrl: e.target.value})} /></label>
                <label>Position
                  <select value={form.position || 'HOME_TOP'} onChange={e => setForm({...form, position: e.target.value})}>
                    <option value="HOME_TOP">Home Top</option>
                    <option value="HOME_MIDDLE">Home Middle</option>
                    <option value="SHOP_PAGE">Shop Page</option>
                    <option value="CATEGORY_PAGE">Category Page</option>
                  </select>
                </label>
                <label>Link Type
                  <select value={form.linkType || 'NONE'} onChange={e => setForm({...form, linkType: e.target.value})}>
                    <option value="NONE">None</option>
                    <option value="SHOP">Shop</option>
                    <option value="PRODUCT">Product</option>
                    <option value="CATEGORY">Category</option>
                    <option value="EXTERNAL">External URL</option>
                  </select>
                </label>
                <label>Link Value<input value={form.linkValue || ''} onChange={e => setForm({...form, linkValue: e.target.value})} /></label>
                <label>Priority<input type="number" value={form.priority || 0} onChange={e => setForm({...form, priority: parseInt(e.target.value)})} /></label>
                <label>Active
                  <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({...form, isActive: e.target.checked})} />
                </label>
              </div>
            ) : (
              <div className="form-grid">
                <label>Code<input value={form.code || ''} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} /></label>
                <label>Title<input value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} /></label>
                <label>Description<textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></label>
                <label>Type
                  <select value={form.type || 'FLAT_DISCOUNT'} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="FLAT_DISCOUNT">Flat Discount</option>
                    <option value="PERCENTAGE_DISCOUNT">% Discount</option>
                    <option value="FREE_DELIVERY">Free Delivery</option>
                    <option value="FIRST_ORDER">First Order</option>
                    <option value="CASHBACK">Cashback</option>
                  </select>
                </label>
                <label>Value<input type="number" value={form.value || 0} onChange={e => setForm({...form, value: parseFloat(e.target.value)})} /></label>
                <label>Min Order ₹<input type="number" value={form.minOrderAmount || 0} onChange={e => setForm({...form, minOrderAmount: parseFloat(e.target.value)})} /></label>
                <label>Max Uses Total<input type="number" value={form.maxUsesTotal || 100} onChange={e => setForm({...form, maxUsesTotal: parseInt(e.target.value)})} /></label>
                <label>Max Uses/User<input type="number" value={form.maxUsesPerUser || 1} onChange={e => setForm({...form, maxUsesPerUser: parseInt(e.target.value)})} /></label>
                <label>Active
                  <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({...form, isActive: e.target.checked})} />
                </label>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        {loading ? <div className="loading">Loading...</div> : (
          tab === 'banners' ? (
            <table>
              <thead>
                <tr><th>Title</th><th>Position</th><th>Status</th><th>Priority</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {banners.map(b => (
                  <tr key={b._id}>
                    <td><strong>{b.title}</strong>{b.subtitle && <small>{b.subtitle}</small>}</td>
                    <td><span className="badge badge-info">{b.position}</span></td>
                    <td><span className={`badge ${b.isActive ? 'badge-success' : 'badge-muted'}`}>{b.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>{b.priority}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => handleEdit(b)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && <tr><td colSpan={5} className="empty-state">No banners yet</td></tr>}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr><th>Code</th><th>Title</th><th>Type</th><th>Value</th><th>Uses</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p._id}>
                    <td><code>{p.code}</code></td>
                    <td>{p.title}</td>
                    <td><span className="badge badge-info">{p.type}</span></td>
                    <td>{p.type === 'PERCENTAGE_DISCOUNT' ? `${p.value}%` : `₹${p.value}`}</td>
                    <td>{p.usesCount || 0}/{p.maxUsesTotal || '∞'}</td>
                    <td><span className={`badge ${p.isActive ? 'badge-success' : 'badge-muted'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn btn-sm" onClick={() => handleEdit(p)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {promos.length === 0 && <tr><td colSpan={7} className="empty-state">No promo codes yet</td></tr>}
              </tbody>
            </table>
          )
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmModal && <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />}
    </div>
  )
}
