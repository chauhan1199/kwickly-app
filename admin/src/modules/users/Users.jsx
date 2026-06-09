import React, { useState, useEffect } from 'react'
import api from '../../services/api'

function ConfirmModal({ title, message, onConfirm, onClose, danger = true }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--mid)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-success'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [selected, setSelected]   = useState(null)
  const [confirm, setConfirm]     = useState(null) // { type: 'block'|'delete', id }
  const [toast, setToast]         = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/admin/customers')
      if (response.data.status === 'success') {
        setCustomers(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      showToast('Error fetching customers')
    } finally {
      setLoading(false)
    }
  }

  const addCustomer = async (e) => {
    e.preventDefault()
    try {
      const response = await api.post('/admin/users', { ...newCustomer, role: 'CUSTOMER' })
      if (response.data.status === 'success') {
        showToast('Customer created successfully!')
        setShowAdd(false)
        setNewCustomer({ name: '', phone: '' })
        fetchCustomers()
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create customer')
    }
  }

  /* ── helpers ── */
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const getCustomer = (id) => customers.find(c => c._id === id)

  /* ── actions ── */
  const toggleBlock = async (id) => {
    try {
      const response = await api.patch(`/admin/users/${id}/toggle-status`)
      if (response.data.status === 'success') {
        const updatedUser = response.data.data
        setCustomers(prev => prev.map(x => x._id === id ? updatedUser : x))
        showToast(`User status updated.`)
      }
    } catch (error) {
      showToast('Failed to update status')
    }
    setConfirm(null)
  }

  const deleteCustomer = async (id) => {
    try {
      const response = await api.delete(`/admin/users/${id}`)
      if (response.data.status === 'success') {
        setCustomers(prev => prev.filter(x => x._id !== id))
        showToast(`User has been deleted.`)
      }
    } catch (error) {
      showToast('Failed to delete user')
    }
    setConfirm(null)
  }

  /* ── filter ── */
  const filtered = customers.filter(c => {
    const nameMatch = c.name?.toLowerCase().includes(search.toLowerCase())
    const phoneMatch = c.phone?.includes(search)
    const matchSearch = nameMatch || phoneMatch
    const status = c.isVerified ? 'active' : 'inactive'
    const matchFilter = filter === 'all' || status === filter
    return matchSearch && matchFilter
  })

  // Selected details
  const selectedFresh = selected ? customers.find(c => c._id === selected._id) : null

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background:'#0F172A', color:'white', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, animation:'slideUp 0.3s ease', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">👤 Customers</div>
          <div className="page-subtitle">{customers.length} registered customers</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
          <button className="btn btn-outline" onClick={fetchCustomers}>🔄 Refresh</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar" style={{ width: 260 }}>
          <span>🔍</span>
          <input placeholder="Search by name, phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>Loading customers...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th><th>Phone</th><th>Joined</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="avatar avatar-sm" style={{ background:`hsl(210, 65%, 55%)` }}>
                          {c.name ? c.name[0] : '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight:600 }}>{c.name || 'Unknown'}</div>
                          <div style={{ fontSize:11, color:'var(--mid)' }}>{c._id.slice(-6)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily:'var(--font-body)' }}>{c.phone}</td>
                    <td style={{ color:'var(--mid)', fontSize:12 }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${c.isVerified ? 'badge-success' : 'badge-gray'}`}>
                        {c.isVerified ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setSelected(c)}>View</button>
                        <button
                          className={`btn btn-sm ${c.isVerified ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => setConfirm({ type:'block', id:c._id })}
                        >
                          {c.isVerified ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background:'var(--danger-light)', color:'var(--danger)', border:'none' }}
                          onClick={() => setConfirm({ type:'delete', id:c._id })}
                          title="Delete customer"
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--mid)' }}>No customers match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedFresh && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div style={{ fontWeight:800, fontSize:16 }}>Customer Profile</div>
                <div style={{ fontSize:12, color:'var(--mid)', fontFamily:'var(--font-body)' }}>{selectedFresh._id}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:20 }}>
                <div className="avatar avatar-lg" style={{ background:'linear-gradient(135deg, var(--primary), var(--purple))' }}>
                  {selectedFresh.name ? selectedFresh.name[0] : '?'}
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:20 }}>{selectedFresh.name || 'Unknown'}</div>
                  <div style={{ color:'var(--mid)', fontFamily:'var(--font-body)' }}>{selectedFresh.phone}</div>
                  <div style={{ marginTop:6 }}>
                    <span className={`badge ${selectedFresh.isVerified ? 'badge-success' : 'badge-gray'}`}>
                      {selectedFresh.isVerified ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="divider" />
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Actions</div>
              <div style={{ display:'flex', gap:10 }}>
                <button
                  className={`btn ${selectedFresh.isVerified ? 'btn-danger' : 'btn-success'}`}
                  style={{ flex:1 }}
                  onClick={() => setConfirm({ type:'block', id:selectedFresh._id })}
                >
                  {selectedFresh.isVerified ? '🚫 Deactivate Account' : '✓ Activate Account'}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex:1 }}
                  onClick={() => setConfirm({ type:'delete', id:selectedFresh._id })}
                >
                  🗑 Delete Account
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Confirm Modal ── */}
      {confirm?.type === 'block' && (
        <ConfirmModal
          title={getCustomer(confirm.id)?.isVerified ? 'Deactivate Customer' : 'Activate Customer'}
          message={getCustomer(confirm.id)?.isVerified
            ? `Deactivate ${getCustomer(confirm.id)?.name}? they will not be able to book.`
            : `Activate ${getCustomer(confirm.id)?.name}? They will be able to book jobs again.`}
          danger={getCustomer(confirm.id)?.isVerified}
          onConfirm={() => toggleBlock(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'delete' && (
        <ConfirmModal
          title="Delete Customer"
          message={`Permanently delete ${getCustomer(confirm.id)?.name}? This action cannot be undone.`}
          onConfirm={() => deleteCustomer(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: 16 }}>Add New Customer</div>
              <button className="drawer-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={addCustomer}>
              <div className="modal-body">
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>Full Name</label>
                  <input required placeholder="John Doe" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-light)', color: 'white' }} />
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>Phone Number</label>
                  <input required placeholder="9876543210" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-light)', color: 'white' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
