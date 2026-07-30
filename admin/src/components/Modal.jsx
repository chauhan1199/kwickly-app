import React from 'react'
import { X } from 'lucide-react'

/**
 * Modal — generic modal overlay
 * @param {boolean}   open
 * @param {function}  onClose
 * @param {string}    title
 * @param {ReactNode} children
 * @param {string}    [width]  — max-width css value
 */
const Modal = ({ open, onClose, title, children, width = '520px' }) => {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} aria-hidden="true">
      <div
        className="modal-box"
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
