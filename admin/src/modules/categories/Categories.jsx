import React, { useState, useEffect, useCallback } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import { getImageUrl } from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'

function CategoryModal({ cat, onSave, onClose }) {
  const [form, setForm] = useState(cat
    ? { name: cat.name, description: cat.description || '', icon: cat.icon || 'Wrench', color: cat.color || '#00d2ff' }
    : { name: '', description: '', icon: 'Wrench', color: '#00d2ff' }
  )
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(cat?.imageUrl || null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = React.useRef()

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Category name is required'
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({ ...form, name: form.name.trim() }, imageFile)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} onClose={!saving ? onClose : undefined} title={cat ? 'Edit Category' : 'Add New Category'} width="520px">
      <div>
        {/* ── Image Upload ── */}
        <div className="form-group">
          <label className="form-label">Cover Image <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(shown on mobile app)</span></label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 12,
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              background: 'var(--input-bg)',
              position: 'relative',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>Click to change</div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--mid)' }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🖼️</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Click to upload image</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG up to 5MB</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        </div>

        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">Category Name *</label>
          <input
            className={`form-control ${errors.name ? 'input-error' : ''}`}
            placeholder="e.g. Beauty & Salon"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoFocus
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : cat ? 'Save Changes' : '+ Add Category'}
          </button>
        </div>
      </div>
    </Modal>
  )
}


