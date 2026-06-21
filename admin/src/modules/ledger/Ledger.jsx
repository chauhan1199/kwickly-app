import React, { useState, useEffect } from 'react'
import { Search, Download, RefreshCw } from 'lucide-react'
import Badge from '../../components/Badge'
import api from '../../services/api'

const TYPE_VARIANT = {
  JOB_CREDIT:    'success',
  ORDER_CREDIT:  'success',
  REFERRAL_BONUS:'success',
  REFUND:        'info',
  WITHDRAWAL:    'warning',
  SUBSCRIPTION:  'purple',
  ORDER_DEBIT:   'danger',
  JOB_DEBIT:     'danger',
  ADJUSTMENT:    'neutral',
  COMMISSION:    'danger',
}

const CREDIT_TYPES = ['JOB_CREDIT', 'ORDER_CREDIT', 'REFUND', 'REFERRAL_BONUS']

export default function Ledger() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [typeFilter, setType]           = useState('all')
  const [roleFilter, setRole]           = useState('all')

  useEffect(() => { fetchTransactions() }, [])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      // Try the admin ledger endpoint first, fall back to wallet transactions
      let res
      try {
        res = await api.get('/admin/ledger')
      } catch {
        res = await api.get('/wallet/transactions')
      }
      if (res.data.status === 'success') {
        const raw = res.data.data
        setTransactions(Array.isArray(raw) ? raw : raw.transactions || raw.txns || raw.data || [])
      }
    } catch (e) {
      console.error('Ledger fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = transactions.filter(t => {
    const name   = t.userId?.name || t.worker || t.userName || ''
    const desc   = t.description || t.desc || ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
                        desc.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter === 'all' || t.type === typeFilter
    const matchRole   = roleFilter === 'all' || (t.userId?.role || '').toUpperCase() === roleFilter.toUpperCase()
    return matchSearch && matchType && matchRole
  })

  const totalCredit = transactions.filter(t => CREDIT_TYPES.includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0)
  const totalDebit  = transactions.filter(t => !CREDIT_TYPES.includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0)

  const isCredit = (t) => CREDIT_TYPES.includes(t.type)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📖 Platform Ledger</h1>
          <p className="page-subtitle">All wallet transactions across the platform</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchTransactions} style={{ display:'flex',alignItems:'center',gap:8 }}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn-secondary" style={{ display:'flex',alignItems:'center',gap:8 }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:24 }}>
        {[
          { label:'Total Credits', value:`₹${totalCredit.toLocaleString('en-IN')}`, color:'#059669' },
          { label:'Total Debits',  value:`₹${totalDebit.toLocaleString('en-IN')}`,  color:'#dc2626' },
          { label:'Net Flow',      value:`₹${(totalCredit - totalDebit).toLocaleString('en-IN')}`, color:'#0e9aa7' },
        ].map(s => (
          <div key={s.label} className="stat-card-simple" style={{ borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:13, color:'var(--mid)', marginTop:4, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search by user or description..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={typeFilter} onChange={e => setType(e.target.value)}>
          <option value="all">All Types</option>
          {Object.keys(TYPE_VARIANT).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <select className="filter-select" value={roleFilter} onChange={e => setRole(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="WORKER">Worker</option>
          <option value="SHOP">Shop</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding:48, textAlign:'center', color:'var(--mid)' }}>Loading transactions...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Type</th><th>Description</th><th>Amount</th><th>Balance After</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t._id || t.id || i}>
                  <td>
                    <div className="cell-primary">{t.userId?.name || t.worker || 'Unknown'}</div>
                    <div className="cell-muted">{t.userId?.role || '—'}</div>
                  </td>
                  <td><Badge label={(t.type || 'UNKNOWN').replace('_',' ')} variant={TYPE_VARIANT[t.type] || 'neutral'} /></td>
                  <td><span className="cell-muted">{t.description || t.desc || '—'}</span></td>
                  <td>
                    <span style={{ fontWeight:800, color: isCredit(t) ? '#059669' : '#dc2626' }}>
                      {isCredit(t) ? '+' : '-'}₹{(t.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td><strong>₹{(t.balance ?? t.balanceAfter ?? 0).toLocaleString('en-IN')}</strong></td>
                  <td className="cell-muted">
                    {new Date(t.createdAt || t.txnDate || Date.now()).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="table-empty">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
