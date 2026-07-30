import React, { useEffect, useState, useCallback } from 'react'

let toastListeners = []

export function showToast(message, type = 'success', duration = 4000) {
  const id = Date.now() + Math.random()
  const toast = { id, message, type, duration }
  toastListeners.forEach(fn => fn(toast))
  return id
}

Toast.success = (msg) => showToast(msg, 'success')
Toast.error = (msg) => showToast(msg, 'error', 6000)
Toast.warning = (msg) => showToast(msg, 'warning')
Toast.info = (msg) => showToast(msg, 'info')

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    const listener = (toast) => {
      setToasts(prev => {
        if (prev.length >= 5) return [...prev.slice(1), toast]
        return [...prev, toast]
      })
      if (toast.duration > 0) {
        setTimeout(() => removeToast(toast.id), toast.duration)
      }
    }
    toastListeners.push(listener)
    return () => { toastListeners = toastListeners.filter(fn => fn !== listener) }
  }, [removeToast])

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration <= 0) return
    const t = setTimeout(onClose, type === 'error' ? 6000 : duration)
    return () => clearTimeout(t)
  }, [duration, onClose, type])

  const colors = {
    success: { bg: 'var(--toast-bg)', border: '#059669', color: 'var(--toast-color)' },
    error:   { bg: '#7F1D1D', border: '#EF4444', color: '#FCA5A5' },
    warning: { bg: 'var(--toast-bg)', border: '#d97706', color: 'var(--toast-color)' },
    info:    { bg: 'var(--toast-bg)', border: '#2563eb', color: 'var(--toast-color)' },
  }
  const c = colors[type] || colors.success
  const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' }

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, padding: '14px 20px', borderRadius: 12,
      fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10,
      animation: 'slideUp 0.3s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      lineHeight: 1.4, wordBreak: 'break-word',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icons[type]}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ marginLeft: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
    </div>
  )
}

export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration <= 0) return
    const t = setTimeout(onClose, type === 'error' ? 6000 : duration)
    return () => clearTimeout(t)
  }, [duration, onClose, type])

  const colors = {
    success: { bg: 'var(--toast-bg)', border: '#059669', color: 'var(--toast-color)' },
    error:   { bg: '#7F1D1D', border: '#EF4444', color: '#FCA5A5' },
    warning: { bg: 'var(--toast-bg)', border: '#d97706', color: 'var(--toast-color)' },
    info:    { bg: 'var(--toast-bg)', border: '#2563eb', color: 'var(--toast-color)' },
  }
  const c = colors[type] || colors.success
  const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, padding: '14px 20px', borderRadius: 12,
      fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10,
      animation: 'slideUp 0.3s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      maxWidth: 420, lineHeight: 1.4, wordBreak: 'break-word',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icons[type]}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ marginLeft: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
    </div>
  )
}
