import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savedMsg, setSavedMsg] = useState('')
  const [activeTab, setActiveTab] = useState('fees')
  const [toast, setToast] = useState(null)
  const [confirmMaintenance, setConfirmMaintenance] = useState(false)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  useEffect(() => {
    fetchSettings()
    fetchHealth()
  }, [])

  const fetchHealth = async () => {
    try {
      const resp = await api.get('/admin/health')
      if (resp.data.status === 'success') {
        setHealth(resp.data.data)
      }
    } catch (e) { /* ignored */ }
  }

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/settings')
      if (response.data.status === 'success') {
        setSettings(response.data.data)
      }
    } catch (e) {
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const set = async (key, val) => {
    const updated = { ...settings, [key]: val }
    setSettings(updated)
    try {
      await api.patch('/admin/settings', { [key]: val })
      setSavedMsg('✓ Settings saved and broadcast to all connected clients via Socket.io')
      setTimeout(() => setSavedMsg(''), 3500)
    } catch (e) {
      showToast('Failed to save setting', 'error')
    }
  }

  const tabs = [
    { key: 'fees', label: '💰 Fees & Payments' },
    { key: 'wallet', label: '👛 Wallet & Trials' },
    { key: 'radius', label: '📍 Search Radius' },
    { key: 'branding', label: '🏷️ Branding' },
    { key: 'legal', label: '📜 Legal & Policies' },
    { key: 'maintenance', label: '🛠 Maintenance' },
  ]

  if (loading || !settings) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:16 }}>
      <div className="loading-spinner" style={{ width:40, height:40, border:'4px solid var(--primary-light)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <div style={{ fontWeight:700, color:'var(--mid)', fontSize:14 }}>Fetching platform configurations...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Platform Settings</div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={fetchSettings}>🔄 Sync from Server</button>
      </div>

      {savedMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {savedMsg}
        </div>
      )}

      {settings.maintenanceMode && (
        <div className="alert alert-danger">
          🚨 <strong>Maintenance Mode is ACTIVE.</strong> New bookings are blocked for all customers.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              font: 'var(--font)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--mid)',
              borderBottom: `2px solid ${activeTab === t.key ? 'var(--primary)' : 'transparent'}`,
              marginBottom: '-2px',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 24 }}>
        {/* FEES */}
        {activeTab === 'fees' && (
          <div>
            <div className="settings-section-title">Platform Commission</div>
            <div className="grid-3" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">Fee Type</label>
                <select className="form-control" value={settings.feeType} onChange={e => set('feeType', e.target.value)}>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fee Amount {settings.feeType === 'flat' ? '(₹)' : '(%)'}</label>
                <input type="number" className="form-control" value={settings.feeAmount} onChange={e => set('feeAmount', e.target.value)} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">GST Percentage (%)</label>
                <input type="number" className="form-control" value={settings.gstPercentage || 18} onChange={e => set('gstPercentage', e.target.value)} min="0" />
              </div>
            </div>

            <div className="alert alert-info">
              ℹ️ When a worker quotes ₹500, the platform adds ₹{settings.feeAmount} {settings.feeType === 'percent' ? `(${settings.feeAmount}%)` : ''} as commission + {settings.gstPercentage || 18}% GST on top. The customer will pay the total amount.
            </div>

          </div>
        )}

        {/* WALLET & TRIAL */}
        {activeTab === 'wallet' && (
          <div>
            <div className="settings-section-title">Worker Wallet & Trial Configuration</div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Worker Free Trial Duration</div>
                <div className="settings-hint">Number of days a worker gets for free upon registration</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" className="form-control" style={{ width: 100 }} value={settings.freeTrialDays} onChange={e => set('freeTrialDays', e.target.value)} />
                <span style={{ fontSize: 12, color: 'var(--mid)' }}>days</span>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Minimum Wallet Balance</div>
                <div className="settings-hint">Workers must maintain this balance to receive job alerts</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>₹</span>
                <input type="number" className="form-control" style={{ width: 100 }} value={settings.walletMinimum} onChange={e => set('walletMinimum', e.target.value)} />
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Quick Top-Up Preset Amounts</div>
                <div className="settings-hint">Comma-separated values shown as shortcuts (e.g., 50,100,200,500)</div>
              </div>
              <input
                type="text"
                className="form-control"
                style={{ width: 220 }}
                value={settings.topupPresets}
                onChange={e => set('topupPresets', e.target.value)}
                placeholder="50,100,200,500"
              />
            </div>
          </div>
        )}

        {/* RADIUS */}
        {activeTab === 'radius' && (
          <div>
            <div className="settings-section-title">Expanding Radius Broadcast Configuration</div>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              ℹ️ When a job is posted, the system broadcasts to workers starting within Round 1. If no quotes are received within the wait time, it expands to Round 2, and so on.
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">Maximum Search Radius</div>
                <div className="settings-hint">If no worker found within this radius, customer is notified</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" className="form-control" style={{ width: 80 }} value={settings.maxRadius} onChange={e => set('maxRadius', e.target.value)} />
                <span style={{ fontSize: 12, color: 'var(--mid)' }}>km</span>
              </div>
            </div>

          </div>
        )}

        {/* BRANDING */}
        {activeTab === 'branding' && (
          <div>
            <div className="settings-section-title">Platform Branding</div>
            <div className="form-group">
              <label className="form-label">Application Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={settings.appName} 
                onChange={e => set('appName', e.target.value)} 
                placeholder="e.g. Kwickly"
              />
              <div className="settings-hint">This name appears in the sidebar, browser title, and notifications.</div>
            </div>

            <div className="grid-2" style={{ marginTop: 24 }}>
              <div className="form-group">
                <label className="form-label">Logo (Wide)</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={settings.logoUrl} 
                    onChange={e => set('logoUrl', e.target.value)} 
                    placeholder="https://example.com/logo.png"
                  />
                  <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                    📁 Upload
                    <input 
                      type="file" 
                      style={{ display: 'none' }} 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('image', file);
                          try {
                            const resp = await api.post('/admin/upload-image', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            if (resp.data.status === 'success') {
                              set('logoUrl', resp.data.data.url);
                            }
                          } catch (err) { /* ignored */ }
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="settings-hint">Used in Sidebar & Login. Best size: 200x50px.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Icon (Square)</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={settings.iconUrl} 
                    onChange={e => set('iconUrl', e.target.value)} 
                    placeholder="https://example.com/icon.png"
                  />
                  <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                    📁 Upload
                    <input 
                      type="file" 
                      style={{ display: 'none' }} 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('image', file);
                          try {
                            const resp = await api.post('/admin/upload-image', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            if (resp.data.status === 'success') {
                              set('iconUrl', resp.data.data.url);
                            }
                          } catch (err) { /* ignored */ }
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="settings-hint">Used for smaller icons. Best size: 64x64px.</div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Preview</div>
              <div className="card" style={{ padding: 20, background: '#111827', display: 'flex', alignItems: 'center', gap: 16 }}>
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo Preview" style={{ height: 32, maxWidth: 150, objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: 'white', fontWeight: 800, fontSize: 20 }}>{settings.appName}</div>
                )}
                <div style={{ color: '#9CA3AF', fontSize: 12 }}>Live Preview in Sidebar</div>
              </div>
            </div>
          </div>
        )}

        {/* LEGAL & POLICIES */}
        {activeTab === 'legal' && (
          <div>
            <div className="settings-section-title">Legal & Policies</div>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              ℹ️ These documents are shown to users during registration.
            </div>

            <div className="form-group">
              <label className="form-label">Terms of Service</label>
              <textarea 
                className="form-control" 
                value={settings.termsOfService || ''} 
                onChange={e => setSettings({...settings, termsOfService: e.target.value})} 
                onBlur={e => set('termsOfService', e.target.value)}
                placeholder="Enter Terms of Service here..."
                rows={10}
              />
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <label className="form-label">Privacy Policy</label>
              <textarea 
                className="form-control" 
                value={settings.privacyPolicy || ''} 
                onChange={e => setSettings({...settings, privacyPolicy: e.target.value})} 
                onBlur={e => set('privacyPolicy', e.target.value)}
                placeholder="Enter Privacy Policy here..."
                rows={10}
              />
            </div>
          </div>
        )}

        {/* MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <div>
            <div className="settings-section-title">Maintenance Mode</div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Enable Maintenance Mode</div>
                <div className="settings-hint">Blocks new bookings. Existing active jobs are not affected.</div>
              </div>
              <button
                className={`toggle ${settings.maintenanceMode ? 'on' : ''}`}
                onClick={() => setConfirmMaintenance(true)}
              />
            </div>

            {settings.maintenanceMode && (
              <>
                <div className="alert alert-danger" style={{ marginTop: 16 }}>
                  🚨 Maintenance mode is currently ACTIVE. Customers will see a maintenance screen.
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Maintenance Message (shown to customers)</label>
                  <textarea
                    className="form-control"
                    value={settings.maintenanceMsg}
                    onChange={e => set('maintenanceMsg', e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}

            <div style={{ marginTop: 24 }}>
              <div className="settings-section-title">Platform Stats</div>
              <div className="grid-3">
                {[
                  { label: 'API Version', value: health?.apiVersion || '—' },
                  { label: 'DB Status', value: health?.dbStatus || '—' },
                  { label: 'Socket.io', value: health?.socketStatus || '—' },
                  { label: 'Connected Clients', value: health?.connectedClients || '—' },
                  { label: 'Jobs Today', value: health?.jobsToday || '0' },
                  { label: 'Uptime', value: health?.uptime || '—' },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontWeight: 700, color: (s.value && typeof s.value === 'string' && s.value.startsWith('✓')) ? 'var(--success)' : 'var(--dark)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-outline" onClick={() => fetchSettings()}>Reset to Default</button>
        <button className="btn btn-primary btn-lg" onClick={() => setSavedMsg('✓ All settings are auto-saved on change')}>💾 Settings Secured</button>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirmMaintenance && (
        <ConfirmModal
          title={settings.maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
          message={settings.maintenanceMode ? 'Disable maintenance mode? New bookings will resume immediately.' : 'Enable maintenance mode? New bookings will be blocked for all customers.'}
          danger={!settings.maintenanceMode}
          confirmText={settings.maintenanceMode ? 'Disable' : 'Enable'}
          onConfirm={() => { set('maintenanceMode', !settings.maintenanceMode); setConfirmMaintenance(false); }}
          onClose={() => setConfirmMaintenance(false)}
        />
      )}
    </div>
  )
}
