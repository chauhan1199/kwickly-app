import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

export default function Settings() {
  const api = useAbortableRequest();
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
      if (isAbortError(e)) return
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Update local state immediately (no API call)
  const setLocal = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))

  // Persist to server (called on blur for number inputs, or onChange for dropdowns/toggles)
  const save = async (key, val) => {
    const current = val !== undefined ? val : settings[key]
    setSettings(prev => ({ ...prev, [key]: current }))
    try {
      await api.patch('/admin/settings', { [key]: current })
      setSavedMsg('✓ Settings saved and broadcast to all connected clients via Socket.io')
      setTimeout(() => setSavedMsg(''), 3500)
    } catch (e) {
      if (isAbortError(e)) return
      showToast('Failed to save setting', 'error')
    }
  }

  // Convenience: immediate save for toggles/selects (old behaviour)
  const set = (key, val) => save(key, val)

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
        {/* FEES & COMMISSIONS */}
        {activeTab === 'fees' && (
          <div>
            <div className="settings-section-title">⚡ Platform Fees, Subscriptions & Taxes</div>
            
            {/* 0% Partner Commission Notice Banner */}
            <div className="alert alert-success" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🛡️</span>
              <div>
                <strong>The 4 Golden Rules: 0% Partner Transaction Commission</strong>
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>
                  Workers receive <strong>100%</strong> of quoted amounts. Shops receive <strong>100%</strong> of net product sales. All platform revenue is generated via Customer Platform Fees + Subscriptions.
                </div>
              </div>
            </div>

            {/* SECTION 1: SERVICE JOBS DYNAMIC TIERED FEE */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                🛠️ Service Jobs Customer Platform Fee Engine
              </div>
              <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 14 }}>
                Calculated dynamically and paid directly by the customer on top of the worker's quote.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Calculation Mode</label>
                  <select className="form-control" value={settings.feeType || 'tiered'} onChange={e => set('feeType', e.target.value)}>
                    <option value="tiered">⚡ Dynamic Tiered (Min Flat &gt; % Above)</option>
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percent">Fixed Percentage (%)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Threshold Amount (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.feeThreshold !== undefined ? settings.feeThreshold : 500}
                    onChange={e => setLocal('feeThreshold', e.target.value)}
                    onBlur={e => save('feeThreshold', Number(e.target.value))}
                    placeholder="500"
                    min="1"
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Quote cutoff (e.g. ₹500)</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Min Fee Under Threshold (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.feeMinAmount !== undefined ? settings.feeMinAmount : 50}
                    onChange={e => setLocal('feeMinAmount', e.target.value)}
                    onBlur={e => save('feeMinAmount', Number(e.target.value))}
                    placeholder="50"
                    min="0"
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Min fee if quote &le; threshold</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Percentage Above Threshold (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.feePercentage !== undefined ? settings.feePercentage : 12}
                    onChange={e => setLocal('feePercentage', e.target.value)}
                    onBlur={e => save('feePercentage', Number(e.target.value))}
                    placeholder="12"
                    min="0"
                    max="100"
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Fee % if quote &gt; threshold</div>
                </div>

                <div className="form-group">
                  <label className="form-label">GST on Platform Fee (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.gstPercentage !== undefined ? settings.gstPercentage : 18}
                    onChange={e => setLocal('gstPercentage', e.target.value)}
                    onBlur={e => save('gstPercentage', Number(e.target.value))}
                    placeholder="18"
                    min="0"
                    max="100"
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Tracked in separate Tax Ledger</div>
                </div>
              </div>
            </div>

            {/* SECTION 2: SHOP ORDERS PLATFORM FEE */}
            <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                🛒 Shop Orders Customer Platform Fee Engine
              </div>
              <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 14 }}>
                Customer convenience fee on grocery & product orders. Shop receives 100% of product sales.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Shop Order Fee (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.shopOrderFeePct !== undefined ? settings.shopOrderFeePct : 5}
                    onChange={e => setLocal('shopOrderFeePct', e.target.value)}
                    onBlur={e => save('shopOrderFeePct', Number(e.target.value))}
                    placeholder="5"
                    min="0"
                    max="100"
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>% on Net Product Sales (e.g. 5%)</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Shop Platform Fee (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.shopOrderMinFee !== undefined ? settings.shopOrderMinFee : 10}
                    onChange={e => setLocal('shopOrderMinFee', e.target.value)}
                    onBlur={e => save('shopOrderMinFee', Number(e.target.value))}
                    placeholder="10"
                    min="0"
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Floor fee per order</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Shop Commission (%)</label>
                  <input
                    type="text"
                    className="form-control"
                    value="0% (Subscription Model)"
                    disabled
                    style={{ background: 'var(--input-bg)', color: '#10B981', fontWeight: 700 }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>100% sales payout to shop</div>
                </div>
              </div>
            </div>

            {/* Live Pricing Breakdown Preview */}
            <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                💡 Live Pricing Preview & Examples
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {(() => {
                  const threshold = settings.feeThreshold !== undefined ? Number(settings.feeThreshold) : 500;
                  const minFee = settings.feeMinAmount !== undefined ? Number(settings.feeMinAmount) : 50;
                  const pct = settings.feePercentage !== undefined ? Number(settings.feePercentage) : 12;
                  const gstPct = settings.gstPercentage !== undefined ? Number(settings.gstPercentage) : 18;
                  const mode = settings.feeType || 'tiered';

                  const calc = (amount) => {
                    let fee = 0;
                    if (mode === 'tiered') {
                      fee = amount <= threshold ? minFee : Math.max(minFee, Math.round((amount * pct) / 100));
                    } else if (mode === 'percent') {
                      fee = Math.round((amount * pct) / 100);
                    } else {
                      fee = minFee || settings.feeAmount || 50;
                    }
                    const gst = Math.round((fee * gstPct) / 100);
                    return { worker: amount, fee, gst, total: amount + fee + gst };
                  };

                  const ex1 = calc(300);
                  const ex2 = calc(1000);

                  return (
                    <>
                      <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 6 }}>Example A: Small Job (₹300 Quote)</div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>Worker Payout:</span><strong>₹{ex1.worker}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>Platform Fee:</span><strong>₹{ex1.fee} {mode === 'tiered' ? '(Min Fee)' : ''}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>GST ({gstPct}%):</span><strong>₹{ex1.gst}</strong>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}>
                          <span>Customer Pays:</span><strong>₹{ex1.total}</strong>
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6', marginBottom: 6 }}>Example B: Large Job (₹1,000 Quote)</div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>Worker Payout:</span><strong>₹{ex2.worker}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>Platform Fee:</span><strong>₹{ex2.fee} {mode === 'tiered' ? `(${pct}%)` : ''}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>GST ({gstPct}%):</span><strong>₹{ex2.gst}</strong>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}>
                          <span>Customer Pays:</span><strong>₹{ex2.total}</strong>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
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
                <input
                  type="number"
                  className="form-control"
                  style={{ width: 100 }}
                  value={settings.freeTrialDays}
                  onChange={e => setLocal('freeTrialDays', e.target.value)}
                  onBlur={e => save('freeTrialDays', Number(e.target.value))}
                  min="0" max="365"
                />
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
                <input
                  type="number"
                  className="form-control"
                  style={{ width: 100 }}
                  value={settings.walletMinimum}
                  onChange={e => setLocal('walletMinimum', e.target.value)}
                  onBlur={e => save('walletMinimum', Number(e.target.value))}
                  min="0"
                />
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
                            } else {
                              showToast('Logo upload failed', 'error')
                            }
                          } catch (err) {
                            if (!isAbortError(err)) showToast(extractErrorMessage(err, 'Logo upload failed'), 'error')
                          }
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
                            } else {
                              showToast('Icon upload failed', 'error')
                            }
                          } catch (err) {
                            if (!isAbortError(err)) showToast(extractErrorMessage(err, 'Icon upload failed'), 'error')
                          }
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
