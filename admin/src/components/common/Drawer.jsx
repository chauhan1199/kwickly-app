import React, { useEffect } from 'react'

export default function Drawer({ open, onClose, title, subtitle, width = 540, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [open])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 9999 }} aria-hidden="true" />
      <div
        className="drawer"
        style={{ width, zIndex: 10000 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="drawer-header">
          <div>
            <div id="drawer-title" style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
            {subtitle && <div className="cell-muted">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </>
  )
}
