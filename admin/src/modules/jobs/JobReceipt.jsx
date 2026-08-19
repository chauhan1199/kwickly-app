import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import useAbortableRequest from '../../hooks/useAbortableRequest'
import { Printer, Download } from 'lucide-react'
import { extractErrorMessage } from '../../utils/errorUtils'

export default function JobReceipt() {
  const api = useAbortableRequest();
  const { id } = useParams()
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchReceipt()
  }, [id])

  const fetchReceipt = async () => {
    try {
      const res = await api.get(`/admin/jobs/${id}/receipt`)
      if (res.data.status === 'success') {
        setReceipt(res.data.data)
      } else {
        setError(res.data.message || 'Failed to fetch receipt')
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Error fetching receipt'))
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8f9fa' }}>
      <div style={{ width:40, height:40, border:'4px solid #ddd', borderTopColor:'#000', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error || !receipt) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8f9fa', color:'#dc2626', fontWeight:600 }}>
      {error || 'Receipt not found'}
    </div>
  )

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '40px 20px', fontFamily: '"Inter", sans-serif', color: '#111827' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Actions - hidden on print */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 24 }}>
          <button 
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>

        {/* Receipt Paper */}
        <div style={{ background: '#fff', padding: '48px', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f3f4f6', paddingBottom: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: '#000', marginBottom: 4 }}>KWICKLY</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Platform Commission Invoice</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 8 }}>INVOICE</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}><strong>Invoice No:</strong> {receipt.invoiceId}</div>
              <div style={{ fontSize: 13, color: '#4b5563' }}><strong>Date:</strong> {new Date(receipt.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>

          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 12 }}>Billed To (Customer)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{receipt.customer?.name}</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>Phone: {receipt.customer?.phone}</div>
              <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{receipt.customer?.address || 'Address not provided'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 12 }}>Service Provider (Worker)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{receipt.worker?.name}</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>Phone: {receipt.worker?.phone}</div>
              <div style={{ marginTop: 12, display: 'inline-block', padding: '4px 10px', background: receipt.status === 'PAID' ? '#dcfce7' : '#fef9c3', color: receipt.status === 'PAID' ? '#166534' : '#854d0e', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                STATUS: {receipt.status}
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 12 }}>Service Details</div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ color: '#111827' }}>Category</strong>
                <span>{receipt.jobDetails?.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: '#111827' }}>Description</strong>
                <span style={{ textAlign: 'right', maxWidth: '60%', color: '#4b5563' }}>{receipt.jobDetails?.description || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div style={{ marginBottom: 40 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>Worker Service Charge (Base Fare)</td>
                  <td style={{ padding: '16px 0', textAlign: 'right', color: '#111827' }}>₹{receipt.breakdown?.baseFare?.toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>Platform Convenience Fee</td>
                  <td style={{ padding: '16px 0', textAlign: 'right', color: '#111827' }}>₹{receipt.breakdown?.platformFee?.toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>GST ({receipt.breakdown?.gstPercentage || 18}% on Platform Fee)</td>
                  <td style={{ padding: '16px 0', textAlign: 'right', color: '#111827' }}>₹{receipt.breakdown?.gstAmount?.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 20, fontWeight: 900, color: '#111827', borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
                <span>Grand Total</span>
                <span>₹{receipt.breakdown?.totalAmount?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 60, textAlign: 'center', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: 24 }}>
            <p style={{ marginBottom: 4 }}>This is a computer-generated document. No signature is required.</p>
            <p>Thank you for using Kwickly.</p>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          div { box-shadow: none !important; }
        }
      `}} />
    </div>
  )
}
