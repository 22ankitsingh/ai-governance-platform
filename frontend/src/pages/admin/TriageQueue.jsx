import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';
import { ClipboardList, Settings2, Search, X } from 'lucide-react';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    load();
  }, [filters, searchQuery]);

  const load = () => {
    setLoading(true);
    const params = { page_size: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    if (searchQuery) params.search = searchQuery;
    
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-title-section" style={{ marginBottom: 0 }}>
          <h1>Triage Queue</h1>
          <p>Review and manage incoming issues</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {searchQuery && (
            <div className="search-active-pill" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'var(--secondary)', 
              padding: '6px 12px', 
              borderRadius: '99px',
              fontSize: '0.8rem',
              color: 'var(--primary)',
              fontWeight: 500
            }}>
              <span>Search: "{searchQuery}"</span>
              <button 
                onClick={() => {
                  setSearchParams({});
                }}
                style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: 'var(--primary)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
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
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>P</th>
                  <th>Issue</th>
                  <th>Reporter</th>
                  <th>Type</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>AI Conf</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedIssues.length === 0 ? (
                  <tr><td colSpan="9">
                    <div className="empty-state" style={{ padding: '48px 16px' }}>
                      <div className="empty-state-icon"><ClipboardList size={28} /></div>
                      <h3>No issues found</h3>
                      <p>No issues matching the selected filters</p>
                    </div>
                  </td></tr>
                ) : (
                  sortedIssues.map(issue => (
                    <tr key={issue.id}>
                      <td><PriorityBadge priority={issue.priority} /></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {issue.title.length > 40 ? issue.title.slice(0, 40) + '...' : issue.title}
                        </div>
                        {issue.reopen_count > 0 && (
                          <span className="badge badge-reopened" style={{ marginTop: '4px', fontSize: '0.65rem' }}>Reopened ×{issue.reopen_count}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {issue.reporter?.full_name || '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {issue.category || issue.issue_type?.name || '—'}
                          {!issue.issue_type_id && issue.category && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 900, background: 'rgba(93,159,150,0.1)', color: 'var(--primary)', padding: '1px 5px', borderRadius: '3px' }}>AI</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {issue.department?.name ? issue.department.name.split('&')[0].trim() : '—'}
                      </td>
                      <td><StatusBadge status={issue.status} /></td>
                      <td><ConfidenceMeter value={issue.ai_confidence} /></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(issue.created_at)}</td>
                      <td>
                        <Link to={`/admin/issues/${issue.id}`} className="btn btn-sm btn-ghost">
                          <Settings2 size={14} /> Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
