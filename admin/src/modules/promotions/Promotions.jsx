import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import {
  Plus, RefreshCw, Edit3, Trash2, Eye, Tag, Image, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle, XCircle, TrendingUp, Users, Calendar, Link as LinkIcon,
  MapPin, Percent, DollarSign, Hash, ArrowUpRight, Megaphone, Gift
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const BANNER_POSITIONS = [
  { value: 'HOME_TOP',      label: 'Home — Top Carousel' },
  { value: 'HOME_MIDDLE',   label: 'Home — Middle Section' },
  { value: 'SHOP_PAGE',     label: 'Shop Page' },
  { value: 'CATEGORY_PAGE', label: 'Category Page' },
]
const LINK_TYPES = [
  { value: 'NONE',     label: 'No Link' },
  { value: 'SHOP',     label: 'Shop' },
  { value: 'PRODUCT',  label: 'Product' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'EXTERNAL', label: 'External URL' },
]
const PROMO_TYPES = [
  { value: 'FLAT_DISCOUNT',       label: 'Flat Discount (₹)', icon: '₹' },
  { value: 'PERCENTAGE_DISCOUNT', label: 'Percentage Discount (%)', icon: '%' },
  { value: 'FREE_DELIVERY',       label: 'Free Delivery', icon: '🚚' },
  { value: 'FIRST_ORDER',         label: 'First Order Bonus', icon: '🎁' },
  { value: 'CASHBACK',            label: 'Cashback', icon: '💰' },
]

const emptyBanner = {
  title: '', subtitle: '', imageUrl: '', linkType: 'NONE', linkValue: '',
  position: 'HOME_TOP', isActive: true, priority: 0,
  startAt: '', endAt: ''
}
const emptyPromo = {
  code: '', title: '', description: '', type: 'FLAT_DISCOUNT',
  value: '', minOrderAmount: 0, maxDiscountCap: '',
  maxUsesTotal: 100, maxUsesPerUser: 1,
  startAt: '', endAt: '', isActive: true
}

// ─── Validators ───────────────────────────────────────────────────────────────
function validateBanner(f) {
  const errors = {}
  if (!f.title || !f.title.trim())     errors.title    = 'Title is required'
  if (!f.imageUrl || !f.imageUrl.trim()) errors.imageUrl = 'Image URL is required'
  if (f.imageUrl && !/^https?:\/\/.+/.test(f.imageUrl.trim())) errors.imageUrl = 'Enter a valid URL (starts with http/https)'
  if (f.priority < 0 || f.priority > 100) errors.priority = 'Priority must be 0–100'
  if (f.linkType !== 'NONE' && !f.linkValue?.trim()) errors.linkValue = 'Link value is required when a link type is selected'
  return errors
}
function validatePromo(f) {
  const errors = {}
  if (!f.code || !f.code.trim())  errors.code  = 'Promo code is required'
  if (f.code && !/^[A-Z0-9_]{3,20}$/.test(f.code.trim().toUpperCase())) errors.code = 'Code: 3–20 uppercase letters/numbers/underscores'
  if (!f.title || !f.title.trim()) errors.title = 'Title is required'
  if (f.value === '' || f.value === null || isNaN(Number(f.value)) || Number(f.value) <= 0) errors.value = 'Enter a valid positive value'
  if (f.type === 'PERCENTAGE_DISCOUNT' && Number(f.value) > 100) errors.value = 'Percentage cannot exceed 100'
  if (f.minOrderAmount < 0) errors.minOrderAmount = 'Min order amount cannot be negative'
  if (f.maxUsesTotal < 1) errors.maxUsesTotal = 'Total uses must be at least 1'
  if (f.maxUsesPerUser < 1) errors.maxUsesPerUser = 'Per-user uses must be at least 1'
  if (f.endAt && f.startAt && new Date(f.endAt) <= new Date(f.startAt)) errors.endAt = 'End date must be after start date'
  return errors
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 160
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  )
}

function FieldError({ msg }) {
  if (!msg) return null
  return <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
    <AlertCircle size={12} />{msg}
  </div>
}

function FormField({ label, required, children, error, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</div>}
      <FieldError msg={error} />
    </div>
  )
}

