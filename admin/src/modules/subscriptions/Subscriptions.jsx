import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'

const planColor = { trial: 'badge-purple', monthly: 'badge-primary', annual: 'badge-success', expired: 'badge-danger' }

function EditPlanModal({ plan, onSave, onClose }) {
  const isNew = plan.isNew
  const [form, setForm] = useState({ 
    id: plan.id || `plan_${Date.now()}`,
    name: plan.name || '',
    price: plan.price || 0, 
    durationDays: plan.durationDays || 30, 
    features: [...(plan.features || [])],
    targetRole: plan.targetRole || 'SHOP'
  })
  const [newFeat, setNewFeat] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const addFeat = () => { if (newFeat.trim()) { setForm(p => ({ ...p, features: [...p.features, newFeat.trim()] })); setNewFeat('') } }
  const removeFeat = (i) => setForm(p => ({ ...p, features: p.features.filter((_, j) => j !== i) }))
  
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: 16 }}>{plan.icon} Edit {plan.name} Plan</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {isNew && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Plan Name</label>
              <input className="form-control" type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Shop Premium" />
            </div>
          )}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Price (₹)</label>
              <input className="form-control" type="number" value={form.price} onChange={e => set('price', +e.target.value)} disabled={plan.id === 'trial'} />
              {plan.id === 'trial' && <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Trial plan is always free</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Duration ({plan.durationUnit})</label>
              <input className="form-control" type="number" value={form.durationDays} onChange={e => set('durationDays', +e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Features</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {form.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-dark)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{f}</span>
                  <button onClick={() => removeFeat(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-control" placeholder="Add feature..." value={newFeat} onChange={e => setNewFeat(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeat()} style={{ flex: 1 }} />
              <button className="btn btn-outline btn-sm" onClick={addFeat}>+ Add</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const finalFeatures = [...form.features];
            if (newFeat.trim()) finalFeatures.push(newFeat.trim());
            onSave({ ...plan, ...form, features: finalFeatures });
          }}>💾 Save Plan</button>
        </div>
      </div>
    </div>
  )
}

export default function Subscriptions() {
  const [plans, setPlans] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [subFilter, setSubFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('WORKER') // 'WORKER' or 'SHOP'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [settingsRes, workersRes, shopsRes] = await Promise.all([
        api.get('/admin/settings'),
        api.get('/admin/workers'),
        api.get('/shops')
      ])

      if (settingsRes.data.status === 'success') {
        const plansData = (settingsRes.data.data.subscriptionPlans || []).map(p => ({
          ...p,
          name: p.label || p.name || 'Plan',
          durationUnit: 'days',
          durationDays: p.durationDays || (p.label === 'Trial' ? settingsRes.data.data.trialDays : 30),
          color: p.label === 'Trial' ? '#7C3AED' : p.label === 'Monthly' ? '#2563EB' : '#16A34A',
          icon: p.label === 'Trial' ? '🆓' : p.label === 'Monthly' ? '📅' : '⭐',
          features: p.features?.length > 0 ? p.features : ['Standard Features'],
          targetRole: p.targetRole || 'WORKER'
        }))
        setPlans(plansData)
      }

      let allUsers = []

      if (workersRes.data?.status === 'success') {
        const workersArr = workersRes.data.data.workers || workersRes.data.data
        const workersData = (Array.isArray(workersArr) ? workersArr : []).map(w => ({
          id: w._id.toString().slice(-6),
          _id: w._id,
          name: w.name,
          role: 'WORKER',
          plan: w.subscription?.planId?.toLowerCase() || 'none',
          startDate: w.subscription?.startDate ? new Date(w.subscription.startDate).toLocaleDateString() : '—',
          endDate: w.subscription?.endDate ? new Date(w.subscription.endDate).toLocaleDateString() : '—',
          daysLeft: w.subscription?.endDate ? Math.ceil((new Date(w.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
          autoRenew: false,
          status: (w.subscription?.endDate && new Date(w.subscription.endDate) < new Date()) ? 'expired' : 'active'
        }))
        allUsers = [...allUsers, ...workersData]
      }

      if (shopsRes.data?.status === 'success') {
        const shopsArr = shopsRes.data.data.shops || shopsRes.data.data
        const shopsData = (Array.isArray(shopsArr) ? shopsArr : []).map(s => ({
          id: s._id.toString().slice(-6),
          _id: s._id,
          name: s.ownerName || s.name || 'Unknown Shop',
          role: 'SHOP',
          plan: s.subscription?.planId?.toLowerCase() || 'none',
          startDate: '—', // We don't have startDate for shops yet
          endDate: s.subscription?.expiryDate ? new Date(s.subscription.expiryDate).toLocaleDateString() : '—',
          daysLeft: s.subscription?.expiryDate ? Math.ceil((new Date(s.subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
          autoRenew: false,
          status: (s.subscription?.expiryDate && new Date(s.subscription.expiryDate) < new Date()) ? 'expired' : 'active'
        }))
        allUsers = [...allUsers, ...shopsData]
      }

      setWorkers(allUsers)
    } catch (e) {
      console.error('Error fetching subscription data:', e)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, type = 'success') => setToast({ message, type })

  const savePlan = async (updated) => {
    try {
      let updatedPlansNative = [...plans]
      const exists = updatedPlansNative.find(p => p.id === updated.id)
      
      if (!exists) {
        updatedPlansNative.push(updated)
      } else {
        updatedPlansNative = updatedPlansNative.map(p => {
           const target = p.id === updated.id ? updated : p;
           return {
               id: target.id,
               label: target.label || target.name,
               price: target.price,
               durationDays: target.durationDays || 30,
               features: target.features,
               isActive: target.isActive !== false,
               targetRole: target.targetRole || 'WORKER'
           }
        })
      }
      
      await api.patch('/admin/settings', { subscriptionPlans: updatedPlansNative.map(p => ({
         id: p.id, label: p.label || p.name, price: p.price, durationDays: p.durationDays || 30, features: p.features, isActive: p.isActive !== false, targetRole: p.targetRole || 'WORKER'
      })) })
      showToast(`${updated.name} plan updated & synced`)
      setEditPlan(null)
      fetchData()
    } catch (e) {
      console.error(e)
      showToast('Failed to update plan', 'error')
    }
  }

  const extendSub = async (wid) => {
    // TODO: No backend endpoint exists for extending subscriptions.
    // Add PATCH /admin/workers/:id/extend-subscription endpoint to admin.routes.js
    // before this can work. Currently a no-op.
    showToast('Subscription extension requires a backend endpoint (not yet implemented)', 'error')
  }

  const filtered = workers.filter(w => subFilter === 'all' || w.plan === subFilter || (subFilter === 'expired' && w.status === 'expired'))

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:16 }}>
      <div className="loading-spinner" style={{ width:40, height:40, border:'4px solid var(--primary-light)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <div style={{ fontWeight:700, color:'var(--mid)', fontSize:14 }}>Loading subscription data...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (plans.length === 0) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🎯</div>
      <div style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>No Plans Configured</div>
      <div style={{ color:'var(--mid)', fontSize:14, marginBottom:20 }}>Please configure subscription plans in the Settings module first.</div>
    </div>
  )

  return (
    <div>
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="page-title">🎯 Subscription Plans</div>
          <div className="page-subtitle">Manage standalone subscription plans and tracking for Workers and Shops</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, background: 'var(--bg-dark)', padding: 4, borderRadius: 10 }}>
            <button className={`btn btn-sm ${activeTab === 'WORKER' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('WORKER')} style={{ background: activeTab !== 'WORKER' && 'transparent', color: activeTab !== 'WORKER' && 'var(--mid)', border: 'none', boxShadow: 'none' }}>👷 Workers</button>
            <button className={`btn btn-sm ${activeTab === 'SHOP' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('SHOP')} style={{ background: activeTab !== 'SHOP' && 'transparent', color: activeTab !== 'SHOP' && 'var(--mid)', border: 'none', boxShadow: 'none' }}>🏪 Shops</button>
          </div>
          <button className="btn btn-primary" onClick={() => setEditPlan({ isNew: true, targetRole: activeTab, name: '', price: 100, durationDays: 30, features: ['Premium feature'] })}>+ New {activeTab === 'WORKER' ? 'Worker' : 'Shop'} Plan</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {plans.filter(p => p.targetRole === activeTab).map(plan => (
          <div key={plan.id} className="card" style={{ padding: 0, overflow: 'hidden', border: `2px solid ${plan.color}25` }}>
            <div style={{ background: `linear-gradient(135deg,${plan.color}18,${plan.color}08)`, padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{plan.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: plan.color }}>{plan.name}</span>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 28, color: 'var(--dark)' }}>
                {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--mid)' }}>/{plan.durationDays} days</span>
              </div>
            </div>
            <div style={{ padding: '14px 20px 20px' }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>{f}</span>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => setEditPlan(plan)}>✏️ Edit Plan</button>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        {['all', 'trial', 'monthly', 'annual', 'expired'].map(f => (
          <button key={f} className={`filter-chip ${subFilter === f ? 'active' : ''}`} onClick={() => setSubFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>{activeTab === 'WORKER' ? 'Worker' : 'Shop'}</th><th>Current Plan</th><th>Start Date</th><th>End Date</th><th>Days Left</th><th>Auto Renew</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.filter(w => w.role === activeTab).map(w => (
                <tr key={w._id} style={{ opacity: w.status === 'expired' ? 0.65 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar avatar-sm" style={{ background: w.role === 'SHOP' ? 'linear-gradient(135deg,var(--success),var(--teal))' : 'linear-gradient(135deg,var(--primary),var(--purple))' }}>{(w.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{w.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)' }}>{w.id} · {w.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${w.status === 'expired' ? 'badge-danger' : planColor[w.plan] || 'badge-gray'}`} style={{ fontSize: 11 }}>
                      {w.status === 'expired' ? 'Expired' : w.plan.charAt(0).toUpperCase() + w.plan.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mid)' }}>{w.startDate}</td>
                  <td style={{ fontSize: 12, color: 'var(--mid)' }}>{w.endDate}</td>
                  <td>
                    {w.status === 'expired'
                      ? <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 12 }}>Expired</span>
                      : <span style={{ fontWeight: 700, color: w.daysLeft <= 7 ? 'var(--danger)' : w.daysLeft <= 30 ? 'var(--warning)' : 'var(--success)' }}>{w.daysLeft}d</span>
                    }
                  </td>
                  <td>{w.autoRenew ? <span className="badge badge-success" style={{ fontSize: 10 }}>✓ Yes</span> : <span className="badge badge-gray" style={{ fontSize: 10 }}>No</span>}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => extendSub(w._id)}>+30d</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editPlan && <EditPlanModal plan={editPlan} onSave={savePlan} onClose={() => setEditPlan(null)} />}
    </div>
  )
}
