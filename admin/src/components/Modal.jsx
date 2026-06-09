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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
