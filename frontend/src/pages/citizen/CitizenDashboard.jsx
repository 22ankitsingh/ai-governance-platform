import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { issuesAPI, notificationsAPI } from '../../api/client';
import StatusBadge, { SeverityBadge } from '../../components/StatusBadge';

export default function CitizenDashboard() {
  const [issues, setIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      issuesAPI.list({ page_size: 5 }),
      notificationsAPI.list({ page_size: 5, unread_only: true }),
    ]).then(([issRes, notifRes]) => {
      setIssues(issRes.data);
      setNotifications(notifRes.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  const stats = {
    total: issues.length,
    pending: issues.filter(i => ['not_assigned', 'assigned', 'in_process'].includes(i.status)).length,
    resolved: issues.filter(i => ['resolved', 'closed', 'approved'].includes(i.status)).length,
    needsVerify: issues.filter(i => i.status === 'resolved').length,
  };

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.status === "closed" && b.status !== "closed") return 1;
    if (a.status !== "closed" && b.status === "closed") return -1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>My Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Track your reported issues and notifications</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue">📄</div>
          <div><div className="stat-card-value">{stats.total}</div><div className="stat-card-label">Total Issues</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon yellow">⏳</div>
          <div><div className="stat-card-value">{stats.pending}</div><div className="stat-card-label">Pending</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green">✅</div>
          <div><div className="stat-card-value">{stats.resolved}</div><div className="stat-card-label">Resolved</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple">🔍</div>
          <div><div className="stat-card-value">{stats.needsVerify}</div><div className="stat-card-label">Needs Verification</div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Recent Issues */}
        <div className="card" style={{ gridColumn: window.innerWidth < 768 ? '1 / -1' : undefined }}>
          <div className="card-header">
            <h3>Recent Issues</h3>
            <Link to="/dashboard/issues" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {issues.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <h3>No issues yet</h3>
                <p>Start by reporting a civic issue in your area</p>
                <Link to="/dashboard/submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Report Issue</Link>
              </div>
            ) : (
              <div>
                {sortedIssues.slice(0, 5).map(issue => (
                  <Link key={issue.id} to={`/dashboard/issues/${issue.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-light)', color: 'inherit', textDecoration: 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{issue.category}</div>
                    </div>
                    <StatusBadge status={issue.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="card" style={{ gridColumn: window.innerWidth < 768 ? '1 / -1' : undefined }}>
          <div className="card-header">
            <h3>🔔 Notifications</h3>
            <Link to="/dashboard/notifications" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No unread notifications</p>
              </div>
            ) : (
              <div>
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{n.message}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Link to="/dashboard/submit" className="btn btn-primary btn-lg">➕ Report New Issue</Link>
      </div>
    </div>
  );
}
