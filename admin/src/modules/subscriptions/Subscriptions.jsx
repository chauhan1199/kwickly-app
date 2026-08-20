import React, { useState, useEffect } from 'react'
import { Plus, Edit3, Trash2, CheckCircle, Ban, RefreshCw, Search, Shield, Zap, Sparkles, Clock, AlertCircle } from 'lucide-react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'

const planColorMap = {
  trial: '#8B5CF6',
  monthly: '#00B4D8',
  annual: '#10B981',
  starter: '#F59E0B',
  pro: '#EC4899',
  default: '#6366F1'
}

function EditPlanModal({ plan, onSave, onClose }) {
  const isNew = plan.isNew
  const [form, setForm] = useState({
    id: plan.id || `${(plan.targetRole || 'WORKER').toLowerCase()}_${Date.now()}`,
    name: plan.name || plan.label || '',
    price: plan.price !== undefined ? plan.price : 499,
    durationDays: plan.durationDays || 30,
    features: [...(plan.features || [])],
    targetRole: plan.targetRole || 'WORKER',
    isActive: plan.isActive !== false
  })
  const [newFeat, setNewFeat] = useState('')
  const [errors, setErrors] = useState({})

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }))
  }

  const addFeat = () => {
    if (newFeat.trim()) {
      setForm(p => ({ ...p, features: [...p.features, newFeat.trim()] }))
      setNewFeat('')
    }
  }

  const removeFeat = (i) => setForm(p => ({ ...p, features: p.features.filter((_, j) => j !== i) }))

  const handleSubmit = (e) => {
    e?.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Plan name is required'
    if (form.price < 0 || isNaN(form.price)) errs.price = 'Price must be 0 or greater'
    if (!form.durationDays || form.durationDays < 1) errs.durationDays = 'Duration must be at least 1 day'

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const finalFeatures = [...form.features]
    if (newFeat.trim()) finalFeatures.push(newFeat.trim())
    if (finalFeatures.length === 0) finalFeatures.push('Standard Platform Access')

    onSave({
      ...plan,
      ...form,
      label: form.name.trim(),
      name: form.name.trim(),
      features: finalFeatures
    })
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? `+ Create ${form.targetRole === 'WORKER' ? 'Worker' : 'Shop'} Plan` : `✏️ Edit ${form.name || 'Plan'}`} width="520px">
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label className="input-label">Target Audience *</label>
            <select
              className="form-control"
              value={form.targetRole}
              onChange={e => set('targetRole', e.target.value)}
              disabled={!isNew}
              style={{ fontSize: 13 }}
            >
              <option value="WORKER">👷 Worker (Service Provider)</option>
              <option value="SHOP">🏪 Shop (Store Owner)</option>
            </select>
          </div>
          <div>
            <label className="input-label">Plan Status</label>
            <select
              className="form-control"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={e => set('isActive', e.target.value === 'active')}
              style={{ fontSize: 13 }}
            >
              <option value="active">Active (Visible)</option>
              <option value="inactive">Inactive (Hidden)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="input-label">Plan Name *</label>
          <input
            className="form-control"
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Worker Monthly Pro, Shop Starter"
            style={{ fontSize: 13 }}
          />
          {errors.name && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{errors.name}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="input-label">Price (₹) *</label>
            <input
              className="form-control"
              type="number"
              value={form.price}
              onChange={e => set('price', +e.target.value)}
              placeholder="0 for Free Trial"
              min={0}
              style={{ fontSize: 13 }}
            />
            {errors.price && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{errors.price}</div>}
            <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>Enter 0 for free trial</div>
          </div>
          <div>
            <label className="input-label">Validity Duration (Days) *</label>
            <input
              className="form-control"
              type="number"
              value={form.durationDays}
              onChange={e => set('durationDays', +e.target.value)}
              placeholder="30"
              min={1}
              style={{ fontSize: 13 }}
            />
            {errors.durationDays && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{errors.durationDays}</div>}
            <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>e.g. 14, 30, 90, 365</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="input-label" style={{ margin: 0 }}>Plan Benefits & Features</label>
            <span style={{ fontSize: 11, color: 'var(--mid)' }}>{form.features.length} added</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 180, overflowY: 'auto' }}>
            {form.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--input-bg)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border)' }}>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: 12 }}>✓</span>
                <span style={{ flex: 1, fontSize: 12 }}>{f}</span>
                <button type="button" onClick={() => removeFeat(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-control"
              placeholder="Type feature (e.g. Unlimited job alerts)..."
              value={newFeat}
              onChange={e => setNewFeat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeat(); } }}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button type="button" className="btn-secondary" onClick={addFeat} style={{ fontSize: 12 }}>
              + Add
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>
            {isNew ? 'Create Plan' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Subscriptions() {
  const api = useAbortableRequest()
  const [plans, setPlans] = useState([])
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState(null)
  const [subFilter, setSubFilter] = useState('all')
  const [activeRole, setActiveRole] = useState('WORKER') // 'WORKER' or 'SHOP'
  const [confirmExtend, setConfirmExtend] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [settingsRes, workersRes, shopsRes] = await Promise.all([
        api.get('/admin/settings'),
        api.get('/admin/workers'),
        api.get('/admin/shops').catch(() => api.get('/shops'))
      ])

      if (settingsRes.data.status === 'success') {
        const rawPlans = settingsRes.data.data.subscriptionPlans || []
        const parsed = rawPlans.map(p => {
          const lowerName = (p.label || p.name || '').toLowerCase()
          let color = planColorMap.default
          if (p.price === 0 || lowerName.includes('trial')) color = planColorMap.trial
          else if (lowerName.includes('month')) color = planColorMap.monthly
          else if (lowerName.includes('annual') || lowerName.includes('year')) color = planColorMap.annual
          else if (lowerName.includes('pro')) color = planColorMap.pro
          else if (lowerName.includes('starter')) color = planColorMap.starter

          return {
            id: p.id || `plan_${Date.now()}`,
            name: p.label || p.name || 'Custom Plan',
            label: p.label || p.name || 'Custom Plan',
            price: Number(p.price) || 0,
            durationDays: Number(p.durationDays) || 30,
            features: p.features?.length > 0 ? p.features : ['Standard Platform Access'],
            targetRole: (p.targetRole || 'WORKER').toUpperCase(),
            isActive: p.isActive !== false,
            color
          }
        })
        setPlans(parsed)
      }

      let allSubs = []

      if (workersRes.data?.status === 'success') {
        const workersArr = workersRes.data.data.workers || workersRes.data.data
        const workersData = (Array.isArray(workersArr) ? workersArr : []).map(w => {
          let expiry = w.subscription?.expiryDate || w.subscription?.trialEndDate
          if (!expiry && w.createdAt) {
            const created = new Date(w.createdAt)
            expiry = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000)
          }

          const daysLeft = expiry ? Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0
          const isExpired = !expiry || new Date(expiry) < new Date()
          const isTrial = w.subscription?.isTrial !== false

          return {
            id: w._id.toString().slice(-6),
            _id: w._id,
            name: w.name,
            phone: w.phone,
            role: 'WORKER',
            plan: isTrial ? 'Free Trial' : (w.subscription?.planId || 'Standard'),
            isTrial,
            startDate: w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            endDate: expiry ? new Date(expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Expired',
            daysLeft: Math.max(0, daysLeft),
            status: isExpired ? 'expired' : isTrial ? 'trial' : 'active'
          }
        })
        allSubs = [...allSubs, ...workersData]
      }

      if (shopsRes.data?.status === 'success') {
        const shopsArr = shopsRes.data.data.shops || shopsRes.data.data
        const shopsData = (Array.isArray(shopsArr) ? shopsArr : []).map(s => {
          let expiry = s.subscription?.expiryDate || s.subscription?.trialEndDate
          if (!expiry && s.createdAt) {
            const created = new Date(s.createdAt)
            expiry = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000)
          }

          const daysLeft = expiry ? Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0
          const isExpired = !expiry || new Date(expiry) < new Date()
          const isTrial = s.subscription?.isTrial !== false

          return {
            id: s._id.toString().slice(-6),
            _id: s._id,
            name: s.name || s.ownerName || 'Shop',
            phone: s.phone || s.ownerPhone,
            role: 'SHOP',
            plan: isTrial ? 'Free Trial' : (s.subscription?.planId || 'Standard'),
            isTrial,
            startDate: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            endDate: expiry ? new Date(expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Expired',
            daysLeft: Math.max(0, daysLeft),
            status: isExpired ? 'expired' : isTrial ? 'trial' : 'active'
          }
        })
        allSubs = [...allSubs, ...shopsData]
      }

      setSubscribers(allSubs)
    } catch (e) {
      if (isAbortError(e)) return
      showToast('Failed to load subscription plans', 'error')
    } finally {
      setLoading(false)
    }
  }

  const savePlan = async (updated) => {
    try {
      let updatedList = [...plans]
      const existsIdx = updatedList.findIndex(p => p.id === updated.id)

      if (existsIdx === -1) {
        updatedList.push(updated)
      } else {
        updatedList[existsIdx] = updated
      }

      const payload = updatedList.map(p => ({
        id: p.id,
        label: p.name || p.label,
        name: p.name || p.label,
        price: Number(p.price) || 0,
        durationDays: Number(p.durationDays) || 30,
        features: p.features || [],
        isActive: p.isActive !== false,
        targetRole: p.targetRole || 'WORKER'
      }))

      await api.patch('/admin/settings', { subscriptionPlans: payload })
      showToast(`${updated.name} saved successfully!`)
      setEditPlan(null)
      fetchData()
    } catch {
      showToast('Failed to save subscription plan', 'error')
    }
  }

  const togglePlanStatus = async (plan) => {
    try {
      const updatedList = plans.map(p => p.id === plan.id ? { ...p, isActive: !p.isActive } : p)
      const payload = updatedList.map(p => ({
        id: p.id,
        label: p.name || p.label,
        name: p.name || p.label,
        price: Number(p.price) || 0,
        durationDays: Number(p.durationDays) || 30,
        features: p.features || [],
        isActive: p.isActive !== false,
        targetRole: p.targetRole || 'WORKER'
      }))

      await api.patch('/admin/settings', { subscriptionPlans: payload })
      showToast(`${plan.name} is now ${!plan.isActive ? 'Active' : 'Inactive'}`)
      fetchData()
    } catch {
      showToast('Failed to toggle plan status', 'error')
    }
  }

  const deletePlan = async (planId) => {
    try {
      const updatedList = plans.filter(p => p.id !== planId)
      const payload = updatedList.map(p => ({
        id: p.id,
        label: p.name || p.label,
        name: p.name || p.label,
        price: Number(p.price) || 0,
        durationDays: Number(p.durationDays) || 30,
        features: p.features || [],
        isActive: p.isActive !== false,
        targetRole: p.targetRole || 'WORKER'
      }))

      await api.patch('/admin/settings', { subscriptionPlans: payload })
      showToast('Plan deleted successfully')
      setConfirmDelete(null)
      fetchData()
    } catch {
      showToast('Failed to delete plan', 'error')
    }
  }

  const extendSubscription = async (targetId, days = 30) => {
    try {
      const endpoint = activeRole === 'SHOP' ? `/admin/shops/${targetId}/extend-subscription` : `/admin/workers/${targetId}/extend-subscription`
      await api.patch(endpoint, { days })
      showToast(`Subscription extended by ${days} days!`)
      fetchData()
    } catch {
      showToast('Failed to extend subscription', 'error')
    }
  }

  const rolePlans = plans.filter(p => p.targetRole === activeRole)
  const roleSubscribers = subscribers.filter(s => {
    const matchRole = s.role === activeRole
    const matchFilter = subFilter === 'all' || s.status === subFilter
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
    return matchRole && matchFilter && matchSearch
  })

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">💳 Subscription Plans & Validity</div>
          <div className="page-subtitle">Configure pricing tiers, durations, and manage live validity for Workers and Shops</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--input-bg)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button
              className="btn-secondary"
              onClick={() => setActiveRole('WORKER')}
              style={{
                fontSize: 12,
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                background: activeRole === 'WORKER' ? 'var(--primary)' : 'transparent',
                color: activeRole === 'WORKER' ? '#000' : 'var(--text)',
                fontWeight: activeRole === 'WORKER' ? 700 : 500
              }}
            >
              👷 Worker Plans
            </button>
            <button
              className="btn-secondary"
              onClick={() => setActiveRole('SHOP')}
              style={{
                fontSize: 12,
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                background: activeRole === 'SHOP' ? 'var(--primary)' : 'transparent',
                color: activeRole === 'SHOP' ? '#000' : 'var(--text)',
                fontWeight: activeRole === 'SHOP' ? 700 : 500
              }}
            >
              🏪 Shop Plans
            </button>
          </div>
          <button
            className="btn-primary"
            onClick={() => setEditPlan({ isNew: true, targetRole: activeRole, name: '', price: activeRole === 'WORKER' ? 499 : 299, durationDays: 30, features: ['Unlimited Access', 'Direct Contact'] })}
          >
            <Plus size={16} /> New {activeRole === 'WORKER' ? 'Worker' : 'Shop'} Plan
          </button>
          <button className="btn-secondary" onClick={fetchData} title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} color="var(--primary)" />
          Configured {activeRole === 'WORKER' ? 'Worker' : 'Shop'} Plans ({rolePlans.length})
        </div>

        {rolePlans.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', background: 'var(--card-bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No {activeRole === 'WORKER' ? 'Worker' : 'Shop'} Plans Configured</div>
            <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 14 }}>Create your first plan to allow {activeRole.toLowerCase()}s to subscribe and stay active.</div>
            <button
              className="btn-primary"
              style={{ fontSize: 12 }}
              onClick={() => setEditPlan({ isNew: true, targetRole: activeRole, name: '', price: activeRole === 'WORKER' ? 499 : 299, durationDays: 30, features: ['Unlimited Access'] })}
            >
              <Plus size={14} /> Create First Plan
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {rolePlans.map(plan => (
              <div
                key={plan.id}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 12,
                  border: `2px solid ${plan.isActive ? plan.color + '40' : 'var(--border)'}`,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: plan.isActive ? 1 : 0.65,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ padding: '18px 20px 14px', background: `linear-gradient(135deg, ${plan.color}15, transparent)`, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: plan.color }}>{plan.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: plan.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                        color: plan.isActive ? '#10B981' : 'var(--mid)'
                      }}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 900 }}>{plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString('en-IN')}`}</span>
                    <span style={{ fontSize: 12, color: 'var(--mid)' }}>/ {plan.durationDays} days</span>
                  </div>
                </div>

                <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', marginBottom: 8 }}>Features:</div>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 5, fontSize: 12 }}>
                        <span style={{ color: '#10B981', fontWeight: 800 }}>✓</span>
                        <span style={{ color: 'var(--text)' }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: 12, padding: '6px 0', justifyContent: 'center' }}
                      onClick={() => setEditPlan(plan)}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      className={`btn-icon ${plan.isActive ? 'danger' : 'success'}`}
                      style={{ height: 32, width: 32 }}
                      onClick={() => togglePlanStatus(plan)}
                      title={plan.isActive ? 'Deactivate Plan' : 'Activate Plan'}
                    >
                      {plan.isActive ? <Ban size={14} /> : <CheckCircle size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn-icon danger"
                      style={{ height: 32, width: 32 }}
                      onClick={() => setConfirmDelete({ id: plan.id, name: plan.name })}
                      title="Delete Plan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscriber Management Section */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>👥 {activeRole === 'WORKER' ? 'Worker' : 'Shop'} Subscribers & Validity Queue</div>
            <div style={{ fontSize: 12, color: 'var(--mid)' }}>Track live expiration dates, subscription tiers, and grant validity extensions</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="search-box" style={{ width: 220, height: 34 }}>
              <Search size={14} />
              <input
                placeholder="Search subscriber..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 12, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', width: '100%' }}
              />
            </div>
            {['all', 'active', 'trial', 'expired'].map(f => (
              <button
                key={f}
                className={`filter-chip ${subFilter === f ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setSubFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{activeRole === 'WORKER' ? 'Worker' : 'Shop'}</th>
                <th>Plan Tier</th>
                <th>Joined Date</th>
                <th>Expires On</th>
                <th>Days Remaining</th>
                <th>Status</th>
                <th>Quick Extend</th>
              </tr>
            </thead>
            <tbody>
              {roleSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--mid)' }}>
                    No {activeRole.toLowerCase()} subscribers found for this filter
                  </td>
                </tr>
              ) : (
                roleSubscribers.map(sub => (
                  <tr key={sub._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          className="avatar avatar-sm"
                          style={{
                            background: sub.role === 'SHOP' ? 'linear-gradient(135deg, #10B981, #06B6D4)' : 'linear-gradient(135deg, #F97316, #EA580C)'
                          }}
                        >
                          {(sub.name || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{sub.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mid)' }}>{sub.phone || 'No phone'} · ID: {sub.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: sub.isTrial ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0, 180, 216, 0.15)',
                          color: sub.isTrial ? '#8B5CF6' : '#00B4D8'
                        }}
                      >
                        {sub.plan}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--mid)' }}>{sub.startDate}</td>
                    <td style={{ fontSize: 12, color: sub.status === 'expired' ? '#EF4444' : 'var(--text)', fontWeight: 600 }}>{sub.endDate}</td>
                    <td>
                      {sub.status === 'expired' ? (
                        <span style={{ color: '#EF4444', fontWeight: 800, fontSize: 12 }}>0 Days</span>
                      ) : (
                        <span style={{ fontWeight: 800, color: sub.daysLeft <= 7 ? '#EF4444' : sub.daysLeft <= 30 ? '#F59E0B' : '#10B981', fontSize: 12 }}>
                          {sub.daysLeft} Days
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: sub.status === 'expired' ? 'rgba(239, 68, 68, 0.15)' : sub.status === 'trial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: sub.status === 'expired' ? '#EF4444' : sub.status === 'trial' ? '#F59E0B' : '#10B981'
                        }}
                      >
                        {sub.status.toUpperCase()}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}
                          onClick={() => setConfirmExtend({ id: sub._id, name: sub.name, days: 30 })}
                        >
                          +30d
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}
                          onClick={() => setConfirmExtend({ id: sub._id, name: sub.name, days: 90 })}
                        >
                          +90d
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editPlan && <EditPlanModal plan={editPlan} onSave={savePlan} onClose={() => setEditPlan(null)} />}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Subscription Plan"
          message={`Are you sure you want to delete "${confirmDelete.name}"? Existing subscribers will retain their current validity.`}
          confirmText="Delete Plan"
          danger={true}
          onConfirm={() => deletePlan(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {confirmExtend && (
        <ConfirmModal
          title="Extend Validity"
          message={`Extend validity for "${confirmExtend.name}" by ${confirmExtend.days} days?`}
          confirmText={`Extend +${confirmExtend.days}d`}
          onConfirm={() => { extendSubscription(confirmExtend.id, confirmExtend.days); setConfirmExtend(null); }}
          onClose={() => setConfirmExtend(null)}
        />
      )}
    </div>
  )
}
