import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { Search, RefreshCw, Eye, CheckCircle, Package, Store, Banknote, ListChecks, CheckCircle2, XCircle, ChevronRight, X } from 'lucide-react'

const PAGE_SIZE = 15

export default function Settlements() {
  const api = useAbortableRequest();
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [settleNote, setSettleNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSettlements() }, [])

  useEffect(() => { setPage(1) }, [search, filter])

  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/settlements')
      if (res.data.status === 'success') {
        setSettlements(res.data.data || [])
      }
    } catch (err) {
      if (isAbortError(err)) return
      showToast('Failed to load settlements', 'error')
    }
    finally { setLoading(false) }
  }

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const filtered = settlements.filter(s => {
    const matchSearch = s.shopId?.name?.toLowerCase().includes(search.toLowerCase()) || 
                        s.orderId?.orderNumber?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filter === 'all' || s.status === filter
    return matchSearch && matchStatus
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleSettle = async (id, note = '') => {
    setSaving(true)
    try {
      await api.post(`/admin/settlements/${id}/settle`, { note: note || 'Settled by admin' })
      showToast('Payment settled successfully')
      window.dispatchEvent(new Event('admin-action'))
      fetchSettlements()
      setDetail(null)
    } catch (err) { showToast(err.response?.data?.message || 'Error settling payment', 'error') }
    finally { setSaving(false); setConfirm(null) }
  }

  const handleBulkSettle = async () => {
    const pendingIds = filtered.filter(s => s.status === 'PENDING').map(s => s._id)
    if (pendingIds.length === 0) { showToast('No pending settlements selected', 'error'); return }
    
    setConfirm({
      type: 'bulkSettle',
      title: 'Bulk Settle Payments',
      message: `Are you sure you want to process ${pendingIds.length} pending settlements? This will credit the respective shop wallets instantly.`,
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.post('/admin/settlements/bulk-settle', { settlementIds: pendingIds })
          showToast(`${pendingIds.length} settlements processed successfully`)
          window.dispatchEvent(new Event('admin-action'))
          fetchSettlements()
        } catch (err) { showToast(err.response?.data?.message || 'Bulk settlement failed', 'error') }
        finally { setSaving(false); setConfirm(null) }
      }
    })
  }

  const columns = [
    { header: 'Type', render: (s) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.type === 'PRODUCT_ORDER' ? <Package size={16} /> : <ListChecks size={16} />}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.type.replace('_', ' ')}</div>
      </div>
    )},
    { header: 'Shop', render: (s) => (
      <div>
        <div className="cell-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Store size={14} color="var(--mid)" /> {s.shopId?.name || 'Unknown'}</div>
      </div>
    )},
    { header: 'Order Ref', render: (s) => <div className="cell-muted" style={{ fontFamily: 'monospace' }}>{s.orderId?.orderNumber || '—'}</div> },
    { header: 'Amount', render: (s) => (
      <div>
        <div style={{ fontSize: 13, color: 'var(--mid)', textDecoration: 'line-through', opacity: 0.7 }}>₹{s.totalAmount}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#10B981' }}>₹{s.shopEarning}</div>
      </div>
    )},
    { header: 'Commission', render: (s) => <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>₹{s.platformCommission}</div> },
    { header: 'Status', render: (s) => (
      <Badge label={s.status} variant={s.status === 'SETTLED' ? 'success' : s.status === 'PENDING' ? 'warning' : 'neutral'} />
    )},
    { header: 'Actions', render: (s) => (
      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="View Details" onClick={() => setDetail(s)}><Eye size={15} /></button>
        {s.status === 'PENDING' && (
          <button className="btn-icon success" title="Settle Now" onClick={() => setConfirm({ 
            type: 'settle', title: 'Settle Payment', message: `Transfer ₹${s.shopEarning} to ${s.shopId?.name}'s wallet?`, onConfirm: () => handleSettle(s._id)
          })}><CheckCircle size={15} /></button>
        )}
      </div>
    )}
  ];

  const pendingCount = settlements.filter(s => s.status === 'PENDING').length
  const settledCount = settlements.filter(s => s.status === 'SETTLED').length
  const pendingAmount = settlements.filter(s => s.status === 'PENDING').reduce((sum, s) => sum + s.shopEarning, 0)
  const settledAmount = settlements.filter(s => s.status === 'SETTLED').reduce((sum, s) => sum + s.shopEarning, 0)

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmModal title={confirm.title} message={confirm.message} confirmText={saving ? 'Processing...' : 'Confirm'} onConfirm={confirm.onConfirm} onClose={() => !saving && setConfirm(null)} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Settlements</div>
          <div className="page-subtitle">Manage platform payouts and shop earnings</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {pendingCount > 0 && filter === 'PENDING' && (
            <button className="btn-primary" onClick={handleBulkSettle} disabled={saving} style={{ background: '#10B981', borderColor: '#10B981' }}>
              {saving ? 'Processing...' : `Bulk Settle All (${pendingCount})`}
            </button>
          )}
          <button className="btn-secondary" onClick={fetchSettlements} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #F59E0B` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B' }}>{pendingCount}</div>
          <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Pending Settlements</div>
        </div>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #F59E0B`, background: '#F59E0B11' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B' }}>₹{pendingAmount.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600, marginTop: 4 }}>Total Pending Amount</div>
        </div>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #10B981` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#10B981' }}>{settledCount}</div>
          <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Processed Settlements</div>
        </div>
        <div className="stat-card-simple" style={{ borderTop: `3px solid #10B981`, background: '#10B98111' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#10B981' }}>₹{settledAmount.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 13, color: '#059669', fontWeight: 600, marginTop: 4 }}>Total Processed Amount</div>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box"><Search size={16} /><input placeholder="Search shop or order ID..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div style={{ display: 'flex', background: 'var(--input-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
          {['all', 'PENDING', 'SETTLED', 'CANCELLED'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', background: filter === f ? 'var(--bg)' : 'transparent', border: 'none', borderRadius: 6,
              color: filter === f ? 'var(--text-primary)' : 'var(--mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize'
            }}>
              {f.toLowerCase()}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading settlements...</div>
        ) : paged.length === 0 ? (
          <EmptyState icon={<Banknote size={48} color="var(--mid)" opacity={0.5} />} title="No settlements found" description={search ? 'Try a different search term' : 'All clear! No settlements here.'} />
        ) : (
          <>
            <Table columns={columns} data={paged} onRowClick={setDetail} emptyMessage="No settlements found" />
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />}
          </>
        )}
      </div>

      {detail && (
        <Modal open={!!detail} onClose={() => !saving && setDetail(null)} title="Settlement Details" width="500px">
          <div style={{ padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>₹{detail.shopEarning}</div>
                <div style={{ fontSize: 13, color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={14} /> {detail.shopId?.name}
                </div>
              </div>
              <Badge label={detail.status} variant={detail.status === 'SETTLED' ? 'success' : detail.status === 'PENDING' ? 'warning' : 'neutral'} />
            </div>

            <div style={{ background: 'var(--input-bg)', borderRadius: 12, padding: 16, marginBottom: 24, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Transaction Breakdown</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: 'var(--mid)' }}>Customer Paid (Total)</span>
                <span style={{ fontWeight: 600 }}>₹{detail.totalAmount}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: '#F59E0B' }}>Platform Commission</span>
                <span style={{ fontWeight: 600, color: '#F59E0B' }}>- ₹{detail.platformCommission}</span>
              </div>
              
              <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                <span>Shop Payout</span>
                <span style={{ color: '#10B981' }}>₹{detail.shopEarning}</span>
              </div>
            </div>

            <div className="detail-grid" style={{ marginBottom: 24 }}>
              <div className="detail-row"><span>Type</span><strong>{detail.type.replace('_', ' ')}</strong></div>
              <div className="detail-row"><span>Order Ref</span><strong>{detail.orderId?.orderNumber || detail.orderId?._id?.slice(-8) || '—'}</strong></div>
              <div className="detail-row"><span>Date Created</span><strong>{new Date(detail.createdAt).toLocaleString('en-IN')}</strong></div>
              {detail.status === 'SETTLED' && (
                <>
                  <div className="detail-row"><span>Settled On</span><strong>{new Date(detail.settledAt).toLocaleString('en-IN')}</strong></div>
                  <div className="detail-row"><span>Admin Note</span><strong>{detail.note || '—'}</strong></div>
                </>
              )}
            </div>

            {detail.status === 'PENDING' && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 12 }}>
                <label className="form-label" style={{ marginBottom: 8 }}>Admin Note (Optional)</label>
                <input className="form-control" placeholder="e.g. Cleared batch payout" value={settleNote} onChange={e => setSettleNote(e.target.value)} style={{ marginBottom: 16 }} />
                
                <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: 15, background: '#10B981', borderColor: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => handleSettle(detail._id, settleNote)} disabled={saving}>
                  {saving ? <span className="spinner-sm" /> : <CheckCircle2 size={18} />}
                  Settle ₹{detail.shopEarning} Now
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
