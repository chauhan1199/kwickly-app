import React, { useState, useEffect } from 'react'
import { Search, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, Eye, Download } from 'lucide-react'
import Badge from '../../components/common/Badge'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError, extractErrorMessage } from '../../utils/errorUtils'
import ConfirmModal from '../../components/ConfirmModal'
import Toast from '../../components/Toast'
import Drawer from '../../components/common/Drawer'

const ROLE_COLORS = { CUSTOMER: '#00B4D8', WORKER: '#8B5CF6', SHOP: '#10B981' }

const TYPE_VARIANT = {
  JOB_CREDIT: 'success', ORDER_CREDIT: 'success', REFERRAL_BONUS: 'success',
  REFUND: 'info', WITHDRAWAL: 'warning', SUBSCRIPTION: 'purple',
  ORDER_DEBIT: 'danger', JOB_DEBIT: 'danger', ADJUSTMENT: 'info', TOPUP: 'success', COMMISSION: 'danger', ORDER_PAYMENT: 'warning'
}

const CREDIT_TYPES = ['JOB_CREDIT', 'ORDER_CREDIT', 'REFUND', 'REFERRAL_BONUS', 'TOPUP']

const isCreditTxn = (t) => {
  if (CREDIT_TYPES.includes(t.type)) return true
  if (t.type === 'ADJUSTMENT') return !(t.description || '').toLowerCase().includes('debit')
  return false
}

