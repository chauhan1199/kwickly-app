import React, { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, FileSpreadsheet } from 'lucide-react'
import Badge from '../../components/common/Badge'
import useAbortableRequest from '../../hooks/useAbortableRequest'

export default function Ledger() {
  const api = useAbortableRequest();
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'reconciliation' | 'gst'
  const [entries, setEntries] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [gstReport, setGstReport] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setType] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'ledger') {
        const res = await api.get('/ledger');
        if (res.data.status === 'success') {
          setEntries(res.data.data?.entries || []);
        }
      } else if (activeTab === 'reconciliation') {
        const res = await api.get('/ledger/reconciliation');
        const treasRes = await api.get('/ledger/treasury-summary');
        if (res.data.status === 'success') setReconciliation(res.data.data);
        if (treasRes.data.status === 'success') setTreasury(treasRes.data.data);
      } else if (activeTab === 'gst') {
        const res = await api.get('/ledger/gst-report');
        if (res.data.status === 'success') setGstReport(res.data.data);
      }
    } catch (e) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const filtered = entries.filter(e => {
    const txn = e.transactionId || '';
    const ref = e.referenceNumber || '';
    const desc = e.description || '';
    const matchSearch = txn.toLowerCase().includes(search.toLowerCase()) ||
                        ref.toLowerCase().includes(search.toLowerCase()) ||
                        desc.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'ALL' || e.entityType === typeFilter;
    return matchSearch && matchType;
  });

  const exportCSV = () => {
    const headers = ['Txn ID', 'Type', 'Reference', 'Gross Paid', 'Partner 100%', 'Platform Fee', 'GST (18%)', 'Delivery Fee', 'Status', 'Date'];
    const rows = filtered.map(t => [
      t.transactionId,
      t.entityType,
      t.referenceNumber || '',
      t.grossAmount || 0,
      t.partnerAmount || 0,
      t.platformFee || 0,
      t.gstAmount || 0,
      t.deliveryFee || 0,
      t.settlementStatus,
      new Date(t.createdAt).toLocaleString('en-IN')
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kwickly_platform_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">📖 Universal Platform Ledger</h1>
          <p className="page-subtitle">Single Source of Truth: Immutable financial records, GST tracking & daily reconciliation</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn-secondary" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'ledger', label: '📑 Transaction Ledger' },
          { key: 'reconciliation', label: '⚖️ Daily Reconciliation & Treasury' },
          { key: 'gst', label: '🏛️ GST & Tax Ledger' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--mid)',
              borderBottom: `2px solid ${activeTab === t.key ? 'var(--primary)' : 'transparent'}`,
              marginBottom: '-2px'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LEDGER */}
      {activeTab === 'ledger' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mid)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 36 }}
                placeholder="Search Txn ID, Order #, Job Code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-control" style={{ width: 220 }} value={typeFilter} onChange={e => setType(e.target.value)}>
              <option value="ALL">All Transaction Types</option>
              <option value="SERVICE_JOB">Service Job</option>
              <option value="SHOP_ORDER">Shop Order</option>
              <option value="WORKER_SUBSCRIPTION">Worker Subscription</option>
              <option value="SHOP_SUBSCRIPTION">Shop Subscription</option>
              <option value="CUSTOMER_WALLET_TOPUP">Wallet Top-up</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>TXN ID</th>
                    <th>TYPE</th>
                    <th>REFERENCE</th>
                    <th>CUSTOMER PAID</th>
                    <th>PARTNER (100%)</th>
                    <th>KWICKLY FEE</th>
                    <th>GST (18%)</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: 32, color: 'var(--mid)' }}>
                        No ledger transactions found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t, idx) => (
                      <tr key={t._id || idx}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--primary)' }}>
                          {t.transactionId}
                        </td>
                        <td>
                          <Badge variant={t.entityType === 'SERVICE_JOB' ? 'purple' : t.entityType === 'SHOP_ORDER' ? 'success' : 'neutral'}>
                            {t.entityType}
                          </Badge>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{t.referenceNumber || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>₹{t.grossAmount}</td>
                        <td style={{ fontWeight: 700, color: '#10B981' }}>₹{t.partnerAmount} (0% fee)</td>
                        <td style={{ fontWeight: 700, color: '#8B5CF6' }}>₹{t.platformFee}</td>
                        <td style={{ fontWeight: 600, color: '#F59E0B' }}>₹{t.gstAmount}</td>
                        <td>
                          <Badge variant={t.settlementStatus === 'SETTLED' ? 'success' : 'warning'}>
                            {t.settlementStatus}
                          </Badge>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--mid)' }}>
                          {new Date(t.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: RECONCILIATION */}
      {activeTab === 'reconciliation' && reconciliation && (
        <div>
          <div className="alert alert-success" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={24} color="#10B981" />
            <div>
              <strong>Daily Invariant Status: {reconciliation.status}</strong>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                {reconciliation.reconciliationFormula} (Discrepancy: ₹{reconciliation.discrepancy})
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 18, borderLeft: '4px solid #3B82F6' }}>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>Total Customer Collections</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                ₹{reconciliation.summary?.totalCustomerInflows || 0}
              </div>
            </div>
            <div className="card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>Worker & Shop Payouts (100%)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                ₹{(reconciliation.summary?.totalWorkerEarnings || 0) + (reconciliation.summary?.totalShopEarnings || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: 18, borderLeft: '4px solid #8B5CF6' }}>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>Kwickly Platform Fees</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>
                ₹{reconciliation.summary?.totalPlatformFees || 0}
              </div>
            </div>
            <div className="card" style={{ padding: 18, borderLeft: '4px solid #F59E0B' }}>
              <div style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600 }}>GST / Tax Collected</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>
                ₹{reconciliation.summary?.totalGstLiability || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GST */}
      {activeTab === 'gst' && gstReport && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🏛️ Monthly GST Summary</div>
              <div style={{ fontSize: 12, color: 'var(--mid)' }}>Period: {gstReport.period?.month}/{gstReport.period?.year} · {gstReport.recordCount} taxable transactions</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--mid)' }}>Total GST Collected</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>₹{gstReport.totalGst}</div>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>TRANSACTION</th>
                <th>TYPE</th>
                <th>TAXABLE PLATFORM FEE</th>
                <th>GST COLLECTED (18%)</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {gstReport.records?.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.transactionId}</td>
                  <td><Badge variant="neutral">{r.entityType}</Badge></td>
                  <td style={{ fontWeight: 700 }}>₹{r.platformFee}</td>
                  <td style={{ fontWeight: 700, color: '#F59E0B' }}>₹{r.gstAmount}</td>
                  <td style={{ fontSize: 11, color: 'var(--mid)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
