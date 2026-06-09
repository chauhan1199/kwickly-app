import React from 'react'

export default function AdminUsers() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔐 Admin Users & Roles</div>
          <div className="page-subtitle">Access control and role management</div>
        </div>
        <span className="badge badge-warning" style={{ fontSize: 12, padding: '6px 14px' }}>🚧 Coming Soon</span>
      </div>

      {/* Current admin info */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: 'white', flexShrink: 0,
          }}>SA</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>Super Admin</span>
              <span style={{ fontSize: 18 }}>👑</span>
              <span className="badge badge-success" style={{ fontSize: 11 }}>Active</span>
            </div>
            <div style={{ color: 'var(--mid)', fontFamily: 'var(--font-body)', fontSize: 13 }}>admin@kwickly.com</div>
            <div style={{ marginTop: 6 }}>
              <span className="badge badge-danger" style={{ fontSize: 11 }}>Full Access — All Permissions</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Current Permissions
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              'Dashboard','Customers','Workers','Jobs','KYC Queue','Categories',
              'Payouts','Subscriptions','Banners','Coupons','Notifications',
              'Cities','Pricing','Reviews','Support','Settings',
            ].map(p => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--success-light)', color: '#14532D', border: '1px solid #86EFAC', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                ✓ {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Coming soon card */}
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔐</div>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Multi-Admin Access — Coming Soon</div>
        <div style={{ fontSize: 14, color: 'var(--mid)', fontFamily: 'var(--font-body)', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
          Invite team members with scoped roles — Finance, Support, KYC Ops, City Ops, and Marketing
          — each with controlled page-level permissions. Currently all operations run under a single Super Admin.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, maxWidth: 640, margin: '0 auto' }}>
          {[
            { icon: '💰', role: 'Finance',    desc: 'Payouts & Reports'        },
            { icon: '💬', role: 'Support',    desc: 'Tickets & Users'          },
            { icon: '🪪', role: 'KYC Ops',    desc: 'Verification Queue'       },
            { icon: '🌆', role: 'City Ops',   desc: 'Cities & Jobs'            },
            { icon: '📢', role: 'Marketing',  desc: 'Banners, Coupons & Notifs'},
          ].map((r, i) => (
            <div key={i} style={{ background: 'var(--bg-dark)', borderRadius: 12, padding: '14px 12px', border: '1px solid var(--border)', opacity: 0.6 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.role}</div>
              <div style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'var(--font-body)', marginTop: 2 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
