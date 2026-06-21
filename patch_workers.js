const fs = require('fs');

let content = fs.readFileSync('admin/src/modules/workers/Workers.jsx', 'utf8');

const importTable = "import Table from '../../components/common/Table'\nimport Button from '../../components/common/Button'\nimport Card from '../../components/common/Card'\nimport Badge from '../../components/common/Badge'\n";
content = content.replace("import MapPicker", importTable + "import MapPicker");

const columnsSetup = `
  const columns = [
    { header: 'Worker', render: (w) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {w.profileImage ? <img src={w.profileImage} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>{(w.name || '?')[0]?.toUpperCase()}</div>}
        <div><div className="cell-primary">{w.name || 'Unknown'}</div><div className="cell-muted">{w.city || '—'} · ID: {w._id.slice(-6)}</div></div>
      </div>
    )},
    { header: 'Contact', render: (w) => <><div className="cell-primary">{w.phone || '—'}</div><div className="cell-muted">{w.email || 'No email'}</div></> },
    { header: 'KYC', render: (w) => <Badge label={w.kyc?.status || 'PENDING'} variant={KYC_VARIANT[w.kyc?.status]?.toLowerCase() || 'neutral'} /> },
    { header: 'Services', render: (w) => <div style={{ fontSize: 12 }}>{renderServices(w.services)}</div> },
    { header: 'Wallet', render: (w) => <strong>₹{(w.wallet?.balance || 0).toLocaleString('en-IN')}</strong> },
    { header: 'Status', render: (w) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Badge label={w.isVerified ? 'Active' : 'Inactive'} variant={w.isVerified ? 'success' : 'neutral'} />
        {w.isOnline && <Badge label="Online" variant="purple" />}
      </div>
    )},
    { header: 'Actions', render: (w) => (
      <div className="action-btns" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="View" onClick={() => { setDetail(w); setImpersonateToken(null); }}><Eye size={15} /></button>
        <button className="btn-icon" title="Edit" onClick={() => openEdit(w)}><Edit3 size={15} /></button>
        <button className={\`btn-icon \${w.isVerified ? 'danger' : 'success'}\`} title={w.isVerified ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ type: 'toggle', id: w._id, name: w.name })}>{w.isVerified ? <Ban size={15} /> : <CheckCircle size={15} />}</button>
        <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete', id: w._id, name: w.name })}><Trash2 size={15} /></button>
      </div>
    )}
  ];
`;

content = content.replace('const totalPages = Math.ceil(filtered.length / PAGE_SIZE)', columnsSetup + '\n  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)');

const tableHtml = `<div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Worker</th><th>Contact</th><th>KYC</th><th>Services</th><th>Wallet</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {paged.map(w => (
                    <tr key={w._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {w.profileImage ? <img src={w.profileImage} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} /> : <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>{(w.name || '?')[0]?.toUpperCase()}</div>}
                          <div><div className="cell-primary">{w.name || 'Unknown'}</div><div className="cell-muted">{w.city || '—'} · ID: {w._id.slice(-6)}</div></div>
                        </div>
                      </td>
                      <td><div className="cell-primary">{w.phone || '—'}</div><div className="cell-muted">{w.email || 'No email'}</div></td>
                      <td><span className={\`badge badge-\${KYC_VARIANT[w.kyc?.status] || 'gray'}\`}>{w.kyc?.status || 'PENDING'}</span></td>
                      <td><div style={{ fontSize: 12 }}>{renderServices(w.services)}</div></td>
                      <td><strong>₹{(w.wallet?.balance || 0).toLocaleString('en-IN')}</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span className={\`badge \${w.isVerified ? 'badge-success' : 'badge-gray'}\`}>{w.isVerified ? 'Active' : 'Inactive'}</span>
                          {w.isOnline && <span className="badge badge-purple" style={{ fontSize: 10 }}>Online</span>}
                        </div>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-icon" title="View" onClick={() => { setDetail(w); setImpersonateToken(null); }}><Eye size={15} /></button>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(w)}><Edit3 size={15} /></button>
                          <button className={\`btn-icon \${w.isVerified ? 'danger' : 'success'}\`} title={w.isVerified ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ type: 'toggle', id: w._id, name: w.name })}>{w.isVerified ? <Ban size={15} /> : <CheckCircle size={15} />}</button>
                          <button className="btn-icon danger" title="Delete" onClick={() => setConfirm({ type: 'delete', id: w._id, name: w.name })}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>`;

content = content.replace(tableHtml, '<Table columns={columns} data={paged} emptyMessage={search ? "Try a different search term" : "No workers registered yet"} />');

fs.writeFileSync('admin/src/modules/workers/Workers.jsx', content);
