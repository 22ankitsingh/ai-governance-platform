import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client';
import { ScrollText, FileText } from 'lucide-react';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getAuditLog({ page_size: 100 }).then(r => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-title-section">
        <h1>Audit Log</h1>
        <p>Complete history of all status changes across issues</p>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ScrollText size={28} /></div>
          <h3>No audit entries</h3>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Issue ID</th>
                  <th>From Status</th>
                  <th>To Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                    <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {log.issue_id?.slice(0, 8)}...
                    </td>
                    <td>
                      {log.from_status ? (
                        <span className={`badge badge-${log.from_status}`}>{log.from_status.replace('_', ' ')}</span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${log.to_status}`}>{log.to_status.replace('_', ' ')}</span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 300 }}>
                      {log.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
