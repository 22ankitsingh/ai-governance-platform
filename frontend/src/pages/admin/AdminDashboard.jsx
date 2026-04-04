import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, adminAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [recentIssues, setRecentIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.overview(),
      adminAPI.listIssues({ page_size: 5 }),
    ]).then(([ovr, issues]) => {
      setOverview(ovr.data);
      setRecentIssues(issues.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  const sortedIssues = [...recentIssues].sort((a, b) => {
    if (a.status === "closed" && b.status !== "closed") return 1;
    if (a.status !== "closed" && b.status === "closed") return -1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Governance platform overview</p>
      </div>

      {overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon blue">📊</div>
            <div><div className="stat-card-value">{overview.total_issues}</div><div className="stat-card-label">Total Issues</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon yellow">⏳</div>
            <div><div className="stat-card-value">{overview.pending_issues}</div><div className="stat-card-label">Pending</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green">✅</div>
            <div><div className="stat-card-value">{overview.resolution_rate}%</div><div className="stat-card-label">Resolution Rate</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red">🔄</div>
            <div><div className="stat-card-value">{overview.reopened_issues}</div><div className="stat-card-label">Reopened</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon purple">🚨</div>
            <div><div className="stat-card-value">{overview.critical_issues}</div><div className="stat-card-label">Critical</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon teal">⏱️</div>
            <div><div className="stat-card-value">{overview.avg_resolution_hours || '—'}h</div><div className="stat-card-label">Avg Resolution Time</div></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Recent Issues (Priority Order)</h3>
          <Link to="/admin/triage" className="btn btn-ghost btn-sm">View All →</Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Priority</th>
                  <th>AI Conf.</th>
                </tr>
              </thead>
              <tbody>
                {sortedIssues.map(issue => (
                  <tr key={issue.id}>
                    <td>
                      <Link to={`/admin/issues/${issue.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {issue.title.length > 50 ? issue.title.slice(0, 50) + '...' : issue.title}
                      </Link>
                      {issue.reporter && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>by {issue.reporter.full_name}</div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{issue.issue_type?.name || '—'}</td>
                    <td><StatusBadge status={issue.status} /></td>
                    <td><SeverityBadge severity={issue.severity} /></td>
                    <td><PriorityBadge priority={issue.priority} /></td>
                    <td><ConfidenceMeter value={issue.ai_confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
