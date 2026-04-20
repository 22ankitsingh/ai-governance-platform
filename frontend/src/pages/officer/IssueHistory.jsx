import { useState, useEffect } from 'react';
import { officerAPI } from '../../api/client';
import StatusBadge, { SeverityBadge } from '../../components/StatusBadge';
import { History, Clock, Star, AlertTriangle } from 'lucide-react';

export default function IssueHistory() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    officerAPI.previousIssues({ page, page_size: 20 })
      .then(res => setIssues(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  const formatDuration = (assignedAt, resolvedAt) => {
    if (!assignedAt || !resolvedAt) return '—';
    const diff = new Date(resolvedAt) - new Date(assignedAt);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History size={22} /> Issue History
      </h1>

      {issues.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--gray-400)' }}>
              <History size={28} />
            </div>
            <h3 style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>No Past Issues</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Issues you've resolved will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {issues.map(issue => (
            <div key={issue.id} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '6px' }}>{issue.title}</h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                    <StatusBadge status={issue.status} />
                    <SeverityBadge severity={issue.severity} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {issue.category || issue.issue_type?.name || '—'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexShrink: 0 }}>
                  {/* Resolution Time */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Resolution Time</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <Clock size={13} />
                      {formatDuration(issue.assigned_at, issue.resolved_at)}
                    </div>
                  </div>

                  {/* Rating */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Rating</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {issue.citizen_rating ? (
                        <span style={{ color: 'var(--accent)' }}>
                          <Star size={13} fill="currentColor" /> {issue.citizen_rating}/5
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>Created: {new Date(issue.created_at).toLocaleDateString('en-IN')}</span>
                {issue.resolved_at && <span>Resolved: {new Date(issue.resolved_at).toLocaleDateString('en-IN')}</span>}
                {issue.closed_at && <span>Closed: {new Date(issue.closed_at).toLocaleDateString('en-IN')}</span>}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {issues.length >= 20 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </button>
              <span style={{ padding: '6px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Page {page}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
