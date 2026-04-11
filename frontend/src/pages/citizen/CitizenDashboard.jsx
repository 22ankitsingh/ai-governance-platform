import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { issuesAPI, notificationsAPI } from '../../api/client';
import StatusBadge, { SeverityBadge } from '../../components/StatusBadge';
import { FileText, Clock, CheckCircle2, Search, PlusCircle, ArrowRight, Bell } from 'lucide-react';

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
      <div className="page-title-section">
        <h1>My Dashboard</h1>
        <p>Track your reported issues and notifications</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><FileText size={22} /></div>
          <div><div className="stat-card-value">{stats.total}</div><div className="stat-card-label">Total Issues</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon yellow"><Clock size={22} /></div>
          <div><div className="stat-card-value">{stats.pending}</div><div className="stat-card-label">Pending</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><CheckCircle2 size={22} /></div>
          <div><div className="stat-card-value">{stats.resolved}</div><div className="stat-card-label">Resolved</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple"><Search size={22} /></div>
          <div><div className="stat-card-value">{stats.needsVerify}</div><div className="stat-card-label">Needs Verification</div></div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Issues */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Issues</h3>
            <Link to="/dashboard/issues" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {issues.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><FileText size={28} /></div>
                <h3>No issues yet</h3>
                <p>Start by reporting a civic issue in your area</p>
                <Link to="/dashboard/submit" className="btn btn-primary" style={{ marginTop: '16px' }}>Report Issue</Link>
              </div>
            ) : (
              <div>
                {sortedIssues.slice(0, 5).map(issue => (
                  <Link key={issue.id} to={`/dashboard/issues/${issue.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', borderBottom: '1px solid var(--border-light)', color: 'inherit', textDecoration: 'none', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--gray-25)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {issue.category || issue.issue_type?.name || '—'}
                        {!issue.issue_type_id && issue.category && (
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                            background: 'rgba(93,159,150,0.1)', color: 'var(--primary)', border: '1px solid rgba(93,159,150,0.2)',
                          }}>AI</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={issue.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card-header">
            <h3><Bell size={16} style={{ color: 'var(--text-muted)' }} /> Notifications</h3>
            <Link to="/dashboard/notifications" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px' }}>
                <div className="empty-state-icon"><Bell size={28} /></div>
                <p>No unread notifications</p>
              </div>
            ) : (
              <div>
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>{n.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{n.message}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <Link to="/dashboard/submit" className="btn btn-primary btn-lg">
          <PlusCircle size={18} /> Report New Issue
        </Link>
      </div>
    </div>
  );
}
