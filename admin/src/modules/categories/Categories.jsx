import React, { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

const ICON_OPTIONS = ['🔧','⚡','❄️','🧹','🪵','🖌️','🚿','🪛','🏠','🔑','☀️','📷','🌿','🛋️','🪜','🪟','🚪','🔌','💡','🪝']
const COLOR_OPTIONS = ['#2563EB','#F97316','#16A34A','#DC2626','#7C3AED','#0EA5E9','#92400E','#0F766E','#BE185D','#1D4ED8']

function CategoryModal({ cat, onSave, onClose }) {
  const [form, setForm] = useState(cat
    ? { name: cat.name, icon: cat.icon, color: cat.color, description: cat.description }
    : { name: '', icon: '🔧', color: '#2563EB', description: '' }
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Category name is required'
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    if (!form.description.trim()) e.description = 'Description is required'
    else if (form.description.trim().length < 5) e.description = 'Description must be at least 5 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({ ...form, name: form.name.trim(), description: form.description.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: 16 }}>{cat ? 'Edit Category' : 'Add New Category'}</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category Name *</label>
              <input
                className={`form-control ${errors.name ? 'input-error' : ''}`}
                placeholder="e.g. Plumbing"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
              />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
                {ICON_OPTIONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => set('icon', ic)}
                    style={{ width: 36, height: 36, border: `2px solid ${form.icon === ic ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, background: form.icon === ic ? 'var(--primary-light)' : 'var(--input-bg)', cursor: 'pointer', fontSize: 18, transition: 'all 0.1s' }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Accent Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => set('color', c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? 'var(--dark)' : 'transparent'}`, cursor: 'pointer', transition: 'border 0.1s' }} />
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              className={`form-control ${errors.description ? 'input-error' : ''}`}
              placeholder="Describe what this category covers..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
            />
            {errors.description && <div className="field-error">{errors.description}</div>}
          </div>
          <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: form.color + '20', border: `2px solid ${form.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{form.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{form.name || 'Category Name'}</div>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginTop: 2, lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{form.description || 'Description will appear here'}</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim() || !form.description.trim()}>
            {saving ? '⏳ Saving...' : cat ? '💾 Save Changes' : '+ Add Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubcategoryModal({ catName, sub, onSave, onClose }) {
  const [form, setForm] = useState(sub
    ? { name: sub.name, description: sub.description || '', minPrice: sub.minPrice || 0, platformFee: sub.platformFee || 0, suggestedMax: sub.suggestedMax || 0 }
    : { name: '', description: '', minPrice: 0, platformFee: 0, suggestedMax: 0 }
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Subcategory name is required'
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    if (form.minPrice < 0) e.minPrice = 'Price cannot be negative'
    if (form.platformFee < 0) e.platformFee = 'Fee cannot be negative'
    if (form.suggestedMax < 0) e.suggestedMax = 'Price cannot be negative'
    if (form.suggestedMax > 0 && form.minPrice > form.suggestedMax) e.suggestedMax = 'Max price must be greater than min price'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({ ...form, name: form.name.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{sub ? 'Edit Subcategory' : 'Add Subcategory'}</div>
            <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>under {catName}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Subcategory Name *</label>
            <input
              className={`form-control ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Pipe Leak Repair"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
            {errors.name && <div className="field-error">{errors.name}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" placeholder="What specific service does this cover?" value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Min Price (₹)</label>
              <input className={`form-control ${errors.minPrice ? 'input-error' : ''}`} type="number" min="0" placeholder="0" value={form.minPrice || ''} onChange={e => set('minPrice', Number(e.target.value))} />
              {errors.minPrice && <div className="field-error">{errors.minPrice}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Platform Fee (₹)</label>
              <input className={`form-control ${errors.platformFee ? 'input-error' : ''}`} type="number" min="0" placeholder="0" value={form.platformFee || ''} onChange={e => set('platformFee', Number(e.target.value))} />
              {errors.platformFee && <div className="field-error">{errors.platformFee}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Suggested Max (₹)</label>
              <input className={`form-control ${errors.suggestedMax ? 'input-error' : ''}`} type="number" min="0" placeholder="0" value={form.suggestedMax || ''} onChange={e => set('suggestedMax', Number(e.target.value))} />
              {errors.suggestedMax && <div className="field-error">{errors.suggestedMax}</div>}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? '⏳ Saving...' : sub ? '💾 Save Changes' : '+ Add Subcategory'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RejectModal({ suggestion, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    const fullReason = notes.trim() ? `${reason} - ${notes.trim()}` : reason
    setSaving(true)
    try {
      await onConfirm(fullReason)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: 16 }}>Reject Suggestion</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16, fontFamily: 'var(--font-body)' }}>
            Rejection reason will be sent to <strong>{typeof suggestion.workerId === 'object' ? suggestion.workerId?.name : (suggestion.workerName || 'Worker')}</strong> via push notification.
          </p>
          <div className="form-group">
            <label className="form-label">Reason *</label>
            <select className="form-control" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="">Select reason...</option>
              <option>Category already exists under a different name</option>
              <option>Requires special licensing or certification</option>
              <option>Out of scope for current platform</option>
              <option>Insufficient demand in target cities</option>
              <option>Will be considered in a future update</option>
              <option>Other (see notes)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Additional Notes</label>
            <textarea className="form-control" placeholder="Optional detailed explanation..." rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={!reason || saving}>
            {saving ? '⏳ Rejecting...' : '✕ Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApproveModal({ suggestion, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: 16 }}>Approve Suggestion</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16, fontFamily: 'var(--font-body)' }}>
            Approval message will be sent to <strong>{typeof suggestion.workerId === 'object' ? suggestion.workerId?.name : (suggestion.workerName || 'Worker')}</strong> via push notification.
          </p>
          <div className="form-group">
            <label className="form-label">Approval Message / Reason *</label>
            <textarea className="form-control" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Great idea! We've added this to the platform." rows={3} autoFocus />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-success" onClick={handleConfirm} disabled={!reason.trim() || saving}>
            {saving ? '⏳ Approving...' : '✓ Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('categories')
  const [expandedCat, setExpandedCat] = useState(null)
  const [catModal, setCatModal] = useState(null)
  const [subModal, setSubModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [approveModal, setApproveModal] = useState(null)
  const [syncToast, setSyncToast] = useState(false)
  const [sugFilter, setSugFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const [toggling, setToggling] = useState({})
  const [confirmModal, setConfirmModal] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchSuggestions()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/categories')
      if (response.data.status === 'success') {
        setCategories(response.data.data)
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to load categories'
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuggestions = async () => {
    try {
      const response = await api.get('/admin/suggestions')
      if (response.data.status === 'success') {
        setSuggestions(response.data.data)
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to load suggestions'
      showToast(msg, 'error')
    }
  }

  const pendingCount = suggestions.filter(s => s.status === 'pending').length

  const showSync = () => {
    setSyncToast(true)
    setTimeout(() => setSyncToast(false), 3000)
  }

  const saveCat = async (form) => {
    try {
      if (catModal === 'new') {
        await api.post('/admin/categories', form)
        showToast('Category created successfully')
      } else {
        await api.patch(`/admin/categories/${catModal._id}`, form)
        showToast('Category updated successfully')
      }
      fetchCategories()
      setCatModal(null)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save category'
      const details = e.response?.data?.errors
      showToast(details ? details.join(', ') : msg, 'error')
    }
  }

  const toggleCat = async (id) => {
    const cat = categories.find(c => c._id === id)
    const newState = !cat.active
    setToggling(p => ({ ...p, [`cat_${id}`]: true }))
    try {
      await api.patch(`/admin/categories/${id}`, { active: newState })
      setCategories(prev => prev.map(c => c._id === id ? { ...c, active: newState } : c))
      showToast(`Category ${newState ? 'activated' : 'deactivated'}`)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to toggle category'
      showToast(msg, 'error')
    } finally {
      setToggling(p => ({ ...p, [`cat_${id}`]: false }))
    }
  }

  const deleteCat = async (id) => {
    const cat = categories.find(c => c._id === id)
    setConfirmModal({
      title: 'Delete Category',
      message: `Delete "${cat?.name}" and all its ${cat?.subcategories.length || 0} subcategories? This action cannot be undone.`,
      danger: true,
      confirmText: 'Delete Category',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/categories/${id}`)
          setCategories(prev => prev.filter(c => c._id !== id))
          if (expandedCat === id) setExpandedCat(null)
          showToast('Category deleted successfully')
          showSync()
          window.dispatchEvent(new Event('admin-action'))
        } catch (e) {
          const msg = e.response?.data?.message || 'Failed to delete category'
          showToast(msg, 'error')
        }
      }
    })
  }

  const saveSub = async (form) => {
    const { catId, sub } = subModal
    try {
      if (sub) {
        const cat = categories.find(c => c._id === catId)
        const newSubs = cat.subcategories.map(s => s._id === sub._id ? { ...s, ...form } : s)
        await api.patch(`/admin/categories/${catId}`, { subcategories: newSubs })
        showToast('Subcategory updated successfully')
      } else {
        await api.post(`/admin/categories/${catId}/subcategories`, form)
        showToast('Subcategory added successfully')
      }
      fetchCategories()
      setSubModal(null)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save subcategory'
      const details = e.response?.data?.errors
      showToast(details ? details.join(', ') : msg, 'error')
    }
  }

  const toggleSub = async (catId, subId) => {
    setToggling(p => ({ ...p, [`sub_${catId}_${subId}`]: true }))
    try {
      const cat = categories.find(c => c._id === catId)
      const sub = cat.subcategories.find(s => s._id === subId)
      const newSubs = cat.subcategories.map(s => s._id === subId ? { ...s, active: !s.active } : s)
      await api.patch(`/admin/categories/${catId}`, { subcategories: newSubs })
      setCategories(prev => prev.map(c => c._id === catId ? { ...c, subcategories: newSubs } : c))
      showToast(`Subcategory ${!sub.active ? 'activated' : 'deactivated'}`)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to toggle subcategory'
      showToast(msg, 'error')
    } finally {
      setToggling(p => ({ ...p, [`sub_${catId}_${subId}`]: false }))
    }
  }

  const deleteSub = async (catId, subId) => {
    const cat = categories.find(c => c._id === catId)
    const sub = cat?.subcategories.find(s => s._id === subId)
    setConfirmModal({
      title: 'Remove Subcategory',
      message: `Remove "${sub?.name}" from "${cat?.name}"?`,
      danger: true,
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/categories/${catId}/subcategories/${subId}`)
          setCategories(prev => prev.map(c => c._id === catId ? { ...c, subcategories: c.subcategories.filter(s => s._id !== subId) } : c))
          showToast(`Subcategory "${sub?.name || 'item'}" removed`)
          showSync()
          window.dispatchEvent(new Event('admin-action'))
        } catch (e) {
          const msg = e.response?.data?.message || 'Failed to delete subcategory'
          showToast(msg, 'error')
        }
      }
    })
  }

  const approveSuggestion = async (reason) => {
    try {
      await api.patch(`/admin/suggestions/${approveModal._id}/approve`, { reason })
      fetchSuggestions()
      fetchCategories()
      setApproveModal(null)
      showToast('Suggestion approved and category added')
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to approve suggestion'
      showToast(msg, 'error')
    }
  }

  const rejectSuggestion = async (reason) => {
    try {
      await api.patch(`/admin/suggestions/${rejectModal._id}/reject`, { reason })
      fetchSuggestions()
      setRejectModal(null)
      showToast('Suggestion rejected')
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to reject suggestion'
      showToast(msg, 'error')
    }
  }

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    c.subcategories.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  )
  const filteredSugs = suggestions.filter(s => sugFilter === 'all' || s.status === sugFilter)

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {syncToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 998, background: 'var(--toast-bg)', color: 'var(--toast-color)', padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', fontWeight: 600, fontSize: 14, animation: 'slideUp 0.3s ease' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 1s infinite', flexShrink: 0 }} />
          ✓ Changes synced to all connected clients via Socket.io
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">📂 Service Categories</div>
          <div className="page-subtitle">
            {categories.length} categories · {categories.reduce((a, c) => a + c.subcategories.length, 0)} subcategories · auto-synced to mobile app
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${tab === 'categories' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('categories')}
          >
            📂 Categories
          </button>
          <button
            className={`btn ${tab === 'suggestions' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('suggestions')}
          >
            💡 Worker Suggestions
            {pendingCount > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 6 }}>{pendingCount}</span>
            )}
          </button>
        </div>
      </div>

      {tab === 'categories' && (
        <>
          <div className="filter-bar">
            <div className="search-bar" style={{ width: 280 }}>
              <span>🔍</span>
              <input placeholder="Search categories or subcategories..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setCatModal('new')}>
              + New Category
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredCats.map(cat => (
              <div key={cat._id} className="card">
                <div
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderBottom: expandedCat === cat._id ? '1px solid var(--border)' : 'none' }}
                  onClick={() => setExpandedCat(expandedCat === cat._id ? null : cat._id)}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: cat.color + '18', border: `2px solid ${cat.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {cat.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{cat.name}</span>
                      <span className={`badge ${cat.active ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                        {cat.active ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                      {cat.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, flexShrink: 0, marginRight: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{cat.subcategories.length}</div>
                      <div style={{ fontSize: 10, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>Subcategories</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--success)' }}>{cat.subcategories.filter(s => s.active).length}</div>
                      <div style={{ fontSize: 10, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>Active</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-outline btn-sm" onClick={() => setCatModal(cat)}>✏️ Edit</button>
                    <button
                      className={`toggle ${cat.active ? 'on' : ''}`}
                      onClick={() => toggleCat(cat._id)}
                      disabled={toggling[`cat_${cat._id}`]}
                      title={cat.active ? 'Hide from app' : 'Show in app'}
                    />
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                      onClick={() => deleteCat(cat._id)}
                    >🗑</button>
                  </div>

                  <span style={{ fontSize: 18, color: 'var(--light)', marginLeft: 4, transition: 'transform 0.2s', transform: expandedCat === cat._id ? 'rotate(180deg)' : 'none', display: 'block' }}>⌄</span>
                </div>

                {expandedCat === cat._id && (
                  <div style={{ padding: '12px 20px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Subcategories ({cat.subcategories.length})
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => setSubModal({ catId: cat._id })}>+ Add Subcategory</button>
                    </div>
                    {cat.subcategories.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 0' }}>
                        <div className="empty-state-icon" style={{ fontSize: 32 }}>📭</div>
                        <div className="empty-state-title" style={{ fontSize: 14 }}>No subcategories yet</div>
                        <div className="empty-state-desc">Add the first subcategory for {cat.name}</div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                        {cat.subcategories.map(sub => (
                          <div key={sub._id} style={{
                            border: `1px solid ${sub.active ? 'var(--border)' : 'var(--bg)'}`,
                            borderRadius: 10, padding: '12px 14px',
                            background: sub.active ? 'var(--card-bg)' : 'var(--bg-alt)',
                            opacity: sub.active ? 1 : 0.6,
                            transition: 'all 0.15s',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cat.icon}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{sub.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginTop: 2, lineHeight: 1.4 }}>{sub.description}</div>
                                {(sub.minPrice > 0 || sub.platformFee > 0 || sub.suggestedMax > 0) && (
                                  <div style={{ fontSize: 10, color: 'var(--light)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
                                    ₹{sub.minPrice || 0} - ₹{sub.suggestedMax || 0} · Fee: ₹{sub.platformFee || 0}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
                              <span className={`badge ${sub.active ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 10 }}>{sub.active ? 'Active' : 'Hidden'}</span>
                              <button className="btn btn-outline btn-sm" style={{ height: 26, fontSize: 11 }} onClick={() => setSubModal({ catId: cat._id, sub })}>Edit</button>
                              <button
                                className={`toggle-sm ${sub.active ? 'on' : ''}`}
                                onClick={() => toggleSub(cat._id, sub._id)}
                                disabled={toggling[`sub_${cat._id}_${sub._id}`]}
                              />
                              <button
                                onClick={() => deleteSub(cat._id, sub._id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--danger)', opacity: 0.7, padding: '2px 4px' }}
                              >🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'suggestions' && (
        <>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            💡 These are category and subcategory suggestions submitted by verified service providers via the mobile app. Approved suggestions are <strong>instantly added and broadcast</strong> to all connected clients.
          </div>

          <div className="filter-bar">
            <div style={{ display: 'flex', gap: 6 }}>
              {['pending', 'approved', 'rejected', 'all'].map(f => (
                <button key={f} className={`filter-chip ${sugFilter === f ? 'active' : ''}`} onClick={() => setSugFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'pending' && pendingCount > 0 && (
                    <span style={{ marginLeft: 5, background: 'var(--danger)', color: 'white', borderRadius: '999px', padding: '1px 6px', fontSize: 10 }}>{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)' }}>
              {filteredSugs.length} suggestion{filteredSugs.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredSugs.map(sug => (
              <div key={sug._id} className="card" style={{
                padding: 20,
                border: sug.status === 'pending' ? '1px solid var(--primary-mid)' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span className={`badge ${sug.type === 'new_category' ? 'badge-purple' : 'badge-primary'}`}>
                        {sug.type === 'new_category' ? '📂 New Category' : '📄 New Subcategory'}
                      </span>
                      <span className={`badge ${sug.status === 'pending' ? 'badge-warning' : sug.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                        {sug.status.charAt(0).toUpperCase() + sug.status.slice(1)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--light)', fontFamily: 'var(--font-body)' }}>
                        {sug.submittedAt ? new Date(sug.submittedAt).toLocaleDateString() : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, var(--primary), var(--purple))' }}>
                        {(typeof sug.workerId === 'object' ? sug.workerId?.name : sug.workerName)?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{typeof sug.workerId === 'object' ? sug.workerId?.name : (sug.workerName || 'Unknown')}</span>
                        <span style={{ fontSize: 12, color: 'var(--mid)', marginLeft: 6 }}>
                          · {typeof sug.workerId === 'object' ? String(sug.workerId?._id).slice(-6) : String(sug.workerId).slice(-6)} · {typeof sug.workerId === 'object' ? sug.workerId?.city : (sug.workerCity || 'Unknown City')}
                        </span>
                      </div>
                    </div>

                    {sug.type === 'new_category' ? (
                      <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 28 }}>{sug.payload.icon}</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{sug.payload.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{sug.payload.description}</div>
                          </div>
                        </div>
                        {sug.payload.suggestedSubcategories?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Suggested Subcategories</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {sug.payload.suggestedSubcategories.map((s, i) => (
                                <span key={i} className="badge badge-primary" style={{ fontSize: 11 }}>{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Add to: <strong>{sug.payload.parentCategory}</strong></div>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{sug.payload.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{sug.payload.description}</div>
                      </div>
                    )}

                    {sug.status === 'rejected' && sug.rejectReason && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-body)' }}>
                        ✕ Rejection reason: {sug.rejectReason}
                      </div>
                    )}
                    {sug.status === 'approved' && sug.approveReason && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(5,150,105,0.1)', borderRadius: 8, fontSize: 12, color: '#059669', fontFamily: 'var(--font-body)' }}>
                        ✓ Approval note: {sug.approveReason}
                      </div>
                    )}
                  </div>

                  {sug.status === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-success" onClick={() => setApproveModal(sug)} style={{ whiteSpace: 'nowrap' }}>
                        ✓ Approve & Add
                      </button>
                      <button className="btn btn-danger" onClick={() => setRejectModal(sug)} style={{ whiteSpace: 'nowrap' }}>
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredSugs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-title">No {sugFilter} suggestions</div>
                <div className="empty-state-desc">Worker suggestions from the mobile app will appear here</div>
              </div>
            )}
          </div>
        </>
      )}

      {catModal && (
        <CategoryModal
          cat={catModal === 'new' ? null : catModal}
          onSave={saveCat}
          onClose={() => setCatModal(null)}
        />
      )}
      {subModal && (
        <SubcategoryModal
          catName={categories.find(c => c._id === subModal.catId)?.name}
          sub={subModal.sub || null}
          onSave={saveSub}
          onClose={() => setSubModal(null)}
        />
      )}
      {rejectModal && (
        <RejectModal
          suggestion={rejectModal}
          onConfirm={rejectSuggestion}
          onClose={() => setRejectModal(null)}
        />
      )}
      {approveModal && (
        <ApproveModal
          suggestion={approveModal}
          onConfirm={approveSuggestion}
          onClose={() => setApproveModal(null)}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          danger={confirmModal.danger}
          confirmText={confirmModal.confirmText}
          onConfirm={async () => {
            const fn = confirmModal.onConfirm
            setConfirmModal(null)
            await fn()
          }}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}
