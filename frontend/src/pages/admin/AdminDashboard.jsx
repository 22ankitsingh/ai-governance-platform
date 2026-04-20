import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, adminAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';
import { BarChart3, Clock, CheckCircle2, RotateCcw, AlertTriangle, Timer, ArrowRight, Briefcase, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [recentIssues, setRecentIssues] = useState([]);
  const [officerStats, setOfficerStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.overview(),
      adminAPI.listIssues({ page_size: 5 }),
      adminAPI.officerStats(),
    ]).then(([ovr, issues, oStats]) => {
      setOverview(ovr.data);
      setRecentIssues(issues.data);
      setOfficerStats(oStats.data);
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
      <div className="page-title-section">
        <h1>Admin Dashboard</h1>
        <p>PrajaGov platform overview and recent activity</p>
      </div>

      {overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon blue"><BarChart3 size={22} /></div>
            <div><div className="stat-card-value">{overview.total_issues}</div><div className="stat-card-label">Total Issues</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon yellow"><Clock size={22} /></div>
            <div><div className="stat-card-value">{overview.pending_issues}</div><div className="stat-card-label">Pending</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green"><CheckCircle2 size={22} /></div>
            <div><div className="stat-card-value">{overview.resolution_rate}%</div><div className="stat-card-label">Resolution Rate</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red"><RotateCcw size={22} /></div>
            <div><div className="stat-card-value">{overview.reopened_issues}</div><div className="stat-card-label">Reopened</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon purple"><AlertTriangle size={22} /></div>
            <div><div className="stat-card-value">{overview.critical_issues}</div><div className="stat-card-label">Critical</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon teal"><Timer size={22} /></div>
            <div><div className="stat-card-value">{overview.avg_resolution_hours || '—'}h</div><div className="stat-card-label">Avg Resolution Time</div></div>
          </div>
        </div>
      )}

      {/* Officer Stats */}
      {officerStats && (
        <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="stat-card-icon teal" style={{ width: '36px', height: '36px', borderRadius: '8px' }}><Briefcase size={18} /></div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Officers</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{officerStats.total_officers} total</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '0.82rem' }}>
              <div><span style={{ fontWeight: 700, color: 'var(--success)' }}>{officerStats.available}</span> Available</div>
              <div><span style={{ fontWeight: 700, color: 'var(--primary)' }}>{officerStats.busy}</span> Busy</div>
              <div><span style={{ fontWeight: 700, color: 'var(--warning)' }}>{officerStats.on_leave}</span> On Leave</div>
            </div>
            <Link to="/admin/officers" className="btn btn-ghost btn-sm">Manage <ArrowRight size={14} /></Link>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Recent Issues (Priority Order)</h3>
          <Link to="/admin/triage" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} /></Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
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
                    <td style={{ fontSize: '0.82rem' }}>
                      {issue.category || issue.issue_type?.name || '—'}
                      {!issue.issue_type_id && issue.category && (
                        <span style={{
                          marginLeft: '6px',
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(93,159,150,0.12)',
                          color: 'var(--primary)',
                        }}>AI</span>
                      )}
                    </td>
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
