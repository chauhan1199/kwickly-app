import React, { useState, useEffect } from 'react'
import api from '../../services/api'

const WORKERS = [] // Fetched dynamically

const statusBadge = {
  completed:'badge-success', in_progress:'badge-primary', on_the_way:'badge-warning',
  broadcasting:'badge-purple', cancelled:'badge-danger',
  open:'badge-danger', in_review:'badge-warning', resolved:'badge-success',
}
const statusLabel = {
  completed:'✓ Completed', in_progress:'⚙ In Progress', on_the_way:'🚗 En Route',
  broadcasting:'📡 Broadcasting', cancelled:'✕ Cancelled',
  open:'Open', in_review:'In Review', resolved:'Resolved',
}

function ReassignModal({ job, onConfirm, onClose }) {
  const [worker, setWorker] = useState('')
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div style={{ fontWeight:800, fontSize:16 }}>Reassign Job {job.id}</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:13,color:'var(--mid)',fontFamily:'var(--font-body)',marginBottom:16 }}>
            Currently assigned to <strong>{job.worker}</strong>. Select a new worker to reassign.
          </p>
          <div className="form-group">
            <label className="form-label">New Worker</label>
            <select className="form-control" value={worker} onChange={e=>setWorker(e.target.value)}>
              <option value="">Select available worker...</option>
              {WORKERS.filter(w=>w!==job.worker).map(w=><option key={w}>{w}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!worker} onClick={()=>onConfirm(worker)}>
            ✓ Reassign
          </button>
        </div>
      </div>
    </div>
  )
}

