import React from 'react'

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}
      role="navigation"
      aria-label="Pagination"
    >
      <span style={{ fontSize: 12, color: 'var(--mid)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
        Showing {start}–{end} of {total}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          className="btn-secondary"
          style={{ height: 32, padding: '0 10px', fontSize: 12, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          onClick={() => page > 1 && onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ← Prev
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p
          if (totalPages <= 5) p = i + 1
          else if (page <= 3) p = i + 1
          else if (page >= totalPages - 2) p = totalPages - 4 + i
          else p = page - 2 + i
          return (
            <button
              key={p}
              className={p === page ? 'btn-primary' : 'btn-secondary'}
              style={{ height: 32, width: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              {...(p === page ? { 'aria-current': 'page' } : {})}
            >
              {p}
            </button>
          )
        })}
        <button
          className="btn-secondary"
          style={{ height: 32, padding: '0 10px', fontSize: 12, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          onClick={() => page < totalPages && onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
