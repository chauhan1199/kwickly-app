import React from 'react'

/**
 * Badge — status pill
 * @param {string} label
 * @param {string} variant — 'success' | 'warning' | 'danger' | 'info' | 'neutral'
 */
const COLORS = {
  success: { bg: '#d1fae5', text: '#059669' },
  warning: { bg: '#fef3c7', text: '#d97706' },
  danger:  { bg: '#fee2e2', text: '#dc2626' },
  info:    { bg: '#dbeafe', text: '#2563eb' },
  neutral: { bg: '#f3f4f6', text: '#6b7280' },
  purple:  { bg: '#ede9fe', text: '#7c3aed' },
}

const Badge = ({ label, variant = 'neutral', style }) => {
  const c = COLORS[variant] || COLORS.neutral
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {label}
    </span>
  )
}

export default Badge
