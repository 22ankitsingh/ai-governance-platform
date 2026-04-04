import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { issuesAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge } from '../../components/StatusBadge';

export default function MyIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', severity: '' });

  const load = () => {
    setLoading(true);
    const params = { page_size: 50 };
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;
    if (filters.severity) params.severity = filters.severity;
    issuesAPI.list(params).then(r => setIssues(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.status === "closed" && b.status !== "closed") return 1;
    if (a.status !== "closed" && b.status === "closed") return -1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>My Issues</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{issues.length} issues reported</p>
        </div>
        <Link to="/dashboard/submit" className="btn btn-primary">➕ New Issue</Link>
      </div>

      <div className="filters-bar">
        <select className="filter-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="not_assigned">Not Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="reopened">Reopened</option>
        </select>
        <select className="filter-select" value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No issues found</h3>
          <p>{filters.status || filters.severity ? 'Try changing your filters' : 'Report your first issue to get started'}</p>
          <Link to="/dashboard/submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Report Issue</Link>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Category</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Priority</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map(issue => (
                <tr key={issue.id}>
                  <td>
                    <Link to={`/dashboard/issues/${issue.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {issue.title}
                    </Link>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{issue.category || '—'}</td>
                  <td><StatusBadge status={issue.status} /></td>
                  <td><SeverityBadge severity={issue.severity} /></td>
                  <td><PriorityBadge priority={issue.priority} /></td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatDate(issue.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
