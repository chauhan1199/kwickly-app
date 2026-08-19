import React, { useState, useEffect } from 'react'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { isAbortError } from '../../utils/errorUtils'
import Toast from '../../components/Toast'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './Reports.css'

export default function Reports() {
  const api = useAbortableRequest();
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('revenue') // revenue, performance, retention, demand
  const [dateRange, setDateRange] = useState('month')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  useEffect(() => {
    fetchReportData()
  }, [activeTab, dateRange])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const resp = await api.get(`/admin/reports/${activeTab}?period=${dateRange}`)
      if (resp.data.status === 'success') { 
        setReportData(resp.data.data) 
      }
      setLoading(false)

    } catch (e) {
      if (isAbortError(e)) return
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) return;
    const headers = [];
    const rows = [];
    
    if (activeTab === 'revenue') {
      headers.push('Metric', 'Value');
      rows.push(['Total Revenue', `₹${reportData.total || 0}`]);
      rows.push(['Platform Commission', `₹${reportData.commission || 0}`]);
      rows.push(['Worker Payouts', `₹${reportData.payouts || 0}`]);
    } else if (activeTab === 'performance') {
      headers.push('Metric', 'Value');
      rows.push(['Active Workers', reportData.activeWorkers || 0]);
      rows.push(['Average Rating', reportData.avgRating || 'N/A']);
      rows.push(['Completion Rate', reportData.completionRate || 'N/A']);
    } else if (activeTab === 'retention') {
      headers.push('Metric', 'Value');
      rows.push(['New Customers', reportData.newCustomers || 0]);
      rows.push(['Returning Customers', reportData.returningCustomers || 0]);
      rows.push(['Churn Rate', reportData.churnRate || 'N/A']);
    } else if (activeTab === 'demand') {
      headers.push('Metric', 'Value');
      rows.push(['Total Jobs Completed', reportData.totalJobs || 0]);
      rows.push(['Top Category', reportData.topCategory || 'N/A']);
    }
    
    if (chartData.length > 0) {
      headers.push('');
      rows.push([]);
      headers.push(...chartData.map(d => d.name || d.day || ''));
      const dataRow = chartData.map(d => activeTab === 'revenue' ? `₹${d.revenue || 0}` : d.jobs || d.completionRate || 0);
      rows.push(dataRow);
    }
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully', 'success');
  }

  const chartData = reportData?.chartData || []

  return (
    <div className="page-container">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
        <div className="header-actions">
          <select 
            className="filter-select" 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
          <button className="btn btn-primary" onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'revenue' ? 'active' : ''}`} onClick={() => setActiveTab('revenue')}>Revenue Summary</button>
        <button className={`tab ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>Worker Performance</button>
        <button className={`tab ${activeTab === 'retention' ? 'active' : ''}`} onClick={() => setActiveTab('retention')}>Customer Retention</button>
        <button className={`tab ${activeTab === 'demand' ? 'active' : ''}`} onClick={() => setActiveTab('demand')}>Category Demand</button>
      </div>

      <div className="content-section">
        {loading ? (
          <div className="loading-spinner">Loading data...</div>
        ) : (
          <div className="report-dashboard">
            {activeTab === 'revenue' && reportData && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Revenue</div>
                  <div className="stat-value">₹{reportData.total?.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Platform Commission</div>
                  <div className="stat-value text-success">₹{reportData.commission?.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Worker Payouts</div>
                  <div className="stat-value">₹{reportData.payouts?.toLocaleString()}</div>
                </div>
              </div>
            )}
            
            {activeTab === 'performance' && reportData && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Active Workers</div>
                  <div className="stat-value">{reportData.activeWorkers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Average Rating</div>
                  <div className="stat-value">{reportData.avgRating} / 5.0</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Completion Rate</div>
                  <div className="stat-value text-success">{reportData.completionRate}</div>
                </div>
              </div>
            )}

            {activeTab === 'retention' && reportData && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">New Customers</div>
                  <div className="stat-value">{reportData.newCustomers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Returning Customers</div>
                  <div className="stat-value">{reportData.returningCustomers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Churn Rate</div>
                  <div className="stat-value text-danger">{reportData.churnRate}</div>
                </div>
              </div>
            )}

            {activeTab === 'demand' && reportData && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Jobs Completed</div>
                  <div className="stat-value">{reportData.totalJobs}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Top Category</div>
                  <div className="stat-value text-primary">{reportData.topCategory}</div>
                </div>
              </div>
            )}
            
            <div className="report-placeholder" style={{ height: 400, marginTop: 40, padding: 20, background: 'var(--surface)', borderRadius: 16 }}>
              <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Trend</h3>
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'revenue' || activeTab === 'retention' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--mid)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--mid)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => activeTab === 'revenue' ? `₹${val}` : val} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 8 }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: 20 }} />
                    {activeTab === 'revenue' && <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />}
                    {activeTab === 'revenue' && <Line type="monotone" dataKey="commission" name="Commission" stroke="var(--success)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />}
                    {activeTab === 'retention' && <Line type="monotone" dataKey="returning" name="Returning" stroke="var(--primary)" strokeWidth={3} />}
                    {activeTab === 'retention' && <Line type="monotone" dataKey="new" name="New Customers" stroke="var(--warning)" strokeWidth={3} />}
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--mid)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--mid)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.4 }} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 8 }} />
                    {activeTab === 'performance' && <Bar dataKey="completionRate" name="Completion Rate %" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={40} />}
                    {activeTab === 'demand' && <Bar dataKey="jobs" name="Total Jobs" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

