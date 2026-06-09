import React from 'react'

/**
 * DataTable — generic sortable table
 * @param {string[]}  columns  — display headers
 * @param {string[]}  keys     — data object keys matching columns
 * @param {object[]}  data
 * @param {function}  renderCell(row, key) — optional custom cell renderer
 * @param {function}  renderActions(row)  — optional action buttons per row
 * @param {boolean}   loading
 */
const DataTable = ({ columns, keys, data = [], renderCell, renderActions, loading, emptyText = 'No data found' }) => {
  if (loading) {
    return (
      <div className="table-loading">
        <div className="loading-spinner" />
        <span>Loading...</span>
      </div>
    )
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
            {renderActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (renderActions ? 1 : 0)} className="table-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr key={row._id || row.id || ri}>
                {keys.map((key, ki) => (
                  <td key={ki}>
                    {renderCell ? renderCell(row, key) : (row[key] ?? '—')}
                  </td>
                ))}
                {renderActions && <td className="table-actions">{renderActions(row)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
