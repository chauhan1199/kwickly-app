import React, { useState, useEffect, useCallback } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { Search, RefreshCw, Eye, Truck, XCircle, Copy } from 'lucide-react'

const PAGE_SIZE = 15
const STATUS_VARIANT = {
  NEW: 'info', CONFIRMED: 'primary', PACKING: 'warning', OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success', CANCELLED: 'danger', COMPLETED: 'success'
}
const STATUS_LABEL = {
  NEW: 'New', CONFIRMED: 'Confirmed', PACKING: 'Packing', OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled', COMPLETED: 'Completed'
}
const STATUS_FLOW = ['NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED']

export default function Orders() {
  const api = useAbortableRequest();
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [total, setTotal] = useState(0)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/shoporders/all', { params: { page, limit: PAGE_SIZE } })
      const payload = res.data.data
      setOrders(payload?.orders || payload || [])
<<<<<<< Updated upstream
      if (typeof payload?.total === 'number') setTotal(payload.total)
    } catch {
=======
    } catch (err) {
      if (isAbortError(err)) return
>>>>>>> Stashed changes
      showToast('Failed to load orders', 'error')
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const updateStatus = async (orderId, newStatus) => {
    try {
      const current = orders.find(o => o._id === orderId) || detail
      const body = { status: newStatus }
      if (newStatus === 'DELIVERED' && current?.deliveryOtp) body.otp = current.deliveryOtp
      const res = await api.patch(`/admin/shoporders/${orderId}/status`, body)
      if (res.data.status === 'success') {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o))
        if (detail?._id === orderId) setDetail(prev => ({ ...prev, status: newStatus }))
        showToast(`Order updated to ${STATUS_LABEL[newStatus] || newStatus}`)
      }
    } catch {
      showToast('Failed to update order', 'error')
    }
    setConfirm(null)
  }

  const cancelOrder = async (orderId) => {
    await updateStatus(orderId, 'CANCELLED')
    setDetail(null)
  }

  const filtered = orders.filter(o => {
    const matchSearch = (o.orderNumber || o._id?.slice(-6) || '').toLowerCase().includes(search.toLowerCase()) ||
      o.customerId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.shopId?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1
  const paged = filtered.slice(0, PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'NEW').length,
    packing: orders.filter(o => o.status === 'PACKING').length,
    delivering: orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
    revenue: orders.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + (o.total || 0), 0),
  }

  const getNextStatus = (current) => {
    const idx = STATUS_FLOW.indexOf(current)
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
  }

  const copyOrderId = (id) => { navigator.clipboard.writeText(id); showToast('Order ID copied') }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Order Management</div>
          <div className="page-subtitle">Manage all shop orders — update status, view details, cancel on behalf of shop owners</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchOrders}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Orders', value: stats.total, color: '#2EF7F0' },
          { label: 'New', value: stats.new, color: '#2563EB' },
          { label: 'Packing', value: stats.packing, color: '#F59E0B' },
          { label: 'Delivering', value: stats.delivering, color: '#8B5CF6' },
          { label: 'Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`, color: '#10B981' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search order #, customer, shop..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {['all', 'NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map(f => (
            <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : STATUS_LABEL[f] || f}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading orders...</div>
        ) : paged.length === 0 ? (
          <EmptyState icon="🛒" title="No orders found" description={search ? 'Try a different search' : 'No shop orders yet'} />
        ) : (
          <>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Shop</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(o => {
                    const next = getNextStatus(o.status)
                    return (
                      <tr key={o._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{o.orderNumber || o._id?.slice(-6)}</span>
                            <button onClick={() => copyOrderId(o._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', padding: 2 }} title="Copy ID"><Copy size={12} /></button>
                          </div>
                        </td>
                        <td>
                          <div className="cell-primary">{o.customerId?.name || '—'}</div>
                          <div className="cell-muted">{o.customerId?.phone || ''}</div>
                        </td>
                        <td>
                          <div className="cell-primary">{o.shopId?.name || '—'}</div>
                        </td>
                        <td><strong>{o.items?.length || 0}</strong> items</td>
                        <td><strong>₹{(o.total || 0).toLocaleString('en-IN')}</strong></td>
                        <td><span className={`badge badge-${o.paymentMethod === 'COD' ? 'warning' : 'success'}`}>{o.paymentMethod || '—'}</span></td>
                        <td><span className={`badge badge-${STATUS_VARIANT[o.status] || 'gray'}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--mid)' }}>{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-icon" title="View" onClick={() => setDetail(o)}><Eye size={15} /></button>
                            {next && (
                              <button
                                className="btn-icon success"
                                title={`Mark as ${STATUS_LABEL[next]}`}
                                onClick={() => setConfirm({ type: 'advance', id: o._id, name: `Order #${o._id?.slice(-6)}`, next })}
                              >
                                <Truck size={15} />
                              </button>
                            )}
                            {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                              <button
                                className="btn-icon danger"
                                title="Cancel Order"
                                onClick={() => setConfirm({ type: 'cancel', id: o._id, name: `Order #${o._id?.slice(-6)}` })}
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {detail && (
        <>
          <div className="drawer-overlay" onClick={() => setDetail(null)} />
          <div className="drawer" style={{ width: 520 }}>
            <div className="drawer-header">
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Order Details</div>
                <div className="cell-muted">{detail._id}</div>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="drawer-body">
              {/* Status Banner */}
              <div style={{ background: 'var(--bg-dark)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                <span className={`badge badge-${STATUS_VARIANT[detail.status] || 'gray'}`} style={{ fontSize: 13, padding: '6px 16px' }}>
                  {STATUS_LABEL[detail.status] || detail.status}
                </span>
              </div>

              {/* Info Grid */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</div>
              <div className="detail-grid">
                <div className="detail-row"><span>Order #</span><strong>{detail.orderNumber || detail._id?.slice(-6)}</strong></div>
                <div className="detail-row"><span>Customer</span><strong>{detail.customerId?.name || '—'} · {detail.customerId?.phone || '—'}</strong></div>
                <div className="detail-row"><span>Shop</span><strong>{detail.shopId?.name || '—'}</strong></div>
                <div className="detail-row"><span>Payment</span><strong>{detail.paymentMethod || '—'}</strong></div>
                <div className="detail-row"><span>Delivery Address</span><strong>{detail.deliveryAddress || '—'}</strong></div>
                <div className="detail-row"><span>Date</span><strong>{new Date(detail.createdAt).toLocaleString('en-IN')}</strong></div>
              </div>

              {/* Items */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Items</div>
              <div style={{ background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {(detail.items || []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < detail.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mid)' }}>Qty: {item.qty} × ₹{item.price}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{(item.price * item.qty).toLocaleString('en-IN')}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--white)', fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--primary)' }}>₹{(detail.total || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Admin Actions */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Admin Actions</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {getNextStatus(detail.status) && (
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setConfirm({ type: 'advance', id: detail._id, name: `Order #${detail._id?.slice(-6)}`, next: getNextStatus(detail.status) }); setDetail(null); }}>
                    Mark as {STATUS_LABEL[getNextStatus(detail.status)]}
                  </button>
                )}
                {detail.status !== 'DELIVERED' && detail.status !== 'CANCELLED' && (
                  <button className="btn-danger" style={{ flex: 1 }} onClick={() => { setConfirm({ type: 'cancel', id: detail._id, name: `Order #${detail._id?.slice(-6)}` }); setDetail(null); }}>
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirm Modals */}
      {confirm?.type === 'advance' && (
        <ConfirmModal
          title="Update Order Status"
          message={`Mark ${confirm.name} as "${STATUS_LABEL[confirm.next]}"? This action is done on behalf of the shop owner.`}
          danger={false}
          confirmText={`Mark as ${STATUS_LABEL[confirm.next]}`}
          onConfirm={() => updateStatus(confirm.id, confirm.next)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'cancel' && (
        <ConfirmModal
          title="Cancel Order"
          message={`Cancel ${confirm.name}? This action is done on behalf of the shop owner and cannot be undone.`}
          confirmText="Cancel Order"
          onConfirm={() => cancelOrder(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
