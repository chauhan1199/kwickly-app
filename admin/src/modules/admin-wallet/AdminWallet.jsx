import React, { useState, useEffect, useRef } from 'react'
import { Search, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, Download, Building2, CreditCard } from 'lucide-react'
import Badge from '../../components/common/Badge'
import useAbortableRequest from '../../hooks/useAbortableRequest'

const TXN_VARIANT = {
  PLATFORM_FEE_COLLECTED: 'success', COMMISSION_COLLECTED: 'success', SETTLEMENT_CREDIT: 'success',
  MANUAL_CREDIT: 'info', TOPUP: 'info',
  MANUAL_DEBIT: 'danger', PAYOUT_DEBIT: 'danger', WORKER_PAYOUT: 'danger',
  SHOP_PAYOUT: 'danger', WITHDRAWAL: 'warning', REFUND_DEBIT: 'danger'
}

const CREDIT_TYPES = ['PLATFORM_FEE_COLLECTED', 'COMMISSION_COLLECTED', 'SETTLEMENT_CREDIT', 'MANUAL_CREDIT', 'TOPUP']

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

const validateBankForm = (form) => {
  const errors = {}
  if (!form.accountHolder?.trim()) errors.accountHolder = 'Account holder name is required'
  if (!form.accountNumber?.trim()) errors.accountNumber = 'Account number is required'
  else if (!/^\d{9,18}$/.test(form.accountNumber.trim())) errors.accountNumber = 'Account number must be 9-18 digits'
  if (!form.ifscCode?.trim()) errors.ifscCode = 'IFSC code is required'
  else if (!IFSC_REGEX.test(form.ifscCode.trim().toUpperCase())) errors.ifscCode = 'Invalid IFSC format (e.g. SBIN0001234)'
  if (!form.bankName?.trim()) errors.bankName = 'Bank name is required'
  if (form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(form.upiId.trim())) errors.upiId = 'Invalid UPI ID format'
  return errors
}

