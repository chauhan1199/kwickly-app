import React, { useState, useEffect } from 'react'
import api from '../../services/api'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savedMsg, setSavedMsg] = useState('')
  const [activeTab, setActiveTab] = useState('fees')

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
    } catch (e) { console.error(e) }
  }

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/settings')
      if (response.data.status === 'success') {
        setSettings(response.data.data)
      }
    } catch (e) {
      console.error('Error fetching settings:', e)
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
      console.error('Error saving setting:', e)
    }
  }

  const tabs = [
    { key: 'fees', label: '💰 Fees & Payments' },
    { key: 'wallet', label: '👛 Wallet Config' },
    { key: 'radius', label: '📍 Search Radius' },
    { key: 'otp', label: '🔐 Security (OTP)' },
    { key: 'branding', label: '🏷️ Branding' },
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
            <div className="grid-2" style={{ marginBottom: 20 }}>
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
            </div>

            <div className="alert alert-info">
              ℹ️ When a customer pays ₹350 for a job, the platform deducts ₹{settings.feeAmount} as commission and ₹{350 - Number(settings.feeAmount)} is transferred to the worker.
            </div>

            <div className="settings-section-title" style={{ marginTop: 24 }}>Payment Options</div>
            <div className="settings-row">
              <div>
                <div className="settings-label">QR Code Expiry</div>
                <div className="settings-hint">Time in minutes before the Razorpay QR code expires</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" className="form-control" style={{ width: 80 }} value={settings.qrExpiry} onChange={e => set('qrExpiry', e.target.value)} />
                <span style={{ fontSize: 12, color: 'var(--mid)' }}>min</span>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Cash Payments</div>
                <div className="settings-hint">Allow customers to pay with cash at the time of service</div>
              </div>
              <button className={`toggle ${settings.cashEnabled ? 'on' : ''}`} onClick={() => set('cashEnabled', !settings.cashEnabled)} />
            </div>
          </div>
        )}

        {/* WALLET & TRIAL */}
        {activeTab === 'wallet' && (
          <div>
            <div className="settings-section-title">Worker Wallet Configuration</div>
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

            <div className="settings-section-title" style={{ marginTop: 24 }}>Free Trial</div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Trial Duration</div>
                <div className="settings-hint">Number of free days for newly registered workers</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" className="form-control" style={{ width: 80 }} value={settings.trialDays} onChange={e => set('trialDays', e.target.value)} />
                <span style={{ fontSize: 12, color: 'var(--mid)' }}>days</span>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginTop: 16 }}>
              ℹ️ Workers in their free trial period are exempt from the wallet minimum requirement. Subscription plan pricing and features are managed in the dedicated Subscriptions module.
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

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Broadcast Rounds</div>
              {[
                { round: 1, range: '0 – 5 km', wait: settings.radiusRound1Wait, key: 'radiusRound1Wait' },
                { round: 2, range: '5 – 10 km', wait: settings.radiusRound2Wait, key: 'radiusRound2Wait' },
                { round: 3, range: '10 – 15 km', wait: '—', key: null },
              ].map((r, i) => (
                <div key={i} className="card" style={{ padding: 16, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                      {r.round}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>Round {r.round}</div>
                      <div style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'var(--font-body)' }}>Broadcast to workers within {r.range}</div>
                    </div>
                    {r.key ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--mid)' }}>Wait</span>
                        <input type="number" className="form-control" style={{ width: 60 }} value={settings[r.key]} onChange={e => set(r.key, e.target.value)} />
                        <span style={{ fontSize: 12, color: 'var(--mid)' }}>min</span>
                      </div>
                    ) : (
                      <span className="badge badge-primary">Final Round</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OTP */}
        {activeTab === 'otp' && (
          <div>
            <div className="settings-section-title">OTP Configuration (Login & Verification)</div>
            <div className="grid-2" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">OTP Validity Duration (minutes)</label>
                <input type="number" className="form-control" value={settings.otpValidity} onChange={e => set('otpValidity', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Maximum Attempts Allowed</label>
                <input type="number" className="form-control" value={settings.otpMaxAttempts} onChange={e => set('otpMaxAttempts', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Resend Cooldown (seconds)</label>
                <input type="number" className="form-control" value={settings.otpResendCooldown} onChange={e => set('otpResendCooldown', e.target.value)} />
              </div>
            </div>
            <div className="alert alert-info">
              ℹ️ OTPs are sent via SMS and WhatsApp. These settings apply to both login OTPs and Arrival/Completion verification OTPs.
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
                          } catch (err) { console.error(err); }
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
                          } catch (err) { console.error(err); }
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
                onClick={() => set('maintenanceMode', !settings.maintenanceMode)}
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
    </div>
  )
}
