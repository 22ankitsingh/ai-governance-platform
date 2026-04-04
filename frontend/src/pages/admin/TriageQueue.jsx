import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, referenceAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';

export default function TriageQueue() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [deptGroups, setDeptGroups] = useState([]); // [{department_id, department_name, issue_types:[{id,name}]}]
  const [filters, setFilters] = useState({
    status: '', issue_type_id: '', severity: '', department_id: '', search: ''
  });

  useEffect(() => {
    adminAPI.listDepartments().then(r => setDepartments(r.data)).catch(() => {});
    referenceAPI.categories().then(r => setDeptGroups(r.data)).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = { page_size: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    adminAPI.listIssues(params).then(r => setIssues(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.status === "closed" && b.status !== "closed") return 1;
    if (a.status !== "closed" && b.status === "closed") return -1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  // All issue types flat list for filter (or filtered by selected dept)
  const allIssueTypes = deptGroups.flatMap(g => g.issue_types.map(it => ({
    ...it, department_name: g.department_name,
  })));
  const filteredIssueTypeOptions = filters.department_id
    ? deptGroups.find(g => g.department_id === filters.department_id)?.issue_types || []
    : allIssueTypes;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Triage Queue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{issues.length} issues</p>
        </div>
      </div>

      <div className="filters-bar">
        <input className="search-input" placeholder="🔍 Search issues..." value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
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
        <select className="filter-select" value={filters.department_id} onChange={e => setFilters(f => ({ ...f, department_id: e.target.value, issue_type_id: '' }))}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className="filter-select"
          value={filters.issue_type_id}
          onChange={e => setFilters(f => ({ ...f, issue_type_id: e.target.value }))}
        >
          <option value="">All Issue Types</option>
          {filteredIssueTypeOptions.map(it => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No issues found</h3>
          <p>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Issue</th>
                <th>Reporter</th>
                <th>Issue Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Severity</th>
                <th>AI Confidence</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map(issue => (
                <tr key={issue.id}>
                  <td><PriorityBadge priority={issue.priority} /></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {issue.title.length > 45 ? issue.title.slice(0, 45) + '...' : issue.title}
                    </div>
                    {issue.reopen_count > 0 && (
                      <span className="badge badge-reopened" style={{ marginTop: '0.25rem' }}>Reopened ×{issue.reopen_count}</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {issue.reporter?.full_name || '—'}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{issue.issue_type?.name || '—'}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {issue.department?.name
                      ? issue.department.name.split('&')[0].trim()  // abbreviate long names
                      : '—'}
                  </td>
                  <td><StatusBadge status={issue.status} /></td>
                  <td><SeverityBadge severity={issue.severity} /></td>
                  <td style={{ minWidth: 120 }}><ConfidenceMeter value={issue.ai_confidence} /></td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(issue.created_at)}</td>
                  <td>
                    <Link to={`/admin/issues/${issue.id}`} className="btn btn-ghost btn-sm">Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
