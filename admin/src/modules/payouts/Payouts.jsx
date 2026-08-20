import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Drawer from '../../components/common/Drawer'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusColor = { pending:'badge-warning', approved:'badge-primary', transferred:'badge-success', rejected:'badge-danger' }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Payouts() {
  const api = useAbortableRequest();
  const [payouts, setPayouts]   = useState([])
  const [ledger, setLedger]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('requests')
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmModal, setConfirmModal] = useState(null)
  const [toast, setToast]       = useState('')

  useEffect(() => {
    fetchPayouts()
    fetchLedger()
  }, [filter])

  const fetchLedger = async () => {
    try {
        const resp = await api.get('/admin/ledger')
        if (resp.data.status === 'success') {
            const mapped = resp.data.data.transactions.map(t => {
                const isCredit = ['JOB_CREDIT', 'TOPUP', 'REFERRAL_BONUS', 'ADJUSTMENT', 'REFUND', 'ORDER_CREDIT'].includes(t.type);
                
                let displayType = 'earning';
                if (t.type === 'SUBSCRIPTION') displayType = 'subscription';
                else if (t.type === 'WITHDRAWAL') displayType = 'payout';
                else if (t.type === 'REFUND') displayType = 'refund';
                
                return {
                    id: t._id,
                    date: new Date(t.createdAt).toLocaleDateString(),
                    worker: t.userId?.name || 'Unknown',
                    type: displayType,
                    jobId: t.refId || '—',
                    desc: t.description || t.type.replace(/_/g, ' '),
                    amount: isCredit ? t.amount : -t.amount
                };
            });
            setLedger(mapped)
        }
    } catch (e) {
        // silently ignored
    }
  }

  const fetchPayouts = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/payouts', { params: { status: filter === 'all' ? undefined : filter } })
      if (response.data.status === 'success') {
        const data = response.data.data.payouts.map(p => {
          const isShop = !!p.shopId;
          const entity = isShop ? p.shopId : p.workerId;
          return {
            id: p._id.toString().slice(-6),
            _id: p._id,
            role: isShop ? 'SHOP' : 'WORKER',
            worker: entity?.name || 'Unknown',
            wid: entity?._id?.toString().slice(-6) || 'N/A',
            city: entity?.city || entity?.address || '—',
            category: entity?.category || (isShop ? 'Shop Owner' : '—'),
            balance: entity?.wallet?.balance || 0,
            requested: p.amount,
            upi: p.paymentMethod === 'UPI' ? p.paymentDetails : null,
            bank: p.paymentMethod === 'BANK' ? p.paymentDetails : null,
            requestedAt: new Date(p.requestedAt).toLocaleDateString(),
            status: p.status.toLowerCase(),
            txnId: p.txnId
          }
        })
        setPayouts(data)
      }
    } catch (e) {
      // silently ignored
    } finally {
      setLoading(false)
    }
  }

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''), 2800) }

  const approve = async (id) => {
    try {
      const realId = payouts.find(p => p.id === id)?._id || id
      await api.patch(`/admin/payouts/${realId}/status`, { status: 'APPROVED' })
      fetchPayouts()
      showToast('Payout approved — ready to transfer')
      setConfirmModal(null)
    } catch (e) {
      showToast('Failed to approve payout')
    }
  }

  const transfer = async (id) => {
    try {
      const realId = payouts.find(p => p.id === id)?._id || id
      // Generate a proper unique transaction ID using timestamp + random
      const txn = 'TXN-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase()
      await api.patch(`/admin/payouts/${realId}/status`, { status: 'TRANSFERRED', txnId: txn })
      fetchPayouts()
      showToast(`Transfer marked · ${txn}`)
      setConfirmModal(null)
    } catch (e) {
      showToast('Failed to mark transferred', 'error')
    }
  }

  const reject = async (id, reason) => {
    try {
      const realId = payouts.find(p => p.id === id)?._id || id
      await api.patch(`/admin/payouts/${realId}/status`, { status: 'REJECTED', rejectReason: reason })
      fetchPayouts()
      showToast('Payout rejected · worker notified')
      setConfirmModal(null)
      setRejectReason('')
    } catch (e) {
      showToast('Failed to reject payout')
    }
  }

  const pending  = payouts.filter(p=>p.status==='pending').length










  const filtered = payouts.filter(p=>filter==='all'||p.status===filter)
  const selectedFresh = selected ? payouts.find(p=>p.id===selected.id) : null

  const totalPending   = payouts.filter(p=>p.status==='pending').reduce((a,p)=>a+p.requested,0)
  const totalTransferred = payouts.filter(p=>p.status==='transferred').reduce((a,p)=>a+p.requested,0)

  const ledgerColumns = [
    { header: 'Date', render: (t) => <div style={{fontSize:12,color:'var(--mid)'}}>{t.date}</div> },
    { header: 'Worker', render: (t) => <div style={{fontWeight:600}}>{t.worker}</div> },
    { header: 'Type', render: (t) => (
      <Badge
        label={t.type==='earning'?'💰 Earning':t.type==='payout'?'💸 Payout':t.type==='subscription'?'🔄 Subscription':'Refund'}
        variant={t.type==='earning'?'success':t.type==='payout'?'primary':'purple'}
      />
    )},
    { header: 'Job ID', render: (t) => <div style={{fontFamily:'monospace',fontSize:12}}>{t.jobId||'—'}</div> },
    { header: 'Description', render: (t) => <div style={{color:'var(--mid)',fontSize:12,fontFamily:'var(--font-body)'}}>{t.desc}</div> },
    { header: 'Amount', render: (t) => (
      <div style={{fontWeight:800,color:t.amount>0?'var(--success)':'var(--danger)',fontSize:15}}>
        {t.amount>0?'+':''}₹{Math.abs(t.amount)}
      </div>
    )}
  ];

  const columns = [
    { header: 'Worker', render: (p) => (
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div className="avatar avatar-sm" style={{background:p.role==='SHOP'?'linear-gradient(135deg,var(--success),var(--teal))':'linear-gradient(135deg,var(--primary),var(--purple))'}}>{p.worker.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
        <div>
          <div style={{fontWeight:600}}>{p.worker}</div>
          <div style={{fontSize:11,color:'var(--mid)'}}>{p.wid} · {p.role==='SHOP'?'Shop':p.category}</div>
        </div>
      </div>
    )},
    { header: 'City', render: (p) => <div style={{color:'var(--mid)'}}>{p.city}</div> },
    { header: 'Wallet Balance', render: (p) => <span style={{fontWeight:700,color:'var(--success)'}}>₹{p.balance.toLocaleString()}</span> },
    { header: 'Requested', render: (p) => <span style={{fontWeight:800,fontSize:16,color:'var(--dark)'}}>₹{p.requested.toLocaleString()}</span> },
    { header: 'Payment Method', render: (p) => <div style={{fontSize:12,fontFamily:'var(--font-body)'}}>{p.upi||p.bank}</div> },
    { header: 'Requested On', render: (p) => <div style={{fontSize:12,color:'var(--mid)'}}>{p.requestedAt}</div> },
    { header: 'Status', render: (p) => (
      <div>
        <Badge label={p.status.charAt(0).toUpperCase()+p.status.slice(1)} variant={p.status === 'pending' ? 'warning' : p.status === 'approved' ? 'info' : p.status === 'transferred' ? 'success' : 'danger'} />
        {p.txnId&&<div style={{fontSize:10,color:'var(--mid)',marginTop:4,fontFamily:'monospace'}}>{p.txnId}</div>}
      </div>
    )},
    { header: 'Actions', render: (p) => (
      <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
        {p.status==='pending'&&<>
          <button className="btn btn-success btn-sm" onClick={()=>setConfirmModal({type:'approve',payout:p})}>✓ Approve</button>
          <button className="btn btn-danger btn-sm"  onClick={()=>setConfirmModal({type:'reject',payout:p})}>✕</button>
        </>}
        {p.status==='approved'&&<button className="btn btn-primary btn-sm" onClick={()=>setConfirmModal({type:'transfer',payout:p})}>💸 Mark Transferred</button>}
        {(p.status==='transferred'||p.status==='rejected')&&<button className="btn btn-outline btn-sm" onClick={()=>setSelected(p)}>View</button>}
      </div>
    )}
  ];

  return (
    <div>
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}

      <div className="page-header">
        <div>
          <div className="page-title">💰 Payouts & Wallet</div>
          <div className="page-subtitle">Worker earnings, withdrawal requests and transaction ledger</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className={`btn ${tab==='requests'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('requests')}>
            Payout Requests {pending>0&&<span className="badge badge-danger" style={{marginLeft:4}}>{pending}</span>}
          </button>
          <button className={`btn ${tab==='txns'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('txns')}>Transaction Ledger</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Pending Payout',   value:`₹${totalPending.toLocaleString()}`,      color:'var(--warning)'},
          {label:'Transferred Today',value:`₹${totalTransferred.toLocaleString()}`,  color:'var(--success)'},
          {label:'Awaiting Approval',value:payouts.filter(p=>p.status==='pending').length, color:'var(--danger)'},
          {label:'Total Workers',    value:payouts.length,                            color:'var(--primary)'},
        ].map((s,i)=>(
          <div key={i} className="card" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontWeight:800,fontSize:22,color:s.color}}>{s.value}</div>
            <div style={{fontSize:12,color:'var(--mid)',fontFamily:'var(--font-body)'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {tab==='requests' ? (
        <>
          <div className="filter-bar">
            {['all','pending','approved','transferred','rejected'].map(f=>(
              <button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
                {f.charAt(0).toUpperCase()+f.slice(1)}
                {f==='pending'&&pending>0&&<span style={{marginLeft:5,background:'var(--danger)',color:'white',borderRadius:999,padding:'1px 6px',fontSize:9}}>{pending}</span>}
              </button>
            ))}
          </div>

          <div className="table-card">
            <Table columns={columns} data={filtered} onRowClick={setSelected} emptyMessage="No payout requests found." />
          </div>
        </>
      ) : (
        <div className="table-card">
          <Table columns={ledgerColumns} data={ledger} emptyMessage="No transactions found." />
        </div>
      )}

      {/* Payout Detail Drawer */}
      <Drawer
        open={Boolean(selectedFresh)}
        onClose={() => setSelected(null)}
        title="Payout Request"
        subtitle={selectedFresh ? `${selectedFresh.wid} · ${selectedFresh.worker}` : ''}
        width="440px"
      >
        {selectedFresh && (
          <div>
            <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:20}}>
              <div className="avatar avatar-lg" style={{background:selectedFresh.role==='SHOP'?'linear-gradient(135deg,var(--success),var(--teal))':'linear-gradient(135deg,var(--primary),var(--purple))'}}>{selectedFresh.worker.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
              <div>
                <div style={{fontWeight:800,fontSize:18}}>{selectedFresh.worker}</div>
                <div style={{color:'var(--mid)',fontFamily:'var(--font-body)',fontSize:13}}>{selectedFresh.wid} · {selectedFresh.role==='SHOP'?'Shop Owner':selectedFresh.category} · {selectedFresh.city}</div>
                <div style={{marginTop:6}}><span className={`badge ${statusColor[selectedFresh.status]}`}>{selectedFresh.status}</span></div>
              </div>
            </div>
            <div className="grid-3" style={{marginBottom:16}}>
              {[{label:'Wallet Balance',value:`₹${selectedFresh.balance}`},{label:'Requested',value:`₹${selectedFresh.requested}`},{label:'After Payout',value:`₹${selectedFresh.balance-selectedFresh.requested}`}].map((s,i)=>(
                <div key={i} className="card" style={{padding:14,textAlign:'center'}}>
                  <div style={{fontWeight:800,fontSize:16}}>{s.value}</div>
                  <div style={{fontSize:11,color:'var(--mid)',fontFamily:'var(--font-body)'}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="divider"/>
            <div style={{fontSize:12,fontWeight:700,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Payment Details</div>
            {[{l:'Method',v:selectedFresh.upi?'UPI':'Bank Transfer'},{l:'Account',v:selectedFresh.upi||selectedFresh.bank},{l:'Requested On',v:selectedFresh.requestedAt},{l:'Txn ID',v:selectedFresh.txnId||'—'}].map((r,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--bg)'}}>
                <span style={{fontSize:12,color:'var(--mid)'}}>{r.l}</span>
                <span style={{fontWeight:600,fontSize:13,fontFamily:'monospace'}}>{r.v}</span>
              </div>
            ))}
            <div className="divider"/>
            {selectedFresh.status==='pending'&&(
              <div style={{display:'flex',gap:10}}>
                <button className="btn btn-success" style={{flex:1}} onClick={()=>setConfirmModal({type:'approve',payout:selectedFresh})}>✓ Approve</button>
                <button className="btn btn-danger"  style={{flex:1}} onClick={()=>setConfirmModal({type:'reject',payout:selectedFresh})}>✕ Reject</button>
              </div>
            )}
            {selectedFresh.status==='approved'&&(
              <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>setConfirmModal({type:'transfer',payout:selectedFresh})}>💸 Mark as Transferred</button>
            )}
          </div>
        )}
      </Drawer>

      {/* Confirm modals */}
      {confirmModal && (
        <Modal
          open={true}
          onClose={() => { setConfirmModal(null); setRejectReason('') }}
          title={confirmModal.type==='approve'?'Approve Payout':confirmModal.type==='transfer'?'Mark as Transferred':'Reject Payout'}
          width="420px"
        >
          <div>
            {confirmModal.type==='approve'&&<p style={{fontSize:13,color:'var(--mid)',fontFamily:'var(--font-body)',lineHeight:1.6}}>Approve ₹{confirmModal.payout.requested.toLocaleString()} payout to <strong>{confirmModal.payout.worker}</strong> via {confirmModal.payout.upi||confirmModal.payout.bank}?</p>}
            {confirmModal.type==='transfer'&&<p style={{fontSize:13,color:'var(--mid)',fontFamily:'var(--font-body)',lineHeight:1.6}}>Confirm that ₹{confirmModal.payout.requested.toLocaleString()} has been physically transferred to <strong>{confirmModal.payout.worker}</strong>? A transaction ID will be generated.</p>}
            {confirmModal.type==='reject'&&(
              <>
                <p style={{fontSize:13,color:'var(--mid)',fontFamily:'var(--font-body)',lineHeight:1.6,marginBottom:12}}>Reject payout request from <strong>{confirmModal.payout.worker}</strong>?</p>
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <select className="form-control" value={rejectReason} onChange={e=>setRejectReason(e.target.value)}>
                    <option value="">Select reason...</option>
                    <option>Insufficient wallet balance</option>
                    <option>UPI / bank details mismatch</option>
                    <option>KYC verification pending</option>
                    <option>Suspicious activity detected</option>
                    <option>Minimum withdrawal amount not met</option>
                  </select>
                </div>
              </>
            )}
            <div style={{display:'flex',gap:10,marginTop:20,paddingTop:14,borderTop:'1px solid var(--border)'}}>
              <button type="button" className="btn-secondary" style={{flex:1}} onClick={()=>{setConfirmModal(null);setRejectReason('')}}>Cancel</button>
              {confirmModal.type==='approve'&&<button type="button" className="btn-primary" style={{flex:1}} onClick={()=>approve(confirmModal.payout.id)}>✓ Approve</button>}
              {confirmModal.type==='transfer'&&<button type="button" className="btn-primary" style={{flex:1}} onClick={()=>transfer(confirmModal.payout.id)}>💸 Confirm Transfer</button>}
              {confirmModal.type==='reject'&&<button type="button" className="btn-danger" style={{flex:1}} disabled={!rejectReason} onClick={()=>reject(confirmModal.payout.id,rejectReason)}>✕ Reject</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
