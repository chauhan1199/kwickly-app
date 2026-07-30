import React from 'react'

export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
