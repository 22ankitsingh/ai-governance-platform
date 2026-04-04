import { useState, useEffect } from 'react';
import { analyticsAPI } from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3381ff', '#07c4ae', '#f59e0b', '#ef4444', '#9333ea', '#10b981', '#f97316', '#64748b'];

export default function Analytics() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.overview(),
      analyticsAPI.byDepartment(),
      analyticsAPI.byIssueType(),
      analyticsAPI.byStatus(),
      analyticsAPI.bySeverity(),
      analyticsAPI.aiAccuracy(),
    ]).then(([overview, byDept, byIT, byStatus, bySev, ai]) => {
      setData({
        overview: overview.data,
        byDepartment: byDept.data,
        byIssueType: byIT.data,
        byStatus: byStatus.data,
        bySeverity: bySev.data,
        aiAccuracy: ai.data,
      });
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Analytics Dashboard</h1>

      {/* Key Metrics */}
      {data.overview && (
        <div className="stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-card-icon blue">📊</div>
            <div><div className="stat-card-value">{data.overview.total_issues}</div><div className="stat-card-label">Total Issues</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green">✅</div>
            <div><div className="stat-card-value">{data.overview.resolution_rate}%</div><div className="stat-card-label">Resolution Rate</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red">🔄</div>
            <div><div className="stat-card-value">{data.overview.reopen_rate}%</div><div className="stat-card-label">Reopen Rate</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon teal">🤖</div>
            <div><div className="stat-card-value">{data.aiAccuracy?.accuracy_rate || 0}%</div><div className="stat-card-label">AI Accuracy</div></div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Issues by Department */}
        <div className="card">
          <div className="card-header"><h3>Issues by Department</h3></div>
          <div className="card-body">
            {data.byDepartment?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.byDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="department" fontSize={10} angle={-20} textAnchor="end" height={60} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No data</p></div>}
          </div>
        </div>

        {/* Issues by Issue Type */}
        <div className="card">
          <div className="card-header"><h3>Issues by Issue Type</h3></div>
          <div className="card-body">
            {data.byIssueType?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.byIssueType} dataKey="count" nameKey="issue_type" cx="50%" cy="50%" outerRadius={100} label={({ issue_type, count }) => `${issue_type}: ${count}`} labelLine={false}>
                    {data.byIssueType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No data</p></div>}
          </div>
        </div>

        {/* Issues by Status */}
        <div className="card">
          <div className="card-header"><h3>Issues by Status</h3></div>
          <div className="card-body">
            {data.byStatus?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.byStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="status" type="category" fontSize={11} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--accent-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No data</p></div>}
          </div>
        </div>

        {/* Issues by Severity */}
        <div className="card">
          <div className="card-header"><h3>Issues by Severity</h3></div>
          <div className="card-body">
            {data.bySeverity?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.bySeverity} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={100} label>
                    {data.bySeverity.map((entry, i) => {
                      const colors = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
                      return <Cell key={i} fill={colors[entry.severity] || COLORS[i]} />;
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No data</p></div>}
          </div>
        </div>
      </div>

      {/* AI Accuracy Summary */}
      {data.aiAccuracy && (
        <div className="card">
          <div className="card-header"><h3>🤖 AI Prediction Performance</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Predictions</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.aiAccuracy.total_predictions}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category Matches</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.aiAccuracy.category_matches}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Accuracy Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{data.aiAccuracy.accuracy_rate}%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Confidence</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(data.aiAccuracy.avg_confidence * 100)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
