import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Coupons.css';

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState({
    code: '', discountType: 'FLAT', discountValue: 0,
    minOrderValue: 0, maxDiscount: '', targetAudience: 'ALL',
    startDate: '', endDate: '', usageLimit: '', isActive: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/coupons');
      setCoupons(res.data.data);
    } catch (err) {
      setError('Failed to fetch coupons.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDemo = async () => {
    try {
      setLoading(true);
      await api.post('/admin/coupons/demo');
      fetchCoupons();
    } catch (err) {
      setError('Failed to generate demo coupons.');
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      fetchCoupons();
    } catch (err) {
      setError('Failed to delete coupon.');
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      await api.put(`/admin/coupons/${coupon._id}`, { ...coupon, isActive: !coupon.isActive });
      fetchCoupons();
    } catch (err) {
      setError('Failed to toggle status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...currentCoupon };
      if (!payload.maxDiscount) delete payload.maxDiscount;
      if (!payload.usageLimit) delete payload.usageLimit;

      if (currentCoupon._id) {
        await api.put(`/admin/coupons/${currentCoupon._id}`, payload);
      } else {
        await api.post('/admin/coupons', payload);
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err) {
      setError('Failed to save coupon.');
    }
  };

  const openModal = (coupon = null) => {
    if (coupon) {
      setCurrentCoupon({
        ...coupon,
        startDate: new Date(coupon.startDate).toISOString().slice(0, 16),
        endDate: new Date(coupon.endDate).toISOString().slice(0, 16),
        maxDiscount: coupon.maxDiscount || '',
        usageLimit: coupon.usageLimit || ''
      });
    } else {
      setCurrentCoupon({
        code: '', discountType: 'FLAT', discountValue: 0,
        minOrderValue: 0, maxDiscount: '', targetAudience: 'ALL',
        startDate: '', endDate: '', usageLimit: '', isActive: true
      });
    }
    setIsModalOpen(true);
  };

  if (loading && coupons.length === 0) return <div className="p-8">Loading coupons...</div>;

  return (
    <div className="coupons-container">
      <div className="header-actions">
        <h1>Coupons & Offers</h1>
        <div className="action-buttons">
          <button className="btn-secondary" onClick={handleGenerateDemo}>Generate Demo Data</button>
          <button className="btn-primary" onClick={() => openModal()}>+ Add Coupon</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Audience</th>
              <th>Validity</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(coupon => (
              <tr key={coupon._id} className={!coupon.isActive ? 'inactive-row' : ''}>
                <td><strong>{coupon.code}</strong></td>
                <td>
                  {coupon.discountType === 'FLAT' ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`}
                  <br />
                  <small>Min: ₹{coupon.minOrderValue}</small>
                </td>
                <td><span className="audience-badge">{coupon.targetAudience}</span></td>
                <td>
                  <small>
                    {new Date(coupon.startDate).toLocaleDateString()} - <br/>
                    {new Date(coupon.endDate).toLocaleDateString()}
                  </small>
                </td>
                <td>
                  {coupon.usageCount} / {coupon.usageLimit ? coupon.usageLimit : '∞'}
                </td>
                <td>
                  <span className={`status-badge ${coupon.isActive ? 'active' : 'inactive'}`}>
                    {coupon.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="actions-cell">
                  <button onClick={() => handleToggleStatus(coupon)}>
                    {coupon.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => openModal(coupon)}>Edit</button>
                  <button className="delete-text" onClick={() => handleDelete(coupon._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && !loading && <div className="empty-state">No coupons found.</div>}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{currentCoupon._id ? 'Edit Coupon' : 'Add New Coupon'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Coupon Code</label>
                  <input required type="text" value={currentCoupon.code} onChange={e => setCurrentCoupon({...currentCoupon, code: e.target.value.toUpperCase()})} />
                </div>
                <div className="form-group">
                  <label>Target Audience</label>
                  <select value={currentCoupon.targetAudience} onChange={e => setCurrentCoupon({...currentCoupon, targetAudience: e.target.value})}>
                    <option value="ALL">All Users</option>
                    <option value="CUSTOMER">Customers Only</option>
                    <option value="WORKER">Workers Only</option>
                    <option value="SHOP">Shops Only</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Discount Type</label>
                  <select value={currentCoupon.discountType} onChange={e => setCurrentCoupon({...currentCoupon, discountType: e.target.value})}>
                    <option value="FLAT">Flat Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Discount Value</label>
                  <input required type="number" min="0" value={currentCoupon.discountValue} onChange={e => setCurrentCoupon({...currentCoupon, discountValue: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Min Order Value (₹)</label>
                  <input type="number" min="0" value={currentCoupon.minOrderValue} onChange={e => setCurrentCoupon({...currentCoupon, minOrderValue: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Max Discount (₹) <small>(For Percentage)</small></label>
                  <input type="number" min="0" value={currentCoupon.maxDiscount} onChange={e => setCurrentCoupon({...currentCoupon, maxDiscount: e.target.value})} disabled={currentCoupon.discountType === 'FLAT'} />
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input required type="datetime-local" value={currentCoupon.startDate} onChange={e => setCurrentCoupon({...currentCoupon, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input required type="datetime-local" value={currentCoupon.endDate} onChange={e => setCurrentCoupon({...currentCoupon, endDate: e.target.value})} />
                </div>

                <div className="form-group full-width">
                  <label>Total Usage Limit <small>(Leave blank for unlimited)</small></label>
                  <input type="number" min="1" value={currentCoupon.usageLimit} onChange={e => setCurrentCoupon({...currentCoupon, usageLimit: e.target.value})} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Coupon</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
