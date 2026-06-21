import React from 'react';

export default function Card({ children, title, subtitle, action, className = '', style = {} }) {
  return (
    <div className={`card glass-card ${className}`} style={{ ...style }}>
      {(title || action) && (
        <div className="card-header">
          <div>
            {title && <div className="card-title">{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: 'var(--mid)' }}>{subtitle}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