export default function AdminWallet() {
  const api = useAbortableRequest()
  const [wallet, setWallet] = useState({ balance: 0, bankDetails: {}, upiId: '' })
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [txnLoading, setTxnLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankForm, setBankForm] = useState({ accountHolder: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '' })
  const [bankErrors, setBankErrors] = useState({})
  const [bankSaving, setBankSaving] = useState(false)
  const creditDebitRef = useRef(null)

  useEffect(() => { fetchWallet(); fetchTxns() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchWallet = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/admin-wallet/balance')
      if (res.data.status === 'success') setWallet(res.data.data)
    } catch (e) {
      // silently ignored
    } finally { setLoading(false) }
  }

  const fetchTxns = async () => {
    setTxnLoading(true)
    try {
      const res = await api.get('/admin/admin-wallet/transactions', { params: { limit: 200 } })
      if (res.data.status === 'success') setTxns(res.data.data.txns || [])
    } catch (e) {
      // silently ignored
    } finally { setTxnLoading(false) }
  }

  const scrollToCreditDebit = () => {
    creditDebitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleCredit = async () => {
    if (!amount || Number(amount) <= 0) return
    setActionLoading(true)

    if (paymentMethod === 'RAZORPAY') {
      try {
        const { data } = await api.post('/admin/admin-wallet/razorpay-order', { amount: Number(amount) });
        const { razorpayOrderId, keyId, amount: rpAmount, currency } = data.data;

        const options = {
          key: keyId,
          amount: rpAmount,
          currency: currency,
          name: 'Kwickly Admin',
          description: desc || 'Admin Wallet Topup',
          order_id: razorpayOrderId,
          handler: async function (response) {
            try {
              await api.post('/admin/admin-wallet/razorpay-verify', {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });
              showToast(`₹${Number(amount).toLocaleString('en-IN')} added via Razorpay!`);
              setAmount(''); setDesc(''); setPaymentMethod('CASH');
              fetchWallet(); fetchTxns();
            } catch (err) {
              showToast(err.response?.data?.message || 'Verification failed', 'error');
            }
          },
          theme: { color: '#059669' }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          showToast(response.error.description || 'Payment failed', 'error');
        });
        rzp.open();
      } catch (e) {
        showToast(e.response?.data?.message || 'Failed to create order', 'error');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      await api.post('/admin/admin-wallet/credit', { amount: Number(amount), description: desc || 'Manual credit', paymentMethod })
      showToast(`₹${Number(amount).toLocaleString('en-IN')} credited to admin wallet`)
      setAmount(''); setDesc(''); setPaymentMethod('CASH')
      fetchWallet(); fetchTxns()
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to credit', 'error')
    } finally { setActionLoading(false) }
  }

  const handleDebit = async () => {
    if (!amount || Number(amount) <= 0) return
    if (Number(amount) > (wallet.balance || 0)) {
      showToast('Insufficient wallet balance', 'error')
      return
    }
    setActionLoading(true)
    try {
      await api.post('/admin/admin-wallet/debit', { amount: Number(amount), description: desc || 'Manual debit' })
      showToast(`₹${Number(amount).toLocaleString('en-IN')} debited from admin wallet`)
      setAmount(''); setDesc('')
      fetchWallet(); fetchTxns()
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to debit', 'error')
    } finally { setActionLoading(false) }
  }

  const handleSaveBank = async () => {
    const errors = validateBankForm(bankForm)
    setBankErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBankSaving(true)
    try {
      await api.patch('/admin/admin-wallet/bank-details', {
        accountHolder: bankForm.accountHolder.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        ifscCode: bankForm.ifscCode.trim().toUpperCase(),
        bankName: bankForm.bankName.trim(),
        upiId: bankForm.upiId.trim()
      })
      showToast('Bank details updated successfully')
      setShowBankForm(false)
      setBankErrors({})
      fetchWallet()
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update bank details', 'error')
    } finally { setBankSaving(false) }
  }

  const openBankForm = () => {
    setBankForm({
      accountHolder: wallet.bankDetails?.accountHolder || '',
      accountNumber: wallet.bankDetails?.accountNumber || '',
      ifscCode: wallet.bankDetails?.ifscCode || '',
      bankName: wallet.bankDetails?.bankName || '',
      upiId: wallet.upiId || ''
    })
    setBankErrors({})
    setShowBankForm(true)
  }

  const filtered = txns.filter(t => {
    const d = t.description || ''
    const matchSearch = !search || d.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || t.type === typeFilter
    return matchSearch && matchType
  })

  const totalCredit = txns.filter(t => CREDIT_TYPES.includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0)
  const totalDebit = txns.filter(t => !CREDIT_TYPES.includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0)

  const exportCsv = () => {
    if (filtered.length === 0) return
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance After']
    const rows = filtered.map(t => [
      new Date(t.createdAt).toLocaleString('en-IN'),
      t.type, t.description || '',
      `${CREDIT_TYPES.includes(t.type) ? '+' : '-'}${t.amount || 0}`,
      t.balanceAfter || 0
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `admin-wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'error' ? '#EF4444' : '#0F172A',
          color: 'white', padding: '12px 20px', borderRadius: 12,
          fontWeight: 600, fontSize: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>{toast.type === 'error' ? '✕' : '✓'} {toast.msg}</div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Admin Platform Wallet</h1>
          <p className="page-subtitle">Platform commissions, fees, and admin wallet management</p>
        </div>
        <button className="btn-secondary" onClick={() => { fetchWallet(); fetchTxns() }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Balance Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: 16, padding: 28, color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Platform Wallet Balance</div>
          <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4 }}>₹{(wallet.balance || 0).toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>All commissions & fees collected here</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-success btn-sm" onClick={scrollToCreditDebit} style={{ background: '#059669', border: 'none', color: 'white', cursor: 'pointer' }}>
              <ArrowDownCircle size={14} /> Credit
            </button>
            <button className="btn btn-danger btn-sm" onClick={scrollToCreditDebit} style={{ background: '#dc2626', border: 'none', color: 'white', cursor: 'pointer' }}>
              <ArrowUpCircle size={14} /> Debit
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 }}>
            <div className="stat-card-simple" style={{ borderTop: '3px solid #059669' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>₹{totalCredit.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Total Collected</div>
            </div>
            <div className="stat-card-simple" style={{ borderTop: '3px solid #dc2626' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626' }}>₹{totalDebit.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600, marginTop: 4 }}>Total Paid Out</div>
            </div>
          </div>
          <div ref={creditDebitRef} style={{ padding: 14, background: 'var(--input-bg)', borderRadius: 10, border: '1px solid var(--border)', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mid)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Wallet size={12} /> Quick Credit / Debit
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <input className="form-control" type="number" min="1" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} style={{ fontSize: 13 }} />
                {amount && Number(amount) > (wallet.balance || 0) && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Exceeds debit balance</div>
                )}
              </div>
              <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ fontSize: 13 }}>
                <option value="CASH">Cash</option>
                <option value="CC">Credit Card</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="OTHER">Other</option>
                <option value="RAZORPAY">Razorpay Gateway</option>
              </select>
              <input className="form-control" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success" style={{ flex: 1, fontSize: 12 }} disabled={actionLoading || !amount || Number(amount) <= 0} onClick={handleCredit}>
                {actionLoading ? '...' : 'Credit ₹'}
              </button>
              <button className="btn btn-danger" style={{ flex: 1, fontSize: 12 }} disabled={actionLoading || !amount || Number(amount) <= 0} onClick={handleDebit}>
                {actionLoading ? '...' : 'Debit ₹'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bank/UPI Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={14} /> Bank Account
          </div>
          {wallet.bankDetails?.accountNumber ? (
            <div className="detail-grid">
              <div className="detail-row"><span>Holder</span><strong>{wallet.bankDetails.accountHolder || '—'}</strong></div>
              <div className="detail-row"><span>Account</span><strong>{wallet.bankDetails.accountNumber}</strong></div>
              <div className="detail-row"><span>IFSC</span><strong>{wallet.bankDetails.ifscCode || '—'}</strong></div>
              <div className="detail-row"><span>Bank</span><strong>{wallet.bankDetails.bankName || '—'}</strong></div>
            </div>
          ) : (
            <div style={{ color: 'var(--mid)', fontSize: 13 }}>No bank account configured</div>
          )}
          <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={openBankForm}>
            <CreditCard size={13} /> {wallet.bankDetails?.accountNumber ? 'Update' : 'Add'} Details
          </button>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>📱 UPI ID</div>
          {wallet.upiId ? (
            <div style={{ fontSize: 16, fontWeight: 700 }}>{wallet.upiId}</div>
          ) : (
            <div style={{ color: 'var(--mid)', fontSize: 13 }}>No UPI ID configured</div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {Object.keys(TXN_VARIANT).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <button className="btn-secondary" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export CSV
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="table-card">
        {txnLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--mid)' }}>Loading transactions...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Type</th><th>Description</th><th>Method</th><th>Amount</th><th>Balance After</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const isCredit = CREDIT_TYPES.includes(t.type)
                return (
                  <tr key={t._id || i}>
                    <td><Badge label={t.type.replace(/_/g, ' ')} variant={TXN_VARIANT[t.type] || 'neutral'} /></td>
                    <td style={{ fontSize: 13 }}>{t.description || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 600 }}>{t.meta?.paymentMethod || '—'}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: isCredit ? '#059669' : '#dc2626', fontSize: 15 }}>
                        {isCredit ? '+' : '-'}₹{(t.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td><strong>₹{(t.balanceAfter || 0).toLocaleString('en-IN')}</strong></td>
                    <td className="cell-muted" style={{ fontSize: 12 }}>
                      {new Date(t.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--mid)' }}>No transactions found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Bank Details Modal */}
      {showBankForm && (
        <div className="modal-overlay" onClick={() => !bankSaving && setShowBankForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: 16 }}>Bank & UPI Details</div>
              <button className="drawer-close" onClick={() => !bankSaving && setShowBankForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Holder Name *</label>
                <input className="form-control" value={bankForm.accountHolder} onChange={e => { setBankForm(p => ({ ...p, accountHolder: e.target.value })); setBankErrors(p => ({ ...p, accountHolder: '' })) }} placeholder="e.g. Kwickly Solutions Pvt Ltd" style={bankErrors.accountHolder ? { borderColor: '#EF4444' } : {}} />
                {bankErrors.accountHolder && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{bankErrors.accountHolder}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Account Number *</label>
                <input className="form-control" value={bankForm.accountNumber} onChange={e => { setBankForm(p => ({ ...p, accountNumber: e.target.value })); setBankErrors(p => ({ ...p, accountNumber: '' })) }} placeholder="e.g. 1234567890" style={bankErrors.accountNumber ? { borderColor: '#EF4444' } : {}} />
                {bankErrors.accountNumber && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{bankErrors.accountNumber}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">IFSC Code *</label>
                  <input className="form-control" value={bankForm.ifscCode} onChange={e => { setBankForm(p => ({ ...p, ifscCode: e.target.value })); setBankErrors(p => ({ ...p, ifscCode: '' })) }} placeholder="e.g. SBIN0001234" style={bankErrors.ifscCode ? { borderColor: '#EF4444' } : {}} />
                  {bankErrors.ifscCode && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{bankErrors.ifscCode}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name *</label>
                  <input className="form-control" value={bankForm.bankName} onChange={e => { setBankForm(p => ({ ...p, bankName: e.target.value })); setBankErrors(p => ({ ...p, bankName: '' })) }} placeholder="e.g. SBI" style={bankErrors.bankName ? { borderColor: '#EF4444' } : {}} />
                  {bankErrors.bankName && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{bankErrors.bankName}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">UPI ID</label>
                <input className="form-control" value={bankForm.upiId} onChange={e => { setBankForm(p => ({ ...p, upiId: e.target.value })); setBankErrors(p => ({ ...p, upiId: '' })) }} placeholder="e.g. kwickly@upi" style={bankErrors.upiId ? { borderColor: '#EF4444' } : {}} />
                {bankErrors.upiId && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{bankErrors.upiId}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowBankForm(false)} disabled={bankSaving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveBank} disabled={bankSaving}>
                {bankSaving ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
