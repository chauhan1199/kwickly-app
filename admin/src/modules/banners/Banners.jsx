import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Banners.css';

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBanner, setCurrentBanner] = useState({
    title: '', imageUrl: '', targetAudience: 'ALL',
    startDate: '', endDate: '', isActive: true, link: ''
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/banners');
      setBanners(res.data.data);
    } catch (err) {
      setError('Failed to fetch banners.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDemo = async () => {
    try {
      setLoading(true);
      await api.post('/admin/banners/demo');
      fetchBanners();
    } catch (err) {
      setError('Failed to generate demo banners.');
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      await api.delete(`/admin/banners/${id}`);
      fetchBanners();
    } catch (err) {
      setError('Failed to delete banner.');
    }
  };

  const handleToggleStatus = async (banner) => {
    try {
      await api.put(`/admin/banners/${banner._id}`, { ...banner, isActive: !banner.isActive });
      fetchBanners();
    } catch (err) {
      setError('Failed to toggle status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentBanner._id) {
        await api.put(`/admin/banners/${currentBanner._id}`, currentBanner);
      } else {
        await api.post('/admin/banners', currentBanner);
      }
      setIsModalOpen(false);
      fetchBanners();
    } catch (err) {
      setError('Failed to save banner.');
    }
  };

  const openModal = (banner = null) => {
    if (banner) {
      setCurrentBanner({
        ...banner,
        startDate: new Date(banner.startDate).toISOString().slice(0, 16),
        endDate: new Date(banner.endDate).toISOString().slice(0, 16)
      });
    } else {
      setCurrentBanner({
        title: '', imageUrl: '', targetAudience: 'ALL',
        startDate: '', endDate: '', isActive: true, link: ''
      });
    }
    setIsModalOpen(true);
  };

  if (loading && banners.length === 0) return <div className="p-8">Loading banners...</div>;

  return (
    <div className="banners-container">
      <div className="header-actions">
        <h1>Banners & Promotions</h1>
        <div className="action-buttons">
          <button className="btn-secondary" onClick={handleGenerateDemo}>Generate Demo Data</button>
          <button className="btn-primary" onClick={() => openModal()}>+ Add Banner</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="banners-grid">
        {banners.map(banner => (
          <div key={banner._id} className={`banner-card ${!banner.isActive ? 'inactive' : ''}`}>
            <img src={banner.imageUrl} alt={banner.title} className="banner-image" />
            <div className="banner-content">
              <h3>{banner.title}</h3>
              <p className="audience-tag">{banner.targetAudience}</p>
              <div className="banner-dates">
                <span>Start: {new Date(banner.startDate).toLocaleDateString()}</span>
                <span>End: {new Date(banner.endDate).toLocaleDateString()}</span>
              </div>
              <div className="banner-actions">
                <button onClick={() => handleToggleStatus(banner)}>
                  {banner.isActive ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => openModal(banner)}>Edit</button>
                <button className="delete-btn" onClick={() => handleDelete(banner._id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && !loading && <div className="empty-state">No banners found.</div>}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{currentBanner._id ? 'Edit Banner' : 'Add New Banner'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input required type="text" value={currentBanner.title} onChange={e => setCurrentBanner({...currentBanner, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input required type="url" value={currentBanner.imageUrl} onChange={e => setCurrentBanner({...currentBanner, imageUrl: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Link (Optional)</label>
                <input type="text" value={currentBanner.link} onChange={e => setCurrentBanner({...currentBanner, link: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Target Audience</label>
                <select value={currentBanner.targetAudience} onChange={e => setCurrentBanner({...currentBanner, targetAudience: e.target.value})}>
                  <option value="ALL">All Users</option>
                  <option value="CUSTOMER">Customers Only</option>
                  <option value="WORKER">Workers Only</option>
                  <option value="SHOP">Shops Only</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input required type="datetime-local" value={currentBanner.startDate} onChange={e => setCurrentBanner({...currentBanner, startDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input required type="datetime-local" value={currentBanner.endDate} onChange={e => setCurrentBanner({...currentBanner, endDate: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Banner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