function SubcategoryModal({ catName, sub, onSave, onClose }) {
  const [form, setForm] = useState(sub
    ? { name: sub.name }
    : { name: '' }
  )
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(sub?.imageUrl || null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = React.useRef()

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Subcategory name is required'
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({ ...form, name: form.name.trim() }, imageFile)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} onClose={!saving ? onClose : undefined} title={sub ? `Edit Subcategory (${catName})` : `Add Subcategory to "${catName}"`} width="480px">
      <div>
        <div className="form-group">
          <label className="form-label">Subcategory Icon/Image <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(optional)</span></label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 12,
              height: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              background: 'var(--input-bg)',
              position: 'relative',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>Change</div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--mid)' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>🎨</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Click to upload subcategory image</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Subcategory Name *</label>
          <input
            className={`form-control ${errors.name ? 'input-error' : ''}`}
            placeholder="e.g. Haircut, AC Repair, Facial"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoFocus
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : sub ? 'Save Changes' : '+ Add Subcategory'}
          </button>
        </div>
      </div>
    </Modal>
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
    <Modal open={true} onClose={!saving ? onClose : undefined} title="Reject Suggestion" width="460px">
      <div>
        <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16 }}>
          Rejection reason will be sent to <strong>{typeof suggestion.workerId === 'object' ? suggestion.workerId?.name : (suggestion.workerName || 'Worker')}</strong> via notification.
        </p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Reason *</label>
          <select className="form-control" value={reason} onChange={e => setReason(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">Select reason...</option>
            <option value="Category already exists under a different name">Category already exists under a different name</option>
            <option value="Requires special licensing or certification">Requires special licensing or certification</option>
            <option value="Out of scope for current platform">Out of scope for current platform</option>
            <option value="Insufficient demand in target cities">Insufficient demand in target cities</option>
            <option value="Will be considered in a future update">Will be considered in a future update</option>
            <option value="Other">Other (see notes below)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Additional Notes</label>
          <textarea className="form-control" placeholder="Optional detailed explanation..." rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-danger" style={{ flex: 1 }} onClick={handleConfirm} disabled={!reason || saving}>
            {saving ? 'Rejecting...' : '✕ Confirm Rejection'}
          </button>
        </div>
      </div>
    </Modal>
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
    <Modal open={true} onClose={!saving ? onClose : undefined} title="Approve Suggestion" width="460px">
      <div>
        <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16 }}>
          Approval message will be sent to <strong>{typeof suggestion.workerId === 'object' ? suggestion.workerId?.name : (suggestion.workerName || 'Worker')}</strong> via notification.
        </p>
        <div className="form-group">
          <label className="form-label">Approval Message / Reason *</label>
          <textarea className="form-control" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Great idea! We've added this to the platform." rows={3} autoFocus style={{ fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleConfirm} disabled={!reason.trim() || saving}>
            {saving ? 'Approving...' : '✓ Confirm Approval'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Categories() {
  const api = useAbortableRequest()
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
      if (isAbortError(error)) return
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
      if (isAbortError(error)) return
      const msg = error.response?.data?.message || 'Failed to load suggestions'
      showToast(msg, 'error')
    }
  }

  const pendingWorkerCount = suggestions.filter(s => s.status === 'pending' && (!s.source || s.source === 'worker')).length
  const pendingCustomerCount = suggestions.filter(s => s.status === 'pending' && s.source === 'customer').length

  const showSync = () => {
    setSyncToast(true)
    setTimeout(() => setSyncToast(false), 3000)
  }

  const saveCat = async (form, imageFile) => {
    try {
      // Build FormData so we can send image file + text fields together
      const fd = new FormData()
      fd.append('name', form.name)
      if (form.description) fd.append('description', form.description)
      if (form.icon) fd.append('icon', form.icon)
      if (form.color) fd.append('color', form.color)
      if (imageFile) fd.append('image', imageFile)

      const headers = { 'Content-Type': 'multipart/form-data' }

      if (catModal === 'new') {
        await api.post('/admin/categories', fd, { headers })
        showToast('Category created successfully')
      } else {
        await api.patch(`/admin/categories/${catModal._id}`, fd, { headers })
        showToast('Category updated successfully')
      }
      fetchCategories()
      setCatModal(null)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = extractErrorMessage(e, 'Failed to save category')
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
      const msg = extractErrorMessage(e, 'Failed to toggle category')
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
          const msg = extractErrorMessage(e, 'Failed to delete category')
          showToast(msg, 'error')
        }
      }
    })
  }

  const saveSub = async (form, imageFile) => {
    const { catId, sub } = subModal
    try {
      const data = new FormData()
      data.append('name', form.name)
      if (imageFile) data.append('image', imageFile)

      if (sub) {
        await api.patch(`/admin/categories/${catId}/subcategories/${sub._id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        showToast('Subcategory updated successfully')
      } else {
        await api.post(`/admin/categories/${catId}/subcategories`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        showToast('Subcategory added successfully')
      }
      fetchCategories()
      setSubModal(null)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = extractErrorMessage(e, 'Failed to save subcategory')
      const details = e.response?.data?.errors
      showToast(details ? details.join(', ') : msg, 'error')
    }
  }

  const toggleSub = async (catId, subId) => {
    setToggling(p => ({ ...p, [`sub_${catId}_${subId}`]: true }))
    try {
      const cat = categories.find(c => c._id === catId)
      const sub = cat.subcategories.find(s => s._id === subId)
      const newState = !sub.active
      const res = await api.patch(`/admin/categories/${catId}/subcategories/${subId}`, { active: newState })
      const updatedSub = res.data?.data?.subcategory
      setCategories(prev => prev.map(c => c._id === catId
        ? { ...c, subcategories: c.subcategories.map(s => s._id === subId ? { ...s, active: newState, ...(updatedSub || {}) } : s) }
        : c))
      showToast(`Subcategory ${newState ? 'activated' : 'deactivated'}`)
      showSync()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      const msg = extractErrorMessage(e, 'Failed to toggle subcategory')
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
          const msg = extractErrorMessage(e, 'Failed to delete subcategory')
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
      const msg = extractErrorMessage(e, 'Failed to approve suggestion')
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
      const msg = extractErrorMessage(e, 'Failed to reject suggestion')
      showToast(msg, 'error')
    }
  }

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
    c.subcategories.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  )
  const filteredSugs = suggestions.filter(s => 
    (sugFilter === 'all' || (s.status || '').toLowerCase() === sugFilter.toLowerCase()) &&
    (tab === 'customer_suggestions' ? s.source === 'customer' : s.source !== 'customer')
  )

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {syncToast && (
        <div className="toast-bottom" style={{ zIndex: 9999 }}>
          <div className="toast toast-success" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card-bg)', border: '1px solid var(--primary)', color: 'var(--light)' }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            Changes auto-synced to mobile app
          </div>
        </div>
      )}

      <div className="content-header">
        <div>
          <h1 className="page-title">Service Categories</h1>
          <p className="page-subtitle">Kwickly / Service Categories</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor', boxShadow: '0 0 8px currentColor' }} />
            Live
          </div>
          <button className="btn btn-outline" style={{ padding: '8px', position: 'relative' }}>
            🔔
            {pendingWorkerCount + pendingCustomerCount > 0 && <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, background: 'var(--danger)', borderRadius: 4 }} />}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>📂</span>
              <h2 style={{ margin: 0, fontSize: 20 }}>Service Categories</h2>
            </div>
            <div style={{ color: 'var(--mid)', fontSize: 13 }}>
              {categories.length} categories · {categories.reduce((acc, c) => acc + c.subcategories.length, 0)} subcategories · auto-synced to mobile app
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
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
            {pendingWorkerCount > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 6 }}>{pendingWorkerCount}</span>
            )}
          </button>
          <button
            className={`btn ${tab === 'customer_suggestions' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('customer_suggestions')}
          >
            🙋 Customer Suggestions
            {pendingCustomerCount > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 6 }}>{pendingCustomerCount}</span>
            )}
          </button>
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
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, cursor: 'pointer', borderBottom: expandedCat === cat._id ? '1px solid var(--border)' : 'none' }}
                  onClick={() => setExpandedCat(expandedCat === cat._id ? null : cat._id)}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-light)', border: `2px solid var(--primary)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {cat.imageUrl ? <img src={cat.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>📁</span>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{cat.name}</span>
                      <span className={`badge ${cat.active ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                        {cat.active ? 'Active' : 'Hidden'}
                      </span>
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
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, overflow: 'hidden' }}>
                                {sub.imageUrl ? <img src={getImageUrl(sub.imageUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="sub" /> : '📄'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{sub.name}</div>
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

      {(tab === 'suggestions' || tab === 'customer_suggestions') && (
        <>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            {tab === 'suggestions' ? (
              <span>💡 These are category and subcategory suggestions submitted by verified service providers via the mobile app. Approved suggestions are <strong>instantly added and broadcast</strong> to all connected clients.</span>
            ) : (
              <span>🙋 These are subcategory suggestions submitted by customers via the mobile app. Approving them makes them instantly available.</span>
            )}
          </div>

          <div className="filter-bar">
            <div style={{ display: 'flex', gap: 6 }}>
              {['pending', 'approved', 'rejected', 'all'].map(f => (
                <button key={f} className={`filter-chip ${sugFilter === f ? 'active' : ''}`} onClick={() => setSugFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'pending' && (tab === 'suggestions' ? pendingWorkerCount : pendingCustomerCount) > 0 && (
                    <span style={{ marginLeft: 5, background: 'var(--danger)', color: 'white', borderRadius: '999px', padding: '1px 6px', fontSize: 10 }}>
                      {tab === 'suggestions' ? pendingWorkerCount : pendingCustomerCount}
                    </span>
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
                      <span className={`badge badge-gray`} style={{ color: sug.source === 'customer' ? 'var(--primary)' : 'var(--mid)' }}>
                        {sug.source === 'customer' ? '🙋 Customer' : '💡 Worker'}
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
                <div className="empty-state-desc">Suggestions from the mobile app will appear here</div>
              </div>
            )}
          </div>
        </>
      )}
      </div>

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
