import React, { useState, useEffect, useCallback, useMemo } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import Drawer from '../../components/common/Drawer'
import useAdminRefresh from '../../hooks/useAdminRefresh'
import { Search, RefreshCw, Eye, Truck, XCircle, Copy, CheckCircle, ShieldAlert, Download } from 'lucide-react'

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
  const [fetchError, setFetchError] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting] = useState(false)

  // Debounce the search box so the server query fires after typing stops
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    try {
      const res = await api.get('/admin/shoporders/all', { params: { page, limit: PAGE_SIZE, status: statusFilter, search: searchQuery } })
      const payload = res.data.data
      setOrders(payload?.orders || payload || [])
      if (typeof payload?.total === 'number') setTotal(payload.total)
      if (payload?.stats) setStats(payload.stats)
    } catch (err) {
      if (isAbortError(err)) return
      setFetchError(true)
      showToast(extractErrorMessage(err, 'Failed to load orders'), 'error')
    } finally { setLoading(false) }
  }, [page, statusFilter, searchQuery])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useAdminRefresh(fetchOrders)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const updateStatus = async (orderId, newStatus) => {
    if (actionId) return
    setActionId(orderId)
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
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update order'), 'error')
    } finally {
      setActionId(null)
      setConfirm(null)
    }
  }

  const verifyPayment = async (orderId, action, reason = 'Fake / Unreceived UTR') => {
    if (actionId) return
    setActionId(orderId)
    try {
      const res = await api.post(`/shoporders/${orderId}/verify-payment`, { action, reason })
      if (res.data.status === 'success') {
        const updated = res.data.data
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, payment: updated.payment, status: updated.status } : o))
        if (detail?._id === orderId) setDetail(prev => ({ ...prev, payment: updated.payment, status: updated.status }))
        showToast(action === 'approve' ? 'Payment approved & confirmed' : 'Payment rejected & order cancelled', action === 'approve' ? 'success' : 'info')
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to verify payment'), 'error')
    } finally {
      setActionId(null)
    }
  }

  const cancelOrder = async (orderId) => {
    await updateStatus(orderId, 'CANCELLED')
    setDetail(null)
  }

  // Search + status filtering is done server-side; `total` reflects the filtered result count
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1
  const paged = orders

  useEffect(() => { setPage(1) }, [statusFilter])

  const kpi = useMemo(() => stats
    ? {
      total: stats.total,
      new: stats.byStatus?.NEW || 0,
      packing: stats.byStatus?.PACKING || 0,
      delivering: stats.byStatus?.OUT_FOR_DELIVERY || 0,
      revenue: stats.revenue || 0,
    }
    : {
      total, new: 0, packing: 0, delivering: 0, revenue: 0,
    }
  , [stats, total])

  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // Fetch every page of the current filter (not just the visible page)
      const all = []
      let p = 1
      const CHUNK = 100
      while (p <= 50) { // hard cap of 5000 rows
        const res = await api.get('/admin/shoporders/all', { params: { page: p, limit: CHUNK, status: statusFilter, search: searchQuery } })
        const batch = res.data?.data?.orders || []
        all.push(...batch)
        if (batch.length < CHUNK) break
        p += 1
      }
      if (all.length === 0) { showToast('No orders to export', 'info'); return }
      const headers = ['Order #', 'Order ID', 'Customer', 'Phone', 'Shop', 'Items', 'Total', 'Payment Method', 'Payment Status', 'UTR', 'Status', 'Created At']
      const rows = all.map(o => [
        o.orderNumber || o._id?.slice(-6),
        o._id,
        o.customerId?.name || '—',
        o.customerId?.phone || '',
        o.shopId?.name || '—',
        o.items?.length || 0,
        o.total || 0,
        o.payment?.method || 'UPI',
        o.payment?.status || 'PENDING',
        o.payment?.utrNumber || '',
        o.status,
        o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : ''
      ])
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`${all.length} orders exported`)
    } catch (err) {
      if (!isAbortError(err)) showToast(extractErrorMessage(err, 'Failed to export orders'), 'error')
    } finally { setExporting(false) }
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
          <div className="page-subtitle">Manage all shop orders — update status, view details, verify UPI payments</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchOrders}><RefreshCw size={16} /> Refresh</button>
          <button className="btn-secondary" onClick={exportCsv} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Orders', value: kpi.total, color: '#2EF7F0' },
          { label: 'New', value: kpi.new, color: '#2563EB' },
          { label: 'Packing', value: kpi.packing, color: '#F59E0B' },
          { label: 'Delivering', value: kpi.delivering, color: '#8B5CF6' },
          { label: 'Paid / delivered order value', value: `₹${kpi.revenue.toLocaleString('en-IN')}`, color: '#10B981' },
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
          <input placeholder="Search order #, customer, shop, UTR..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {['all', 'NEW', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map(f => (
            <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : STATUS_LABEL[f] || f}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {total} result{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading orders...</div>
        ) : fetchError ? (
          <EmptyState
            icon="⚠️"
            title="Couldn't load orders"
            description="The server didn't respond. Check your connection and try again."
            action={<button className="btn btn-primary" onClick={() => fetchOrders()}>↻ Retry</button>}
          />
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
                    const isPendingUpi = o.payment?.status === 'PENDING_VERIFICATION' || (o.payment?.method === 'UPI' && o.payment?.status !== 'PAID')
                    return (
                      <tr key={o._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{o.orderNumber || o._id?.slice(-6)}</span>
                            <button className="copy-btn" onClick={() => copyOrderId(o._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', padding: 2 }} title="Copy ID"><Copy size={12} /></button>
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
                        <td>
                          <div>
                            <span className={`badge badge-${o.payment?.status === 'PAID' || o.payment?.method === 'WALLET' ? 'success' : isPendingUpi ? 'warning' : 'info'}`}>
                              {isPendingUpi ? '⏳ UPI Pending' : o.payment?.method || 'UPI'}
                            </span>
                            {o.payment?.utrNumber && (
                              <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--mid)', marginTop: 2 }}>
                                UTR: {o.payment.utrNumber}
                              </div>
                            )}
                          </div>
                        </td>
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
      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Order Details"
        subtitle={detail ? (detail.orderNumber || detail._id) : ''}
        width="520px"
      >
        {detail && (
          <div>
            {/* Status Banner */}
            <div style={{ background: 'var(--input-bg)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center', border: '1px solid var(--border)' }}>
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
              <div className="detail-row"><span>Delivery Slot</span><strong style={{ color: 'var(--primary)' }}>{detail.deliverySlot?.time || detail.deliverySlot?.label || (typeof detail.deliverySlot === 'string' ? detail.deliverySlot : 'Standard Delivery')}</strong></div>
              <div className="detail-row">
                <span>Payment</span>
                <strong>
                  {detail.payment?.method || 'UPI'}
                  <span style={{ marginLeft: 6, fontSize: 11, color: detail.payment?.status === 'PAID' ? '#10B981' : '#F59E0B' }}>
                    ({detail.payment?.status || 'PENDING'})
                  </span>
                </strong>
              </div>
              {detail.payment?.utrNumber && (
                <div className="detail-row">
                  <span>12-Digit UTR</span>
                  <strong style={{ fontFamily: 'monospace', color: '#F59E0B' }}>{detail.payment.utrNumber}</strong>
                </div>
              )}
              {detail.payment?.escrowStatus && <div className="detail-row"><span>Escrow</span><strong>{detail.payment.escrowStatus}</strong></div>}
              <div className="detail-row"><span>Delivery Address</span><strong>{detail.deliveryAddress || '—'}</strong></div>
              {(detail.deliveryStaffName || detail.deliveryStaffPhone) && <div className="detail-row"><span>Delivery Staff</span><strong>{detail.deliveryStaffName || '—'}{detail.deliveryStaffPhone ? ` · ${detail.deliveryStaffPhone}` : ''}</strong></div>}
              <div className="detail-row"><span>Date</span><strong>{new Date(detail.createdAt).toLocaleString('en-IN')}</strong></div>
            </div>

            {/* Anti-Fraud Pending UTR Alert inside Drawer */}
            {(detail.payment?.status === 'PENDING_VERIFICATION' || (detail.payment?.method === 'UPI' && detail.payment?.status !== 'PAID')) && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 10,
                padding: 14,
                marginTop: 16
              }}>
                <div style={{ fontWeight: 800, color: '#F59E0B', fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={16} /> Direct UPI Payment Verification Required
                </div>
                <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 12 }}>
                  Customer submitted 12-digit UTR: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{detail.payment?.utrNumber || '—'}</strong>. Verify this in your bank account before approving.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-success btn-sm"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    disabled={actionId === detail._id}
                    onClick={() => verifyPayment(detail._id, 'approve')}
                  >
                    <CheckCircle size={14} /> {actionId === detail._id ? 'Verifying…' : 'Confirm Bank Credit'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    disabled={actionId === detail._id}
                    onClick={() => verifyPayment(detail._id, 'reject', 'Fake / Unreceived UTR in bank')}
                  >
                    <XCircle size={14} /> {actionId === detail._id ? 'Rejecting…' : 'Reject (Fake UTR)'}
                  </button>
                </div>
              </div>
            )}

            {/* Items */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Items</div>
            <div style={{ background: 'var(--input-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {(detail.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < detail.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--mid)' }}>Qty: {item.qty} × ₹{item.price}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{(item.price * item.qty).toLocaleString('en-IN')}</div>
                </div>
              ))}
              {[
                ['Subtotal', detail.subtotal],
                ['Delivery fee', detail.deliveryFee],
                ['Discount', detail.discount ? -detail.discount : 0],
                ['Promo discount' + (detail.promoCode ? ` (${detail.promoCode})` : ''), detail.promoDiscount ? -detail.promoDiscount : 0],
                ['Platform fee', detail.platformFee],
                ['GST', detail.gstAmount],
              ].filter(([, v]) => v).map(([label, v]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: 12, color: 'var(--mid)', borderTop: '1px solid var(--border)' }}>
                  <span>{label}</span><span>{v < 0 ? '−' : ''}₹{Math.abs(v).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-card)', fontWeight: 800, borderTop: '1px solid var(--border)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>₹{(detail.total || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {(detail.statusHistory || []).length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 12 }}>Status History</div>
                <div className="detail-grid">
                  {detail.statusHistory.map((h, i) => (
                    <div key={i} className="detail-row">
                      <span>{h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN') : '—'}</span>
                      <strong>{STATUS_LABEL[h.status] || h.status}{h.note ? ` — ${h.note}` : ''}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}

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
        )}
      </Drawer>

      {/* Confirm Modals */}
      {confirm?.type === 'advance' && (
        <ConfirmModal
          title="Update Order Status"
          message={`Mark ${confirm.name} as "${STATUS_LABEL[confirm.next]}"? This action is done on behalf of the shop owner.`}
          danger={false}
          confirmText={`Mark as ${STATUS_LABEL[confirm.next]}`}
          loading={actionId === confirm.id}
          onConfirm={() => updateStatus(confirm.id, confirm.next)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'cancel' && (
        <ConfirmModal
          title="Cancel Order"
          message={`Cancel ${confirm.name}? This action is done on behalf of the shop owner and cannot be undone.`}
          confirmText="Cancel Order"
          loading={actionId === confirm.id}
          onConfirm={() => cancelOrder(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
