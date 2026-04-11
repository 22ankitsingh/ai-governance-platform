import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { issuesAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge } from '../../components/StatusBadge';
import { ClipboardList, ArrowRight, PlusCircle, X } from 'lucide-react';

export default function MyIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (searchQuery) params.search = searchQuery;
    
    issuesAPI.list(params)
      .then(r => setIssues(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters, searchQuery]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-title-section" style={{ marginBottom: 0 }}>
          <h1>My Reported Issues</h1>
          <p>{issues.length} total issues</p>
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
          <select className="form-input" style={{ width: '150px' }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="not_assigned">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="reopened">Reopened</option>
          </select>
          <select className="form-input" style={{ width: '150px' }}
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
      ) : issues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={28} /></div>
          <h3>No issues found</h3>
          <p>You haven't reported any issues matching the selected filters.</p>
          <Link to="/dashboard/submit" className="btn btn-primary" style={{ marginTop: '16px' }}>
            <PlusCircle size={16} /> Report New Issue
          </Link>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Issue</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr key={issue.id}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDate(issue.created_at)}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{issue.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {issue.id.slice(0, 8)}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {issue.category || issue.issue_type?.name || '—'}
                        {!issue.issue_type_id && issue.category && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, background: 'rgba(93,159,150,0.1)', color: 'var(--primary)', padding: '1px 5px', borderRadius: '3px' }}>AI</span>
                        )}
                      </div>
                    </td>
                    <td><StatusBadge status={issue.status} /></td>
                    <td><SeverityBadge severity={issue.severity} /></td>
                    <td><PriorityBadge priority={issue.priority} /></td>
                    <td>
                      <Link to={`/dashboard/issues/${issue.id}`} className="btn btn-sm btn-ghost">
                        Details <ArrowRight size={14} />
                      </Link>
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
