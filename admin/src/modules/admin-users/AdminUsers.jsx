import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import Toast from '../../components/Toast'

export default function AdminUsers() {
  const api = useAbortableRequest();
  const [adminInfo, setAdminInfo] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAdminProfile() }, [])

  const fetchAdminProfile = async () => {
    try {
      const res = await api.get('/auth/me')
      if (res.data.status === 'success') {
        setAdminInfo(res.data.data)
        setForm({ name: res.data.data.name || '', email: res.data.data.email || '' })
      }
    } catch (e) { showToast(e.response?.data?.message || 'Failed to load profile', 'error') }
    finally { setLoading(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ message: msg, type })

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      // TODO: Backend needs a dedicated /auth/update-profile endpoint
      const res = await api.patch(`/admin/users/${adminInfo._id}`, { name: form.name, email: form.email })
      if (res.data.status === 'success') {
        setAdminInfo(prev => ({ ...prev, ...form }))
        setEditMode(false)
        showToast('Profile updated successfully')
      }
    } catch (e) { showToast(e.response?.data?.message || 'Update failed', 'error') }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showToast('Passwords do not match')
    }
    if (passwordForm.newPassword.length < 6) {
      return showToast('Password must be at least 6 characters')
    }
    try {
      const res = await api.patch('/auth/set-password', { password: passwordForm.newPassword })
      if (res.data.status === 'success') {
        setShowPasswordChange(false)
        setPasswordForm({ newPassword: '', confirmPassword: '' })
        showToast('Password changed successfully')
      }
    } catch (e) { showToast(e.response?.data?.message || 'Password change failed', 'error') }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading admin profile...</div>

  return (
    <div>
      {toast.message && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">🔐 Admin Profile & Security</div>
          <div className="page-subtitle">Manage your admin account settings</div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: 'white', flexShrink: 0,
          }}>
            {adminInfo?.name ? adminInfo.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'SA'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>{adminInfo?.name || 'Super Admin'}</span>
              <span className="badge badge-success" style={{ fontSize: 11 }}>Active</span>
            </div>
            <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)', fontSize: 13 }}>{adminInfo?.email || 'admin@kwickly.com'}</div>
            <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)', fontSize: 12, marginTop: 2 }}>{adminInfo?.phone}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setEditMode(!editMode)}>
              {editMode ? 'Cancel' : '✏️ Edit Profile'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowPasswordChange(!showPasswordChange)}>
              🔑 Change Password
            </button>
          </div>
        </div>

        {/* Edit Profile Form */}
        {editMode && (
          <form onSubmit={handleUpdateProfile} style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Edit Profile
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>Save Changes</button>
          </form>
        )}

        {/* Change Password Form */}
        {showPasswordChange && (
          <form onSubmit={handleChangePassword} style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: editMode ? 16 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Change Password
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-control" type="password" placeholder="Min 6 characters" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-control" type="password" placeholder="Re-enter password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>Update Password</button>
          </form>
        )}
      </div>

      {/* Permissions Card */}
      <div className="card" style={{ padding: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          Current Permissions
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            'Dashboard', 'Customers', 'Workers', 'Shops', 'Jobs', 'KYC Queue', 'Categories',
            'Payouts', 'Subscriptions', 'Disputes', 'Suggestions', 'Notifications',
            'Reports', 'Ledger', 'Settings',
          ].map(p => (
            <span key={p} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--success-light)', color: '#14532D',
              border: '1px solid #86EFAC', borderRadius: 6,
              padding: '3px 10px', fontSize: 12, fontWeight: 600
            }}>
              ✓ {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
