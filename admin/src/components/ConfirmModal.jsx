import React from 'react'

export default function ConfirmModal({ title, message, onConfirm, onClose, danger = true, confirmText = 'Confirm', loading = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--mid)', fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: 0 }}>{message}</p>
        </div>
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
