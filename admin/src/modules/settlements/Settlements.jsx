import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

export default function Settlements() {
  const [settlements, setSettlements] = useState([])
  const [filter, setFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ count: 0, total: 0 })
  const [toast, setToast] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const showToast = (message, type = 'success') => setToast({ message, type })

  useEffect(() => { loadSettlements() }, [filter])

  const loadSettlements = async () => {
    setLoading(true)
    try {
      const resp = await api.get('/admin/settlements', { params: { status: filter } })
      setSettlements(resp.data.data || [])
      const total = (resp.data.data || []).reduce((sum, s) => sum + (s.shopEarning || 0), 0)
      setSummary({ count: (resp.data.data || []).length, total })
    } catch (e) { console.error(e); showToast(e.message, 'error') }
    setLoading(false)
  }

  const handleSettle = async (id) => {
    setConfirmModal({
      title: 'Settle Payment',
      message: 'Settle this payment?',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await api.post(`/admin/settlements/${id}/settle`, { note: 'Settled by admin' })
          loadSettlements()
          showToast('Payment settled successfully')
        } catch (e) { showToast('Error settling: ' + e.message, 'error') }
      }
    })
  }

  const handleBulkSettle = async () => {
    const pendingIds = settlements.filter(s => s.status === 'PENDING').map(s => s._id)
    if (pendingIds.length === 0) return showToast('No pending settlements', 'error')
    setConfirmModal({
      title: 'Bulk Settle',
      message: `Settle ${pendingIds.length} settlements?`,
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await api.post('/admin/settlements/bulk-settle', { settlementIds: pendingIds, useDefaultCommission: true })
          loadSettlements()
          showToast(`${pendingIds.length} settlements settled successfully`)
        } catch (e) { showToast('Error: ' + e.message, 'error') }
      }
    })
  }

  return (
    <>
    <div className="page-container">
      <div className="page-header">
        <h2>Settlements</h2>
        {filter === 'PENDING' && settlements.length > 0 && (
          <button className="btn btn-primary" onClick={handleBulkSettle}>Bulk Settle ({settlements.length})</button>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{summary.count}</div>
          <div className="stat-label">{filter} Settlements</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">₹{summary.total.toLocaleString()}</div>
          <div className="stat-label">Total Amount</div>
        </div>
      </div>

      <div className="tabs">
        {['PENDING', 'SETTLED', 'CANCELLED'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="table-container">
        {loading ? <div className="loading">Loading...</div> : (
          <table>
            <thead>
              <tr><th>Type</th><th>Shop</th><th>Order</th><th>Total</th><th>Commission</th><th>Shop Earning</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {settlements.map(s => (
                <tr key={s._id}>
                  <td><span className={`badge ${s.type === 'SERVICE_JOB' ? 'badge-info' : 'badge-success'}`}>{s.type}</span></td>
                  <td>{s.shopId?.name || '-'}</td>
                  <td>{s.orderId?.orderNumber || '-'}</td>
                  <td>₹{s.totalAmount}</td>
                  <td>₹{s.platformCommission}</td>
                  <td><strong>₹{s.shopEarning}</strong></td>
                  <td><span className={`badge badge-${s.status === 'SETTLED' ? 'success' : s.status === 'PENDING' ? 'warning' : 'muted'}`}>{s.status}</span></td>
                  <td>
                    {s.status === 'PENDING' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleSettle(s._id)}>Settle</button>
                    )}
                  </td>
                </tr>
              ))}
              {settlements.length === 0 && <tr><td colSpan={8} className="empty-state">No {filter.toLowerCase()} settlements</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    {confirmModal && <ConfirmModal title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onClose={() => setConfirmModal(null)} />}
    </>
  )
}
