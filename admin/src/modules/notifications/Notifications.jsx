import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'

const CITIES_LIST = ['Mumbai','Delhi','Bangalore','Ahmedabad','Pune','Chennai','Hyderabad','Kolkata','Jaipur','Surat']

const TEMPLATES = [
  { label:'🎉 Festival/Sale',         title:'Festival Sale is LIVE!',         body:'Big discounts on all services. Use code FESTIVE20 for 20% off. Book now!' },
  { label:'⚡ Summer Service Push',   title:'Beat the Summer Heat!',           body:'AC service starting ₹299. Book today and get same-day appointment.' },
  { label:'👷 Jobs Alert (Workers)', title:'New Jobs Available Near You',     body:'Multiple customers are looking for your service right now. Open the app!' },
  { label:'🔔 KYC Reminder',         title:'Complete Your KYC',               body:'Your KYC documents are pending review. Complete now to start earning.' },
  { label:'💰 Wallet Low (Workers)', title:'Top Up Your Wallet',              body:'Your wallet balance is low. Add ₹200+ to keep receiving job broadcasts.' },
  { label:'⭐ Rate Your Service',     title:'How was your experience?',        body:'Rate your recent service and help us improve quality for everyone.' },
]

function ComposeModal({ onSend, onClose }) {
  const [form, setForm] = useState({ title:'', body:'', target:'customers', city:'all', category:'all', schedule:false, scheduleDate:'', scheduleTime:'' })
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const applyTemplate = (t) => setForm(p=>({...p,title:t.title,body:t.body}))

  const CATEGORIES = ['all','Plumbing','Electrical','AC Service','Cleaning','Carpentry','Painting']
  const estimatedReach = form.target==='customers' ? (form.city==='all'?'~24,000':' ~3,200') : (form.city==='all'?'~480':' ~60')

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div style={{ fontWeight:800, fontSize:16 }}>📣 Compose Notification</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight:'75vh', overflowY:'auto' }}>
          {/* Templates */}
          <div className="form-group">
            <label className="form-label">Quick Templates</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {TEMPLATES.map((t,i)=>(
                <button key={i} className="filter-chip" style={{ fontSize:11 }} onClick={()=>applyTemplate(t)}>{t.label}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-control" placeholder="e.g. Summer AC Offer!" value={form.title} onChange={e=>set('title',e.target.value)} maxLength={65} />
            <div style={{ fontSize:10,color:'var(--light)',textAlign:'right',marginTop:2 }}>{form.title.length}/65</div>
          </div>
          <div className="form-group">
            <label className="form-label">Message Body *</label>
            <textarea className="form-control" placeholder="e.g. Book AC service starting ₹299..." value={form.body} onChange={e=>set('body',e.target.value)} rows={3} maxLength={200} />
            <div style={{ fontSize:10,color:'var(--light)',textAlign:'right',marginTop:2 }}>{form.body.length}/200</div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Send To</label>
              <select className="form-control" value={form.target} onChange={e=>set('target',e.target.value)}>
                <option value="customers">All Customers</option>
                <option value="workers">All Workers</option>
                <option value="both">Everyone</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <select className="form-control" value={form.city} onChange={e=>set('city',e.target.value)}>
                <option value="all">All Cities</option>
                {['Mumbai','Delhi','Bangalore','Ahmedabad','Pune','Chennai','Hyderabad'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Filter by Category (optional)</label>
            <select className="form-control" value={form.category} onChange={e=>set('category',e.target.value)}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c==='all'?'All Categories':c}</option>)}
            </select>
          </div>

          {/* Estimated reach */}
          <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary-mid)', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>📡</span>
            <div>
              <div style={{ fontWeight:700, fontSize:13 }}>Estimated Reach: <span style={{ color:'var(--primary)' }}>{estimatedReach} devices</span></div>
              <div style={{ fontSize:11, color:'var(--mid)', fontFamily:'var(--font-body)' }}>Based on target audience selection</div>
            </div>
          </div>

          {/* Schedule */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <button className={`toggle ${form.schedule?'on':''}`} onClick={()=>set('schedule',!form.schedule)} />
            <span style={{ fontSize:13, fontWeight:600 }}>Schedule for later</span>
          </div>
          {form.schedule&&(
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-control" type="date" value={form.scheduleDate} onChange={e=>set('scheduleDate',e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="form-control" type="time" value={form.scheduleTime} onChange={e=>set('scheduleTime',e.target.value)} />
              </div>
            </div>
          )}

          {/* Phone preview */}
          {(form.title||form.body)&&(
            <div style={{ background:'#1E293B', borderRadius:16, padding:16, marginTop:4 }}>
              <div style={{ fontSize:10, color:'#64748B', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>📱 Device Preview</div>
              <div style={{ background:'white', borderRadius:12, padding:12, boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:24,height:24,background:'linear-gradient(135deg,var(--primary),var(--purple))',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12 }}>🏠</div>
                  <span style={{ fontSize:11, fontWeight:700 }}>Kwickly</span>
                  <span style={{ fontSize:10, color:'var(--light)', marginLeft:'auto' }}>now</span>
                </div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{form.title||'Notification Title'}</div>
                <div style={{ fontSize:11, color:'var(--mid)', fontFamily:'var(--font-body)', lineHeight:1.4 }}>{form.body||'Notification body...'}</div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!form.title||!form.body} onClick={()=>onSend(form)}>
            {form.schedule?'⏰ Schedule':'📣 Send Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ... ComposeModal ...

export default function Notifications() {
  const api = useAbortableRequest();
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [compose, setCompose] = useState(false)
  const [filter, setFilter]  = useState('all')
  const [toast, setToast]    = useState('')

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/notifications')
      if (response.data.status === 'success') {
        const data = response.data.data.map(n => ({
          id: n._id.toString().slice(-6),
          _id: n._id,
          title: n.title,
          body: n.message,
          target: n.targetRole ? n.targetRole.toLowerCase() : 'all',
          sentAt: new Date(n.createdAt).toLocaleString(),
          status: 'sent',
          createdAt: n.createdAt
        }))
        setNotifs(data)
      }
    } catch (e) {
      showToast('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2800) }

  const send = async (form) => {
    try {
      await api.post('/admin/notifications/broadcast', {
        title: form.title,
        message: form.body,
        targetRole: form.target.toUpperCase() === 'BOTH' ? 'ALL' : form.target.toUpperCase()
      })
      setCompose(false)
      fetchNotifications()
      showToast('Push notification broadcasted successfully!')
    } catch (e) {
      showToast('Failed to send notification')
    }
  }

  const filtered = notifs.filter(n=>filter==='all'||n.status===filter)

  return (
    <div>
      {toast&&<div style={{ position:'fixed',bottom:24,right:24,zIndex:999,background:'#0F172A',color:'white',padding:'12px 20px',borderRadius:12,fontWeight:600,fontSize:14,animation:'slideUp 0.3s ease',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>✓ {toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">Push Notifications</div>
          <div className="page-subtitle">Broadcast messages to customers & workers · {notifs.length} total sent</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setCompose(true)}>+ Compose</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Sent',    value:notifs.length,    color:'var(--primary)'  },
          { label:'Sent Today',    value:notifs.filter(n=>{ const d=new Date(n.createdAt); const today=new Date(); return d.toDateString()===today.toDateString() }).length,   color:'var(--success)'  },
          { label:'This Week',     value:notifs.filter(n=>{ const d=new Date(n.createdAt); const weekAgo=new Date(); weekAgo.setDate(weekAgo.getDate()-7); return d>=weekAgo }).length, color:'var(--warning)'  },
        ].map((s,i)=>(
          <div key={i} className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontWeight:800, fontSize:24, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--mid)', fontFamily:'var(--font-body)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        {['all','sent'].map(f=>(
          <button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filtered.map(n=>(
          <div key={n.id} className="card" style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
              <div style={{ width:44,height:44,background:n.target==='worker'?'var(--warning-light)':n.target==='shop'?'var(--success-light)':'var(--primary-light)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0 }}>
                {n.target==='worker'?'👷':n.target==='shop'?'🏪':'👥'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:800, fontSize:15 }}>{n.title}</span>
                  <span className="badge badge-success" style={{ fontSize:10 }}>Sent</span>
                </div>
                <div style={{ fontSize:13, color:'var(--mid)', fontFamily:'var(--font-body)', marginBottom:10 }}>{n.body}</div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  <div style={{ fontSize:12, color:'var(--light)' }}>Sent {n.sentAt}</div>
                  <div style={{ fontSize:12, color:'var(--light)' }}>Target: {n.target==='worker'?'Workers':n.target==='shop'?'Shop Owners':n.target==='all'?'Everyone':n.target}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0&&<div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-title">No notifications</div><div className="empty-state-desc">Compose your first push notification above</div></div>}
      </div>

      {compose&&<ComposeModal onSend={send} onClose={()=>setCompose(false)} />}
    </div>
  )
}