function Input({ error, ...props }) {
  return (
    <input
      {...props}
      style={{
        background: 'var(--input-bg, #1a1a2e)', border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
        borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14,
        outline: 'none', width: '100%', transition: 'border-color 0.2s', boxSizing: 'border-box',
        ...props.style
      }}
      onFocus={e => { e.target.style.borderColor = error ? '#ef4444' : 'var(--accent)' }}
      onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : 'var(--border)' }}
    />
  )
}

function Select({ error, children, ...props }) {
  return (
    <select
      {...props}
      style={{
        background: 'var(--input-bg, #1a1a2e)', border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
        borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14,
        outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer'
      }}
    >{children}</select>
  )
}

function Textarea({ error, ...props }) {
  return (
    <textarea
      {...props}
      style={{
        background: 'var(--input-bg, #1a1a2e)', border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
        borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14,
        outline: 'none', width: '100%', resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
        fontFamily: 'inherit'
      }}
    />
  )
}

// ─── Banner Form Modal ─────────────────────────────────────────────────────────
function BannerFormModal({ open, onClose, editing, onSaved, showToast, api }) {
  const [form, setForm] = useState(editing ? { ...emptyBanner, ...editing } : { ...emptyBanner })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(editing ? {
      ...emptyBanner, ...editing,
      startAt: editing.startAt ? editing.startAt.split('T')[0] : '',
      endAt:   editing.endAt   ? editing.endAt.split('T')[0]   : '',
    } : { ...emptyBanner })
    setErrors({})
  }, [editing, open])

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: null })) }

  const handleSave = async () => {
    const errs = validateBanner(form)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) { showToast(Object.values(errs).find(Boolean), 'error'); return }
    setSaving(true)
    try {
      const payload = { ...form, priority: Number(form.priority) }
      if (!payload.startAt) delete payload.startAt
      if (!payload.endAt)   delete payload.endAt
      if (editing) await api.patch(`/promotions/banners/${editing._id}`, payload)
      else         await api.post('/promotions/banners', payload)
      showToast(`Banner ${editing ? 'updated' : 'created'} successfully`)
      try { await api.post('/admin/notifications/broadcast', { title: editing ? 'Banner Updated' : 'Banner Created', message: `Admin ${editing ? 'updated' : 'created'} banner "${form.title}" (${form.position})`, targetRole: 'ADMIN' }) } catch {}
      window.dispatchEvent(new Event('admin-action'))
      onSaved()
      onClose()
    } catch (e) { showToast(extractErrorMessage(e, 'Save failed'), 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Banner' : 'Add Banner'} width="620px">
      <div>
        {/* Banner Preview */}
        {form.imageUrl && /^https?:\/\/.+/.test(form.imageUrl) && (
          <div style={{ marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', height: 120 }}>
            <img src={form.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {form.title && <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{form.title}</div>}
              {form.subtitle && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{form.subtitle}</div>}
            </div>
            <div style={{ position: 'absolute', top: 8, right: 8, background: '#0d0d1a', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#6366f1', fontWeight: 600 }}>PREVIEW</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="Title" required error={errors.title}>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer Sale — 30% Off" error={errors.title} />
          </FormField>
          <FormField label="Subtitle" error={errors.subtitle}>
            <Input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="e.g. Valid this weekend only" />
          </FormField>
          <div style={{ gridColumn: '1/-1' }}>
            <FormField label="Image URL" required error={errors.imageUrl} hint="Use a 16:5 ratio image for best results (e.g. Unsplash URL)">
              <Input value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="https://images.unsplash.com/..." error={errors.imageUrl} />
            </FormField>
          </div>
          <FormField label="Position" required>
            <Select value={form.position} onChange={e => set('position', e.target.value)}>
              {BANNER_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Priority" hint="Higher = shown first (0–100)">
            <Input type="number" value={form.priority} min={0} max={100} onChange={e => set('priority', parseInt(e.target.value) || 0)} error={errors.priority} />
          </FormField>
          <FormField label="Link Type">
            <Select value={form.linkType} onChange={e => set('linkType', e.target.value)}>
              {LINK_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </FormField>
          {form.linkType !== 'NONE' && (
            <FormField label={`${form.linkType === 'EXTERNAL' ? 'External URL' : form.linkType + ' ID'}`} required error={errors.linkValue}>
              <Input value={form.linkValue} onChange={e => set('linkValue', e.target.value)} placeholder={form.linkType === 'EXTERNAL' ? 'https://...' : 'Enter ID'} error={errors.linkValue} />
            </FormField>
          )}
          <FormField label="Start Date">
            <Input type="date" value={form.startAt} onChange={e => set('startAt', e.target.value)} />
          </FormField>
          <FormField label="End Date" error={errors.endAt}>
            <Input type="date" value={form.endAt} onChange={e => set('endAt', e.target.value)} error={errors.endAt} />
          </FormField>
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => set('isActive', !form.isActive)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {form.isActive
                ? <ToggleRight size={28} color="#22c55e" />
                : <ToggleLeft size={28} color="var(--text-muted)" />}
              <span style={{ fontSize: 14, color: form.isActive ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                {form.isActive ? 'Active — Visible on mobile app' : 'Inactive — Hidden from customers'}
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '9px 20px' }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '9px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <span className="spinner-sm" /> : <CheckCircle size={15} />}
            {editing ? 'Update Banner' : 'Create Banner'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Promo Form Modal ──────────────────────────────────────────────────────────
function PromoFormModal({ open, onClose, editing, onSaved, showToast, api }) {
  const [form, setForm] = useState(editing ? { ...emptyPromo, ...editing } : { ...emptyPromo })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(editing ? {
      ...emptyPromo, ...editing,
      startAt: editing.startAt ? editing.startAt.split('T')[0] : '',
      endAt:   editing.endAt   ? editing.endAt.split('T')[0]   : '',
    } : { ...emptyPromo })
    setErrors({})
  }, [editing, open])

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: null })) }

  const handleSave = async () => {
    const f = { ...form, code: form.code.trim().toUpperCase() }
    const errs = validatePromo(f)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) { showToast(Object.values(errs).find(Boolean), 'error'); return }
    setSaving(true)
    try {
      const payload = {
        code: f.code, title: f.title, description: f.description,
        type: f.type, value: Number(f.value),
        minOrderAmount: Number(f.minOrderAmount) || 0,
        maxDiscountCap: f.maxDiscountCap ? Number(f.maxDiscountCap) : undefined,
        maxUsesTotal: Number(f.maxUsesTotal) || 100,
        maxUsesPerUser: Number(f.maxUsesPerUser) || 1,
        isActive: f.isActive,
      }
      if (f.startAt) payload.startAt = f.startAt
      if (f.endAt)   payload.endAt   = f.endAt
      if (editing) await api.patch(`/promotions/promotions/${editing._id}`, payload)
      else         await api.post('/promotions/promotions', payload)
      showToast(`Promo code ${editing ? 'updated' : 'created'} successfully`)
      try { await api.post('/admin/notifications/broadcast', { title: editing ? 'Promo Updated' : 'Promo Code Created', message: `Admin ${editing ? 'updated' : 'created'} promo "${f.code}" — ${f.title} (${f.type})`, targetRole: 'ADMIN' }) } catch {}
      window.dispatchEvent(new Event('admin-action'))
      onSaved()
      onClose()
    } catch (e) { showToast(extractErrorMessage(e, 'Save failed'), 'error') }
    finally { setSaving(false) }
  }

  const promoType = PROMO_TYPES.find(p => p.value === form.type)
  const isPercent = form.type === 'PERCENTAGE_DISCOUNT'

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Promo Code' : 'Create Promo Code'} width="640px">
      <div>
        {/* Code preview pill */}
        {form.code && (
          <div style={{ marginBottom: 20, background: '#f59e0b11', border: '1px dashed #f59e0b55', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag size={16} color="#f59e0b" />
            <code style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: '#f59e0b' }}>{form.code.toUpperCase()}</code>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{promoType?.label}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="Promo Code" required error={errors.code} hint="Uppercase letters, numbers, underscores only">
            <Input
              value={form.code} onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,''))}
              placeholder="e.g. SUMMER50" maxLength={20} error={errors.code}
              style={{ fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700, fontSize: 15 }}
            />
          </FormField>
          <FormField label="Title" required error={errors.title}>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer Sale 50% Off" error={errors.title} />
          </FormField>
          <div style={{ gridColumn: '1/-1' }}>
            <FormField label="Description (optional)">
              <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Get 50% off up to ₹200 on all salon services" />
            </FormField>
          </div>
          <FormField label="Discount Type" required>
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              {PROMO_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </FormField>
          <FormField label={isPercent ? 'Discount (%)' : 'Discount Amount (₹)'} required error={errors.value}>
            <div style={{ position: 'relative' }}>
              <Input type="number" value={form.value} onChange={e => set('value', e.target.value)} placeholder={isPercent ? '50' : '100'} min={1} max={isPercent ? 100 : undefined} error={errors.value} style={{ paddingLeft: 36 }} />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>{isPercent ? '%' : '₹'}</span>
            </div>
          </FormField>
          {isPercent && (
            <FormField label="Max Discount Cap (₹)" hint="Leave empty for no cap">
              <div style={{ position: 'relative' }}>
                <Input type="number" value={form.maxDiscountCap} onChange={e => set('maxDiscountCap', e.target.value)} placeholder="e.g. 200" min={0} style={{ paddingLeft: 36 }} />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
              </div>
            </FormField>
          )}
          <FormField label="Min Order Amount (₹)" error={errors.minOrderAmount}>
            <div style={{ position: 'relative' }}>
              <Input type="number" value={form.minOrderAmount} onChange={e => set('minOrderAmount', e.target.value)} placeholder="0" min={0} error={errors.minOrderAmount} style={{ paddingLeft: 36 }} />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
            </div>
          </FormField>
          <FormField label="Total Usage Limit" error={errors.maxUsesTotal}>
            <Input type="number" value={form.maxUsesTotal} onChange={e => set('maxUsesTotal', e.target.value)} placeholder="100" min={1} error={errors.maxUsesTotal} />
          </FormField>
          <FormField label="Uses Per User" error={errors.maxUsesPerUser}>
            <Input type="number" value={form.maxUsesPerUser} onChange={e => set('maxUsesPerUser', e.target.value)} placeholder="1" min={1} error={errors.maxUsesPerUser} />
          </FormField>
          <FormField label="Start Date">
            <Input type="date" value={form.startAt} onChange={e => set('startAt', e.target.value)} />
          </FormField>
          <FormField label="End Date" error={errors.endAt}>
            <Input type="date" value={form.endAt} onChange={e => set('endAt', e.target.value)} error={errors.endAt} />
          </FormField>
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => set('isActive', !form.isActive)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {form.isActive
                ? <ToggleRight size={28} color="#22c55e" />
                : <ToggleLeft size={28} color="var(--text-muted)" />}
              <span style={{ fontSize: 14, color: form.isActive ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                {form.isActive ? 'Active — Customers can use this code' : 'Inactive — Code is disabled'}
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '9px 20px' }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '9px 24px', display: 'flex', alignItems: 'center', gap: 8, background: '#f59e0b', borderColor: '#f59e0b' }}>
            {saving ? <span className="spinner-sm" /> : <CheckCircle size={15} />}
            {editing ? 'Update Promo' : 'Create Promo'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Promo Analytics Modal ─────────────────────────────────────────────────────
function PromoViewModal({ promo, onClose }) {
  if (!promo) return null
  const usedPct = promo.maxUsesTotal ? Math.round((promo.usesCount || 0) / promo.maxUsesTotal * 100) : 0
  const isExpired = promo.endAt && new Date(promo.endAt) < new Date()
  const promoType = PROMO_TYPES.find(p => p.value === promo.type)

  return (
    <Modal open={true} onClose={onClose} title={`Promo Code: ${promo.code}`} width="500px">
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f59e0b22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>{promoType?.icon || '🎁'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#f59e0b', display: 'block' }}>{promo.code}</code>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{promo.title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isExpired ? '#ef444422' : promo.isActive ? '#22c55e22' : '#94a3b822', color: isExpired ? '#ef4444' : promo.isActive ? '#22c55e' : '#94a3b8' }}>
              {isExpired ? 'Expired' : promo.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Usage bar */}
        <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Usage</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{promo.usesCount || 0} / {promo.maxUsesTotal || '∞'}</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(usedPct, 100)}%`, background: usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#22c55e', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{usedPct}% of total uses redeemed</div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Type', value: promoType?.label || promo.type },
            { label: 'Value', value: promo.type === 'PERCENTAGE_DISCOUNT' ? `${promo.value}%` : `₹${promo.value}` },
            { label: 'Min Order', value: promo.minOrderAmount ? `₹${promo.minOrderAmount}` : 'None' },
            { label: 'Cap', value: promo.maxDiscountCap ? `₹${promo.maxDiscountCap}` : 'No cap' },
            { label: 'Per User', value: `Max ${promo.maxUsesPerUser} uses` },
            { label: 'Created', value: new Date(promo.createdAt).toLocaleDateString('en-IN') },
            { label: 'Start', value: promo.startAt ? new Date(promo.startAt).toLocaleDateString('en-IN') : 'Immediately' },
            { label: 'Expires', value: promo.endAt ? new Date(promo.endAt).toLocaleDateString('en-IN') : 'Never' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
        {promo.description && (
          <div style={{ background: 'var(--card)', borderRadius: 8, padding: '10px 14px', marginTop: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Description (shown to customer)</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{promo.description}</div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Banner View Modal ─────────────────────────────────────────────────────────
function BannerViewModal({ banner, onClose }) {
  if (!banner) return null
  const isActive = banner.isActive && (!banner.endAt || new Date(banner.endAt) > new Date()) && (!banner.startAt || new Date(banner.startAt) <= new Date())

  return (
    <Modal open={true} onClose={onClose} title="Banner Details" width="480px">
      <div>
        {/* Image preview */}
        <div style={{ borderRadius: 10, overflow: 'hidden', height: 140, background: '#111', marginBottom: 16, position: 'relative' }}>
          <img src={banner.imageUrl} alt={banner.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 14px' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{banner.title}</div>
            {banner.subtitle && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{banner.subtitle}</div>}
          </div>
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isActive ? '#22c55e33' : '#94a3b822', color: isActive ? '#22c55e' : '#94a3b8' }}>
              {isActive ? '● Live' : '○ Inactive'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Position', value: BANNER_POSITIONS.find(p => p.value === banner.position)?.label || banner.position },
            { label: 'Priority', value: banner.priority ?? 0 },
            { label: 'Link Type', value: LINK_TYPES.find(l => l.value === banner.linkType)?.label || banner.linkType },
            { label: 'Link Value', value: banner.linkValue || '—' },
            { label: 'Start', value: banner.startAt ? new Date(banner.startAt).toLocaleDateString('en-IN') : 'Immediately' },
            { label: 'Expires', value: banner.endAt ? new Date(banner.endAt).toLocaleDateString('en-IN') : 'Never' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Promotions() {
  const api = useAbortableRequest()
  const [banners, setBanners] = useState([])
  const [promos,  setPromos]  = useState([])
  const [tab, setTab]         = useState('banners')
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState(null)
  const [confirm, setConfirm] = useState(null)

  // Modals
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [editBanner, setEditBanner]         = useState(null)
  const [viewBanner, setViewBanner]         = useState(null)

  const [showPromoForm, setShowPromoForm] = useState(false)
  const [editPromo, setEditPromo]         = useState(null)
  const [viewPromo, setViewPromo]         = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [b, p] = await Promise.all([
        api.get('/promotions/banners/all').catch(() => api.get('/admin/promotions/banners/all')).catch(() => ({ data: { data: [] } })),
        api.get('/promotions/promotions').catch(() => api.get('/admin/promotions/promotions')).catch(() => ({ data: { data: [] } })),
      ])
      const bannerList = b.data?.data?.banners || b.data?.data || []
      const promoList = p.data?.data?.promotions || p.data?.data || []
      setBanners(Array.isArray(bannerList) ? bannerList : [])
      setPromos(Array.isArray(promoList) ? promoList : [])
    } catch (err) {
      if (isAbortError(err)) return
      showToast('Failed to load data', 'error')
    }
    setLoading(false)
  }

  const handleDelete = async (type, id, name) => {
    setConfirm({
      message: `Delete "${name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          const url = type === 'banner' ? `/promotions/banners/${id}` : `/promotions/promotions/${id}`
          await api.delete(url)
          showToast(`${type === 'banner' ? 'Banner' : 'Promo'} deleted`)
          try { await api.post('/admin/notifications/broadcast', { title: type === 'banner' ? 'Banner Deleted' : 'Promo Code Deleted', message: `Admin deleted ${type} "${name}"`, targetRole: 'ADMIN' }) } catch {}
          window.dispatchEvent(new Event('admin-action'))
          loadData()
        } catch { showToast('Delete failed', 'error') }
      }
    })
  }

  const handleTogglePromo = async (promo) => {
    try {
      await api.patch(`/promotions/promotions/${promo._id}`, { isActive: !promo.isActive })
      const action = promo.isActive ? 'disabled' : 'enabled'
      showToast(`Promo ${action}`)
      try { await api.post('/admin/notifications/broadcast', { title: `Promo Code ${action.charAt(0).toUpperCase() + action.slice(1)}`, message: `Admin ${action} promo code "${promo.code}"`, targetRole: 'ADMIN' }) } catch {}
      window.dispatchEvent(new Event('admin-action'))
      loadData()
    } catch { showToast('Toggle failed', 'error') }
  }

  const handleToggleBanner = async (banner) => {
    try {
      await api.patch(`/promotions/banners/${banner._id}`, { isActive: !banner.isActive })
      const action = banner.isActive ? 'hidden' : 'activated'
      showToast(`Banner ${action}`)
      try { await api.post('/admin/notifications/broadcast', { title: `Banner ${action.charAt(0).toUpperCase() + action.slice(1)}`, message: `Admin ${action} banner "${banner.title}"`, targetRole: 'ADMIN' }) } catch {}
      window.dispatchEvent(new Event('admin-action'))
      loadData()
    } catch { showToast('Toggle failed', 'error') }
  }

  // Stats
  const activeBanners  = banners.filter(b => b.isActive).length
  const activePromos   = promos.filter(p => p.isActive).length
  const totalUses      = promos.reduce((a, p) => a + (p.usesCount || 0), 0)
  const expiredPromos  = promos.filter(p => p.endAt && new Date(p.endAt) < new Date()).length

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Promotions &amp; Banners</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Manage banners and promo codes displayed to customers on the mobile app
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} />Refresh
          </button>
          {tab === 'banners'
            ? <button className="btn btn-primary" onClick={() => { setEditBanner(null); setShowBannerForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} />Add Banner
              </button>
            : <button className="btn btn-primary" onClick={() => { setEditPromo(null); setShowPromoForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f59e0b', borderColor: '#f59e0b' }}>
                <Plus size={15} />Add Promo Code
              </button>
          }
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard icon={Image}       label="Total Banners"    value={banners.length}  color="#6366f1" />
        <StatCard icon={Megaphone}   label="Active Banners"   value={activeBanners}   color="#22c55e" />
        <StatCard icon={Gift}        label="Total Promos"      value={promos.length}   color="#f59e0b" />
        <StatCard icon={TrendingUp}  label="Active Codes"      value={activePromos}    color="#06b6d4" />
        <StatCard icon={Users}       label="Total Redemptions" value={totalUses}       color="#a855f7" />
        <StatCard icon={Calendar}    label="Expired Codes"     value={expiredPromos}   color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--card)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {[
          { key: 'banners', label: `Banners`, icon: Image, count: banners.length, color: '#6366f1' },
          { key: 'promos',  label: `Promo Codes`, icon: Tag, count: promos.length,  color: '#f59e0b' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
            background: tab === t.key ? (t.key === 'banners' ? '#6366f122' : '#f59e0b22') : 'transparent',
            color: tab === t.key ? (t.key === 'banners' ? '#6366f1' : '#f59e0b') : 'var(--text-muted)',
          }}>
            <t.icon size={14} />
            {t.label}
            <span style={{ background: tab === t.key ? (t.key === 'banners' ? '#6366f133' : '#f59e0b33') : 'var(--border)', borderRadius: 20, padding: '1px 8px', fontSize: 11 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : tab === 'banners' ? (
          /* ─ BANNERS TABLE ─ */
          banners.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Image size={48} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No banners yet</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Create your first banner to promote offers on the mobile app</div>
              <button className="btn btn-primary" onClick={() => { setEditBanner(null); setShowBannerForm(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} />Create Banner
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Banner</th>
                  <th>Position</th>
                  <th>Priority</th>
                  <th>Validity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map(b => {
                  const isLive = b.isActive && (!b.endAt || new Date(b.endAt) > new Date()) && (!b.startAt || new Date(b.startAt) <= new Date())
                  return (
                    <tr key={b._id} style={{ cursor: 'pointer' }} onClick={() => setViewBanner(b)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 64, height: 36, borderRadius: 6, overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                            <img src={b.imageUrl} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                          </div>
                          <div>
                            <div className="cell-primary">{b.title}</div>
                            {b.subtitle && <div className="cell-muted" style={{ fontSize: 11 }}>{b.subtitle}</div>}
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-info" style={{ fontSize: 11 }}>{BANNER_POSITIONS.find(p => p.value === b.position)?.label || b.position}</span></td>
                      <td><strong>{b.priority ?? 0}</strong></td>
                      <td className="cell-muted" style={{ fontSize: 12 }}>
                        {b.startAt || b.endAt
                          ? `${b.startAt ? new Date(b.startAt).toLocaleDateString('en-IN', {day:'numeric',month:'short'}) : 'Now'} → ${b.endAt ? new Date(b.endAt).toLocaleDateString('en-IN', {day:'numeric',month:'short'}) : '∞'}`
                          : 'Always'}
                      </td>
                      <td>
                        <button onClick={e => { e.stopPropagation(); handleToggleBanner(b) }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isLive
                            ? <><ToggleRight size={22} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>Live</span></>
                            : <><ToggleLeft size={22} color="#94a3b8" /><span style={{ color: '#94a3b8', fontSize: 12 }}>Off</span></>}
                        </button>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-btns">
                          <button className="btn-icon" title="View" onClick={() => setViewBanner(b)}><Eye size={14} /></button>
                          <button className="btn-icon" title="Edit" onClick={() => { setEditBanner(b); setShowBannerForm(true) }}><Edit3 size={14} /></button>
                          <button className="btn-icon danger" title="Delete" onClick={() => handleDelete('banner', b._id, b.title)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          /* ─ PROMOS TABLE ─ */
          promos.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Tag size={48} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No promo codes yet</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Create promo codes your customers can redeem at checkout</div>
              <button className="btn btn-primary" onClick={() => { setEditPromo(null); setShowPromoForm(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f59e0b', borderColor: '#f59e0b' }}>
                <Plus size={14} />Create Promo Code
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Usage</th>
                  <th>Validity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(p => {
                  const isExpired = p.endAt && new Date(p.endAt) < new Date()
                  const usedPct = p.maxUsesTotal ? Math.round((p.usesCount || 0) / p.maxUsesTotal * 100) : 0
                  const promoType = PROMO_TYPES.find(pt => pt.value === p.type)
                  return (
                    <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => setViewPromo(p)}>
                      <td>
                        <code style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#f59e0b', background: '#f59e0b11', padding: '3px 8px', borderRadius: 6 }}>{p.code}</code>
                      </td>
                      <td className="cell-primary">{p.title}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <span>{promoType?.icon}</span>
                          <span className="badge badge-info">{promoType?.label.split('(')[0].trim() || p.type}</span>
                        </span>
                      </td>
                      <td><strong>{p.type === 'PERCENTAGE_DISCOUNT' ? `${p.value}%` : `₹${p.value}`}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span>{p.usesCount || 0}</span><span style={{ color: 'var(--text-muted)' }}>{p.maxUsesTotal || '∞'}</span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(usedPct, 100)}%`, background: usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#22c55e', borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                      <td className="cell-muted" style={{ fontSize: 12 }}>
                        {p.endAt ? new Date(p.endAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : 'No expiry'}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleTogglePromo(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isExpired
                            ? <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>Expired</span>
                            : p.isActive
                              ? <><ToggleRight size={22} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>Active</span></>
                              : <><ToggleLeft size={22} color="#94a3b8" /><span style={{ color: '#94a3b8', fontSize: 12 }}>Off</span></>}
                        </button>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-btns">
                          <button className="btn-icon" title="Analytics" onClick={() => setViewPromo(p)}><Eye size={14} /></button>
                          <button className="btn-icon" title="Edit" onClick={() => { setEditPromo(p); setShowPromoForm(true) }}><Edit3 size={14} /></button>
                          <button className="btn-icon danger" title="Delete" onClick={() => handleDelete('promo', p._id, p.code)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Modals */}
      <BannerFormModal
        open={showBannerForm} onClose={() => { setShowBannerForm(false); setEditBanner(null) }}
        editing={editBanner} onSaved={loadData} showToast={showToast} api={api}
      />
      <PromoFormModal
        open={showPromoForm} onClose={() => { setShowPromoForm(false); setEditPromo(null) }}
        editing={editPromo} onSaved={loadData} showToast={showToast} api={api}
      />
      <BannerViewModal banner={viewBanner} onClose={() => setViewBanner(null)} />
      <PromoViewModal  promo={viewPromo}   onClose={() => setViewPromo(null)} />

      {toast    && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm  && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}
