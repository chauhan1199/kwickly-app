import React from 'react';
import EmptyState from '../EmptyState';

export default function Table({ columns, data, onRowClick, emptyMessage = 'No data found', emptyIcon, loading = false }) {
  if (loading) {
    return (
      <div className="table-loading">
        <div className="spinner" />
        Loading data...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title="No Data" description={emptyMessage} icon={emptyIcon} />;
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={col.style}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} onClick={() => onRowClick && onRowClick(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {columns.map((col, j) => (
                <td key={j} style={col.cellStyle}>
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
