import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

export default function TriageQueue() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'not_assigned', severity: '' });

  useEffect(() => {
    load();
  }, [filters]);

  const load = () => {
    setLoading(true);
    const params = { page_size: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    adminAPI.listIssues(params).then(r => setIssues(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  const sortedIssues = [...issues].sort((a, b) => {
    const priorityMap = { critical: 1, high: 2, medium: 3, low: 4 };
    const pA = priorityMap[a.severity] || 5;
    const pB = priorityMap[b.severity] || 5;
    if (pA !== pB) return pA - pB;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Triage Queue</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select className="form-input" style={{ width: '160px' }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="not_assigned">Pending Triage</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select className="form-input" style={{ width: '160px' }}
            value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--primary-50)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', width: '40px' }}>P</th>
                <th style={{ padding: '0.75rem 1rem' }}>Issue</th>
                <th style={{ padding: '0.75rem 1rem' }}>Reporter</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Dept</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>AI Conf</th>
                <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.length === 0 ? (
                <tr><td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No issues found matching filters</td></tr>
              ) : (
                sortedIssues.map(issue => (
                  <tr key={issue.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><PriorityBadge priority={issue.priority} /></td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {issue.title.length > 40 ? issue.title.slice(0, 40) + '...' : issue.title}
                      </div>
                      {issue.reopen_count > 0 && (
                        <span className="badge badge-reopened" style={{ marginTop: '0.2rem', fontSize: '0.65rem' }}>Reopened ×{issue.reopen_count}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {issue.reporter?.full_name || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {issue.category || issue.issue_type?.name || '—'}
                        {!issue.issue_type_id && issue.category && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, background: 'rgba(51,129,255,0.1)', color: 'var(--primary-600)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>AI</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {issue.department?.name ? issue.department.name.split('&')[0].trim() : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={issue.status} /></td>
                    <td style={{ padding: '0.75rem 1rem' }}><ConfidenceMeter value={issue.ai_confidence} /></td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(issue.created_at)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Link to={`/admin/issues/${issue.id}`} className="btn btn-sm btn-ghost">Manage</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
