import React from 'react'

/**
 * StatCard — reusable metric card for admin dashboard
 * @param {string}   title
 * @param {string|number} value
 * @param {ReactNode} icon   — Lucide icon component
 * @param {string}   color  — accent hex colour
 * @param {string}   [trend] — "+12%" etc
 * @param {boolean}  [trendUp]
 */
const StatCard = ({ title, value, icon: Icon, color = '#0e9aa7', trend, trendUp }) => (
  <div className="stat-card" style={{ '--accent': color }}>
    <div className="stat-card__icon" style={{ background: color + '18' }}>
      {Icon && <Icon size={22} color={color} />}
    </div>
    <div className="stat-card__body">
      <span className="stat-card__title">{title}</span>
      <span className="stat-card__value">{value ?? '—'}</span>
    </div>
    {trend && (
      <div className={`stat-card__trend ${trendUp ? 'up' : 'down'}`}>
        {trendUp ? '▲' : '▼'} {trend}
      </div>
    )}
  </div>
)

export default StatCard