export default function Wallets() {
  const api = useAbortableRequest()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [txns, setTxns] = useState([])
  const [txnLoading, setTxnLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmWallet, setConfirmWallet] = useState(null)

  // All transactions state
  const [allTxns, setAllTxns] = useState([])
  const [allTxnsLoading, setAllTxnsLoading] = useState(false)
  const [txnSearch, setTxnSearch] = useState('')
  const [txnTypeFilter, setTxnTypeFilter] = useState('all')
  const [txnRoleFilter, setTxnRoleFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (tab === 'transactions' && allTxns.length === 0) fetchAllTxns() }, [tab])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [cRes, wRes, sRes] = await Promise.allSettled([
        api.get('/admin/customers', { params: { limit: 500 } }),
        api.get('/admin/workers', { params: { limit: 500 } }),
        api.get('/admin/shops', { params: { limit: 500 } })
      ])
      const customers = cRes.status === 'fulfilled' ? (cRes.value.data.data?.customers || []).map(c => ({ ...c, _role: 'CUSTOMER', _walletUserId: c._id })) : []
      const workers = wRes.status === 'fulfilled' ? (wRes.value.data.data?.workers || []).map(w => ({ ...w, _role: 'WORKER', _walletUserId: w._id })) : []
      const shops = sRes.status === 'fulfilled' ? (sRes.value.data.data?.shops || []).map(s => ({
        ...s, _role: 'SHOP', _walletUserId: s.ownerId?._id || s.ownerId,
        _displayName: s.name, _phone: s.ownerId?.phone || '—', _ownerName: s.ownerId?.name || '—',
        wallet: s.wallet || { balance: 0 }
      })) : []
      setUsers([...customers, ...workers, ...shops])
    } catch (e) {
      if (isAbortError(e)) return
      showToast('Failed to load wallet data', 'error')
    } finally { setLoading(false) }
  }

  const fetchAllTxns = async () => {
    setAllTxnsLoading(true)
    try {
      let res
      try { res = await api.get('/admin/ledger', { params: { limit: 500 } }) }
      catch { res = await api.get('/admin/wallet/transactions', { params: { limit: 500 } }) }
      if (res.data.status === 'success') {
        const raw = res.data.data
        setAllTxns(Array.isArray(raw) ? raw : raw.transactions || raw.txns || raw.data || [])
      }
    } catch (e) {
      if (isAbortError(e)) return
      showToast('Failed to load transactions', 'error')
    } finally { setAllTxnsLoading(false) }
  }

  const filteredUsers = users.filter(u => {
    const name = u._role === 'SHOP' ? (u._displayName || u.name) : u.name
    const phone = u._role === 'SHOP' ? u._phone : u.phone
    const matchSearch = !search || 
      name?.toLowerCase().includes(search.toLowerCase()) || 
      phone?.includes(search) || 
      (u._role === 'SHOP' && u._ownerName?.toLowerCase().includes(search.toLowerCase()))
      
    const matchRole = roleFilter === 'all' || u._role === roleFilter.toUpperCase()
    return matchSearch && matchRole
  })

  const filteredTxns = allTxns.filter(t => {
    const name = t.userId?.name || t.userName || t.worker || ''
    const desc = t.description || ''
    const matchSearch = !txnSearch || name.toLowerCase().includes(txnSearch.toLowerCase()) || desc.toLowerCase().includes(txnSearch.toLowerCase())
    const matchType = txnTypeFilter === 'all' || t.type === txnTypeFilter
    const matchRole = txnRoleFilter === 'all' || (t.userId?.role || '').toUpperCase() === txnRoleFilter.toUpperCase()
    return matchSearch && matchType && matchRole
  })

  const totalBalance = users.reduce((s, u) => s + (u.wallet?.balance || 0), 0)
  const totalCredit = allTxns.filter(t => isCreditTxn(t)).reduce((s, t) => s + (t.amount || 0), 0)
  const totalDebit = allTxns.filter(t => !isCreditTxn(t)).reduce((s, t) => s + (t.amount || 0), 0)

  const openDetail = async (user) => {
    setSelected(user)
    setAmount('')
    setDesc('')
    setTxns([])
    setTxnLoading(true)
    try {
      const res = await api.get('/admin/wallet/transactions', { params: { userId: user._walletUserId, limit: 30 } })
      if (res.data.status === 'success') setTxns(res.data.data.txns || [])
    } catch { }
    finally { setTxnLoading(false) }
  }

  const adjustWallet = async (debit) => {
    if (!amount || Number(amount) <= 0) return
    setAdjusting(true)
    try {
      await api.post('/wallet/adjust', {
        userId: selected._walletUserId, amount: Number(amount), type: 'ADJUSTMENT',
        debit, description: desc || `Admin ${debit ? 'debit' : 'credit'}`
      })
      showToast(`₹${Number(amount).toLocaleString('en-IN')} ${debit ? 'debited from' : 'credited to'} ${selected._role?.toLowerCase()} wallet`)
      setAmount('')
      setDesc('')
      await fetchAll()
      if (tab === 'transactions') fetchAllTxns()
      window.dispatchEvent(new Event('admin-action'))
    } catch (e) {
      showToast(extractErrorMessage(e, 'Failed to adjust wallet'), 'error')
    } finally { setAdjusting(false) }
  }

  const exportCsv = () => {
    if (filteredTxns.length === 0) return
    const headers = ['Date', 'User', 'Role', 'Type', 'Description', 'Amount', 'Balance After']
    const rows = filteredTxns.map(t => [
      new Date(t.createdAt).toLocaleString('en-IN'),
      t.userId?.name || t.userName || t.worker || 'Unknown',
      t.userId?.role || '—',
      t.type || '',
      t.description || '',
      `${isCreditTxn(t) ? '+' : '-'}${t.amount || 0}`,
      t.balance ?? t.balanceAfter ?? 0
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">💰 Wallet Management</h1>
          <p className="page-subtitle">View and manage all user wallets — credit, debit, and track transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('users')}>User Wallets</button>
          <button className={`btn ${tab === 'transactions' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('transactions')}>All Transactions</button>
        </div>
      </div>

      {tab === 'users' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Wallet Balance', value: `₹${totalBalance.toLocaleString('en-IN')}`, color: '#10B981' },
              { label: 'Customers', value: users.filter(u => u._role === 'CUSTOMER').length, color: '#00B4D8' },
              { label: 'Workers', value: users.filter(u => u._role === 'WORKER').length, color: '#8B5CF6' },
              { label: 'Shops', value: users.filter(u => u._role === 'SHOP').length, color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="filters-row">
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="customer">Customer</option>
              <option value="worker">Worker</option>
              <option value="shop">Shop</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
              {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-card">
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading wallets...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>User</th><th>Role</th><th>Contact</th><th>Wallet Balance</th><th>Bank / UPI</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const name = u._role === 'SHOP' ? (u._displayName || u.name) : u.name
                    const phone = u._role === 'SHOP' ? u._phone : u.phone
                    const balance = u.wallet?.balance || 0
                    const bank = u.wallet?.bankDetails?.accountNumber
                    const upi = u.wallet?.upiId
                    return (
                      <tr key={u._walletUserId} style={{ cursor: 'pointer' }} onClick={() => openDetail(u)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar avatar-sm" style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[u._role]}, ${ROLE_COLORS[u._role]}88)` }}>
                              {(name || '?')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{name || 'Unknown'}</div>
                              <div style={{ fontSize: 11, color: 'var(--mid)' }}>ID: {u._walletUserId?.slice(-6)}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge label={u._role} variant={u._role === 'WORKER' ? 'purple' : u._role === 'SHOP' ? 'success' : 'info'} /></td>
                        <td>
                          <div style={{ fontSize: 13 }}>{phone || '—'}</div>
                          {u._role === 'SHOP' && <div style={{ fontSize: 11, color: 'var(--mid)' }}>{u._ownerName}</div>}
                        </td>
                        <td><span style={{ fontWeight: 800, color: balance > 0 ? '#059669' : 'var(--mid)', fontSize: 15 }}>₹{balance.toLocaleString('en-IN')}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--mid)' }}>
                          {bank && <div>🏦 {bank.slice(-4).padStart(bank.length, '*')}</div>}
                          {upi && <div>📱 {upi}</div>}
                          {!bank && !upi && <span>Not added</span>}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-outline btn-sm" onClick={() => openDetail(u)}><Eye size={13} /> Manage</button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>No users found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* All Transactions Tab */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Credits', value: `₹${totalCredit.toLocaleString('en-IN')}`, color: '#059669' },
              { label: 'Total Debits', value: `₹${totalDebit.toLocaleString('en-IN')}`, color: '#dc2626' },
              { label: 'Net Flow', value: `₹${(totalCredit - totalDebit).toLocaleString('en-IN')}`, color: '#0e9aa7' },
            ].map(s => (
              <div key={s.label} className="stat-card-simple" style={{ borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="filters-row">
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search by user or description..." value={txnSearch} onChange={e => setTxnSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={txnTypeFilter} onChange={e => setTxnTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.keys(TYPE_VARIANT).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select className="filter-select" value={txnRoleFilter} onChange={e => setTxnRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="CUSTOMER">Customer</option>
              <option value="WORKER">Worker</option>
              <option value="SHOP">Shop</option>
            </select>
            <button className="btn-secondary" onClick={() => fetchAllTxns()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn-secondary" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Export CSV
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
              {filteredTxns.length} transaction{filteredTxns.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-card">
            {allTxnsLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading transactions...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>User</th><th>Role</th><th>Type</th><th>Description</th><th>Amount</th><th>Balance After</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {filteredTxns.map((t, i) => {
                    const credit = isCreditTxn(t)
                    return (
                      <tr key={t._id || t.id || i}>
                        <td>
                          <div className="cell-primary">{t.userId?.name || t.worker || t.userName || 'Unknown'}</div>
                          <div className="cell-muted" style={{ fontSize: 11 }}>{t.userId?._id?.slice(-6) || '—'}</div>
                        </td>
                        <td>
                          {t.userId?.role ? <Badge label={t.userId.role} variant={t.userId.role === 'WORKER' ? 'purple' : t.userId.role === 'SHOP' ? 'success' : 'info'} /> : <span style={{ color: 'var(--mid)' }}>—</span>}
                        </td>
                        <td><Badge label={(t.type || 'UNKNOWN').replace(/_/g, ' ')} variant={TYPE_VARIANT[t.type] || 'neutral'} /></td>
                        <td><span className="cell-muted" style={{ fontSize: 12 }}>{t.description || '—'}</span></td>
                        <td>
                          <span style={{ fontWeight: 800, color: credit ? '#059669' : '#dc2626' }}>
                            {credit ? '+' : '-'}₹{(t.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td><strong>₹{(t.balance ?? t.balanceAfter ?? 0).toLocaleString('en-IN')}</strong></td>
                        <td className="cell-muted" style={{ fontSize: 12 }}>
                          {new Date(t.createdAt || t.txnDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredTxns.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Detail Drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Wallet Management"
        subtitle={selected ? (selected._role === 'SHOP' ? selected._displayName || selected.name : selected.name) : ''}
        width="440px"
      >
        {selected && (
          <div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <div className="avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[selected._role]}, ${ROLE_COLORS[selected._role]}88)` }}>
                {(selected._role === 'SHOP' ? selected._displayName : selected.name || '?')[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {selected._role === 'SHOP' ? selected._displayName || selected.name : selected.name}
                </div>
                <div style={{ color: 'var(--mid)', fontSize: 13 }}>
                  {selected._role === 'SHOP' ? selected._phone : selected.phone}
                </div>
                <div style={{ marginTop: 4 }}><Badge label={selected._role} variant={selected._role === 'WORKER' ? 'purple' : selected._role === 'SHOP' ? 'success' : 'info'} /></div>
              </div>
            </div>

            <div className="divider" />

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Balance & Banking</div>
            <div className="detail-grid">
              <div className="detail-row">
                <span>Wallet Balance</span>
                <strong style={{ color: '#059669', fontSize: 18 }}>₹{(selected.wallet?.balance || 0).toLocaleString('en-IN')}</strong>
              </div>
              {selected.wallet?.bankDetails?.accountNumber && (
                <>
                  <div className="detail-row"><span>Account No</span><strong>{selected.wallet.bankDetails.accountNumber}</strong></div>
                  <div className="detail-row"><span>IFSC</span><strong>{selected.wallet.bankDetails.ifscCode}</strong></div>
                  <div className="detail-row"><span>Bank</span><strong>{selected.wallet.bankDetails.bankName}</strong></div>
                </>
              )}
              {selected.wallet?.upiId && <div className="detail-row"><span>UPI ID</span><strong>{selected.wallet.upiId}</strong></div>}
            </div>

            <div className="divider" />

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Wallet size={14} /> Admin Wallet Adjust
            </div>
            <div style={{ padding: 14, background: 'var(--input-bg)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="form-control" type="number" min="1" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} style={{ fontSize: 13 }} />
                <input className="form-control" placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} style={{ fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success" style={{ flex: 1 }} disabled={adjusting || !amount || Number(amount) <= 0} onClick={() => setConfirmWallet({ debit: false })}>
                  {adjusting ? '...' : <><ArrowDownCircle size={14} /> Credit ₹</>}
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} disabled={adjusting || !amount || Number(amount) <= 0} onClick={() => setConfirmWallet({ debit: true })}>
                  {adjusting ? '...' : <><ArrowUpCircle size={14} /> Debit ₹</>}
                </button>
              </div>
            </div>

            <div className="divider" />

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Recent Transactions</div>
            {txnLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--mid)', fontSize: 13 }}>Loading transactions...</div>
            ) : txns.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--mid)', fontSize: 13 }}>No transactions yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {txns.map(t => {
                  const credit = isCreditTxn(t)
                  return (
                    <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.description || t.type?.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>
                          <Badge label={(t.type || '').replace(/_/g, ' ')} variant={TYPE_VARIANT[t.type] || 'neutral'} style={{ fontSize: 10 }} />
                          <span style={{ marginLeft: 6 }}>{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: credit ? '#059669' : '#dc2626' }}>
                          {credit ? '+' : '-'}₹{t.amount?.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--mid)' }}>Bal: ₹{(t.balance || 0).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Drawer>
      {confirmWallet && (
        <ConfirmModal
          title={confirmWallet.debit ? 'Debit Wallet' : 'Credit Wallet'}
          message={`${confirmWallet.debit ? 'Debit' : 'Credit'} ₹${Number(amount || 0).toLocaleString('en-IN')} ${confirmWallet.debit ? 'from' : 'to'} ${selected._role?.toLowerCase()} wallet for ${selected._role === 'SHOP' ? selected._displayName || selected.name : selected.name}?`}
          danger={confirmWallet.debit}
          confirmText={confirmWallet.debit ? 'Debit ₹' + Number(amount || 0).toLocaleString('en-IN') : 'Credit ₹' + Number(amount || 0).toLocaleString('en-IN')}
          onConfirm={() => { adjustWallet(confirmWallet.debit); setConfirmWallet(null); }}
          onClose={() => setConfirmWallet(null)}
        />
      )}
    </div>
  )
}