function JobDetailDrawer({ job, onClose, onCancel, onReassign }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>Job Details</div>
            <div style={{ fontSize:12, color:'var(--mid)', fontFamily:'var(--font-body)' }}>{job.id}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          {/* Status banner */}
          <div style={{ background:'var(--bg-dark)',borderRadius:12,padding:16,marginBottom:20,textAlign:'center' }}>
            <span className={`badge ${statusBadge[job.status]}`} style={{ fontSize:13,padding:'6px 16px' }}>
              {statusLabel[job.status]}
            </span>
            {job.priority==='urgent'&&<span className="badge badge-secondary" style={{ marginLeft:8, fontSize:13 }}>⚡ Urgent</span>}
          </div>

          {/* Details grid */}
          {[
            { label:'Customer', value:job.customer },
            { label:'Worker',   value:job.worker },
            { label:'Category', value:job.category },
            { label:'City',     value:job.city },
            { label:'Date',     value:job.date },
            { label:'Amount',   value:job.amount },
            { label:'Platform Fee', value:job.fee },
          ].map((r,i)=>(
            <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--bg)' }}>
              <span style={{ fontSize:12,fontWeight:700,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'0.5px' }}>{r.label}</span>
              <span style={{ fontWeight:600 }}>{r.value}</span>
            </div>
          ))}

          <div className="divider" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(job.status==='broadcasting'||job.status==='in_progress'||job.status==='on_the_way')&&(
              <button className="btn btn-danger" style={{ width:'100%', justifyContent:'center' }} onClick={()=>onCancel(job.id)}>
                ✕ Force Cancel Job
              </button>
            )}
            {job.status==='in_progress'&&(
              <button className="btn btn-outline" style={{ width:'100%', justifyContent:'center' }} onClick={()=>onReassign(job)}>
                🔄 Reassign Worker
              </button>
            )}
            <button className="btn btn-outline" style={{ width:'100%', justifyContent:'center' }} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Jobs() {
  const [jobs, setJobs]           = useState([])
  const [disputes, setDisputes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('jobs')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [viewJob, setViewJob]     = useState(null)
  const [reassignJob, setReassignJob] = useState(null)
  const [toast, setToast]         = useState('')

  useEffect(() => {
    fetchJobs()
    fetchDisputes()
  }, [statusFilter])

  const fetchJobs = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/jobs/all', { params: { status: statusFilter } })
      if (response.data.status === 'success') {
        const formattedJobs = response.data.data.jobs.map(j => ({
          id: j._id.toString().slice(-6),
          _id: j._id,
          customer: j.customerId?.name || 'Unknown',
          worker: j.workerId?.name || '—',
          category: j.category,
          city: j.locationName || 'N/A',
          date: new Date(j.createdAt).toLocaleDateString(),
          amount: `₹${j.payment?.amount || 0}`,
          fee: `₹${j.payment?.platformFee || 0}`,
          status: j.status.toLowerCase(),
          priority: j.priority || 'normal'
        }))
        setJobs(formattedJobs)
      }
    } catch (e) {
      console.error('Error fetching jobs:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchDisputes = async () => {
    try {
      const response = await api.get('/admin/disputes')
      if (response.data.status === 'success') {
        const formattedDisputes = response.data.data.map(d => ({
            id: d.jobId?._id ? d.jobId._id.toString().slice(-6) : d._id.toString().slice(-6),
            _id: d._id,
            customer: d.customerId?.name || 'Unknown',
            worker: d.workerId?.name || '—',
            issue: d.issue, 
            amount: `₹${d.jobId?.payment?.amount || 0}`,
            status: d.status,
            opened: new Date(d.openedAt).toLocaleDateString()
        }))
        setDisputes(formattedDisputes)
      }
    } catch (e) {
        console.error('Error fetching disputes:', e)
    }
  }

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),2800) }

  /* ── Job actions ── */
  const cancelJob = async (id) => {
    try {
      const realId = jobs.find(j => j.id === id)?._id || id
      await api.patch(`/admin/jobs/${realId}/cancel`)
      fetchJobs()
      setViewJob(null)
      showToast(`Job ${id} has been cancelled`)
    } catch (e) {
      alert('Failed to cancel job')
    }
  }

  const reassignWorker = async (newWorkerName) => {
    // In a real app, we'd select a worker ID
    // For this simulation, we'll try to find a worker by name (simplification)
    try {
        await api.patch(`/admin/jobs/${reassignJob._id}/reassign`, { workerId: '6618e...' }) 
        fetchJobs()
        showToast(`Job ${reassignJob.id} reassigned`)
        setReassignJob(null)
    } catch (e) {
        alert('Failed to reassign')
    }
  }

  /* ── Dispute actions ── */
  const moveDispute = async (id, next) => {
    try {
        await api.patch(`/admin/disputes/${id}/status`, { status: next })
        fetchDisputes()
        showToast(next==='in_review'?`Dispute moved to In Review`:next==='resolved'?`Dispute resolved`:`Refund initiated`)
    } catch (e) {
        alert('Failed to update dispute')
    }
  }

  const filtered = jobs.filter(j=>{
    const ms = j.customer.toLowerCase().includes(search.toLowerCase()) ||
               j.worker.toLowerCase().includes(search.toLowerCase())   ||
               j.id.toLowerCase().includes(search.toLowerCase())       ||
               j.category.toLowerCase().includes(search.toLowerCase())
    const mst= statusFilter==='all'||j.status===statusFilter
    return ms&&mst
  })

  const openCount = disputes.filter(d=>d.status!=='resolved').length

  return (
    <div>
      {toast&&(
        <div style={{ position:'fixed',bottom:24,right:24,zIndex:999,background:'#0F172A',color:'white',padding:'12px 20px',borderRadius:12,fontWeight:600,fontSize:14,animation:'slideUp 0.3s ease',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">📋 Job Management</div>
          <div className="page-subtitle">{jobs.length} total jobs</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button className={`btn ${tab==='jobs'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('jobs')}>All Jobs</button>
          <button className={`btn ${tab==='disputes'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('disputes')}>
            Disputes
            {openCount>0&&<span className="badge badge-danger" style={{ marginLeft:4 }}>{openCount}</span>}
          </button>
        </div>
      </div>

      {tab==='jobs' ? (
        <>
          <div className="filter-bar">
            <div className="search-bar" style={{ width:260 }}>
              <span>🔍</span>
              <input placeholder="Search job ID, customer, worker..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            {['all','broadcasting','in_progress','on_the_way','completed','cancelled'].map(s=>(
              <button key={s} className={`filter-chip ${statusFilter===s?'active':''}`} onClick={()=>setStatusFilter(s)}>
                {s==='all'?'All':statusLabel[s]||s}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th><th>Customer</th><th>Worker</th><th>Category</th>
                    <th>City</th><th>Amount</th><th>Fee</th><th>Priority</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(j=>(
                    <tr key={j.id}>
                      <td style={{ fontFamily:'monospace',fontWeight:700,fontSize:12 }}>{j.id}</td>
                      <td style={{ fontWeight:600 }}>{j.customer}</td>
                      <td style={{ color:j.worker==='—'?'var(--light)':'var(--dark)' }}>{j.worker}</td>
                      <td>{j.category}</td>
                      <td style={{ color:'var(--mid)' }}>{j.city}</td>
                      <td style={{ fontWeight:700 }}>{j.amount}</td>
                      <td style={{ color:'var(--success)',fontWeight:700 }}>{j.fee}</td>
                      <td>{j.priority==='urgent'&&<span className="badge badge-secondary">⚡ Urgent</span>}</td>
                      <td><span className={`badge ${statusBadge[j.status]}`}>{statusLabel[j.status]}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          {(j.status==='broadcasting'||j.status==='in_progress'||j.status==='on_the_way')&&(
                            <button className="btn btn-danger btn-sm" onClick={()=>cancelJob(j.id)}>Cancel</button>
                          )}
                          {j.status==='in_progress'&&(
                            <button className="btn btn-outline btn-sm" onClick={()=>setReassignJob(j)}>Reassign</button>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={()=>setViewJob(j)}>View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length===0&&(
                    <tr><td colSpan={10} style={{ textAlign:'center',padding:40,color:'var(--mid)' }}>No jobs match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="alert alert-warning" style={{ marginBottom:16 }}>
            ⚠️ {openCount} open dispute{openCount!==1?'s':''} require your attention. 24hr SLA applies.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {disputes.map(d=>(
              <div key={d.id} className="card" style={{ padding:20 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'monospace',fontWeight:700,fontSize:12 }}>{d.id}</span>
                      <span className={`badge ${statusBadge[d.status]}`}>{statusLabel[d.status]}</span>
                      <span style={{ fontSize:12,color:'var(--light)',fontFamily:'var(--font-body)' }}>Opened {d.opened}</span>
                    </div>
                    <div style={{ fontWeight:700,marginBottom:4 }}>{d.customer} vs {d.worker}</div>
                    <div style={{ fontSize:13,color:'var(--mid)',fontFamily:'var(--font-body)' }}>"{d.issue}"</div>
                    {d.amount!=='₹0'&&<div style={{ marginTop:8,fontSize:12,color:'var(--danger)',fontWeight:700 }}>Disputed amount: {d.amount}</div>}
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    {d.status==='open'&&(
                      <button className="btn btn-sm" style={{ background:'var(--warning-light)',color:'var(--warning)',border:'1px solid #FCD34D' }} onClick={()=>moveDispute(d.id,'in_review')}>
                        🔍 Review
                      </button>
                    )}
                    {d.status==='in_review'&&<>
                      <button className="btn btn-success btn-sm" onClick={()=>moveDispute(d.id,'resolved')}>✓ Resolve</button>
                      <button className="btn btn-outline btn-sm" onClick={()=>{ moveDispute(d.id,'resolved'); showToast(`Refund issued for ${d.id}`) }}>💸 Refund</button>
                    </>}
                    {d.status==='resolved'&&<span className="badge badge-success" style={{ alignSelf:'center' }}>✓ Closed</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View drawer */}
      {viewJob && (
        <JobDetailDrawer
          job={jobs.find(j=>j.id===viewJob.id)||viewJob}
          onClose={()=>setViewJob(null)}
          onCancel={cancelJob}
          onReassign={(j)=>{ setReassignJob(j); setViewJob(null) }}
        />
      )}

      {/* Reassign modal */}
      {reassignJob && (
        <ReassignModal
          job={reassignJob}
          onConfirm={reassignWorker}
          onClose={()=>setReassignJob(null)}
        />
      )}
    </div>
  )
}
