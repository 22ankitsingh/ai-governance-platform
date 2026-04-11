import { useState, useEffect, useCallback } from 'react';
import { analyticsAPI } from '../../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Legend,
} from 'recharts';
import { BarChart3, CheckCircle2, RotateCcw, Brain, RefreshCw, Maximize2, X, TrendingUp } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#5D9F96', '#EC9B05', '#FCB404', '#95E913', '#9333ea', '#12B76A', '#F97316', '#667085', '#FCC5F8', '#2E90FA'];

const DEPT_ABBR = {
  'Municipal Administration & Urban Development': 'MAUD',
  'Panchayat Raj and Rural Development': 'PRRD',
  'Consumer Affairs, Food & Civil Supplies': 'CAFCS',
  'Transport, Roads and Buildings': 'TRB',
  'Energy': 'Energy',
  'Health, Medical & Family Welfare': 'HMFW',
  'Environment, Forests, Science and Technology': 'EFST',
  'Agriculture and Co-operation': 'AGRI',
};

const getAbbr = (name) => DEPT_ABBR[name] || (name.length > 10 ? name.slice(0, 8) + '…' : name);

const SEVERITY_COLORS = { low: '#12B76A', medium: '#F79009', high: '#F97316', critical: '#F04438' };

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomDeptTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        padding: '0.6rem 1rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.2rem' }}>{payload[0].payload.department}</div>
        <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{payload[0].value} issues</div>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        padding: '0.6rem 1rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.2rem' }}>
          {payload[0].name}
        </div>
        <div style={{ color: payload[0].fill, fontWeight: 600 }}>{payload[0].value} issues</div>
      </div>
    );
  }
  return null;
};

// ─── Chart Modal (Fullscreen) ─────────────────────────────────────────────────

function ChartModal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          animation: 'slideUp 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'var(--bg-hover)',
              borderRadius: '8px', cursor: 'pointer',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', color: 'var(--text-secondary)',
              transition: 'background 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--border-light)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          >
            <X size={18} />
          </button>
        </div>
        {/* Modal Body */}
        <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Chart Card Wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, onMaximize, children, badge }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="card"
      style={{ transition: 'box-shadow 0.2s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {badge && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--primary-50)', color: 'var(--primary)' }}>
              {badge}
            </span>
          )}
        </div>
        <button
          onClick={onMaximize}
          title="Maximize chart"
          style={{
            border: 'none',
            background: hovered ? 'var(--bg-hover)' : 'transparent',
            borderRadius: '6px', cursor: 'pointer',
            width: '30px', height: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', color: 'var(--text-muted)',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: hovered ? 1 : 0.4,
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

// ─── AI Accuracy Progress Bar ─────────────────────────────────────────────────

function AccuracyBar({ value, max = 100, color = 'var(--primary-500)', label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {label && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>}
      <div style={{ background: 'var(--bg-hover)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: '99px',
          background: color,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Inline animations (keyframes injected once) ──────────────────────────────

const STYLES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Analytics() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [maximized, setMaximized] = useState(null); // chart key

  const fetchData = useCallback(() => {
    setLoading(true);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  const isExpanded = (key) => maximized === key;
  const openModal = (key) => setMaximized(key);
  const closeModal = () => setMaximized(null);

  // ── Department chart (abbreviated keys for grid, full for expanded) ─────────
  const deptDataGrid = (data.byDepartment || []).map(d => ({ ...d, displayName: getAbbr(d.department) }));
  const deptDataFull = data.byDepartment || [];

  const DeptBarContent = ({ expanded }) => {
    const chartData = expanded ? deptDataFull : deptDataGrid;
    const xKey = expanded ? 'department' : 'displayName';
    return (
      <ResponsiveContainer width="100%" height={expanded ? 400 : 300}>
        <BarChart data={chartData} margin={{ bottom: expanded ? 80 : 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis
            dataKey={xKey}
            fontSize={expanded ? 11 : 10}
            angle={expanded ? -35 : -20}
            textAnchor="end"
            height={expanded ? 90 : 60}
            interval={0}
          />
          <YAxis fontSize={12} />
          <Tooltip content={<CustomDeptTooltip />} />
          <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // ── Issue Type Pie (no labels in grid, labels in expanded) ─────────────────
  const IssueTypePieContent = ({ expanded }) => (
    (data.byIssueType?.length > 0) ? (
      <ResponsiveContainer width="100%" height={expanded ? 440 : 300}>
        <PieChart>
          <Pie
            data={data.byIssueType}
            dataKey="count"
            nameKey="issue_type"
            cx="50%"
            cy="50%"
            outerRadius={expanded ? 160 : 110}
            innerRadius={expanded ? 50 : 0}
            label={expanded
              ? ({ issue_type, count, percent }) =>
                  `${issue_type.length > 18 ? issue_type.slice(0, 16) + '…' : issue_type} (${(percent * 100).toFixed(0)}%)`
              : false
            }
            labelLine={expanded}
          >
            {data.byIssueType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomPieTooltip />} />
          {expanded && <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '1rem' }} />}
        </PieChart>
      </ResponsiveContainer>
    ) : <div className="empty-state"><p>No data</p></div>
  );

  // ── Status Bar ─────────────────────────────────────────────────────────────
  const StatusBarContent = ({ expanded }) => (
    (data.byStatus?.length > 0) ? (
      <ResponsiveContainer width="100%" height={expanded ? 400 : 300}>
        <BarChart data={data.byStatus} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis type="number" fontSize={12} />
          <YAxis dataKey="status" type="category" fontSize={11} width={100} />
          <Tooltip />
          <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    ) : <div className="empty-state"><p>No data</p></div>
  );

  // ── Severity Pie ──────────────────────────────────────────────────────────
  const SeverityPieContent = ({ expanded }) => (
    (data.bySeverity?.length > 0) ? (
      <ResponsiveContainer width="100%" height={expanded ? 400 : 300}>
        <PieChart>
          <Pie
            data={data.bySeverity}
            dataKey="count"
            nameKey="severity"
            cx="50%"
            cy="50%"
            outerRadius={expanded ? 150 : 100}
            label={expanded ? ({ severity, percent }) => `${severity} (${(percent * 100).toFixed(0)}%)` : false}
            labelLine={expanded}
          >
            {data.bySeverity.map((entry, i) => (
              <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || COLORS[i]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    ) : <div className="empty-state"><p>No data</p></div>
  );

  const ai = data.aiAccuracy || {};
  const hasReviews = (ai.total_reviewed || 0) > 0;

  return (
    <div>
      {/* Inject animations */}
      <style>{STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div className="page-title-section" style={{ marginBottom: 0 }}>
          <h1>Analytics Dashboard</h1>
          <p>Platform performance and AI insights</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} title="Refresh data">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Key Metrics ────────────────────────────────────────────────────── */}
      {data.overview && (
        <div className="stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-card-icon blue"><BarChart3 size={22} /></div>
            <div><div className="stat-card-value">{data.overview.total_issues}</div><div className="stat-card-label">Total Issues</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green"><CheckCircle2 size={22} /></div>
            <div><div className="stat-card-value">{data.overview.resolution_rate}%</div><div className="stat-card-label">Resolution Rate</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red"><RotateCcw size={22} /></div>
            <div><div className="stat-card-value">{data.overview.reopen_rate}%</div><div className="stat-card-label">Reopen Rate</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon teal"><Brain size={22} /></div>
            <div>
              <div className="stat-card-value">{hasReviews ? `${ai.accuracy_rate}%` : '—'}</div>
              <div className="stat-card-label">AI Accuracy {!hasReviews && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>(pending review)</span>}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts Grid ─────────────────────────────────────────────────────── */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>

        {/* Issues by Department */}
        <ChartCard title="Issues by Department" badge="BAR" onMaximize={() => openModal('dept')}>
          {data.byDepartment?.length > 0
            ? <DeptBarContent expanded={false} />
            : <div className="empty-state"><p>No data</p></div>
          }
        </ChartCard>

        {/* Issues by Issue Type */}
        <ChartCard title="Issues by Type" badge="PIE" onMaximize={() => openModal('type')}>
          <IssueTypePieContent expanded={false} />
        </ChartCard>

        {/* Issues by Status */}
        <ChartCard title="Issues by Status" badge="BAR" onMaximize={() => openModal('status')}>
          <StatusBarContent expanded={false} />
        </ChartCard>

        {/* Issues by Severity */}
        <ChartCard title="Issues by Severity" badge="PIE" onMaximize={() => openModal('severity')}>
          <SeverityPieContent expanded={false} />
        </ChartCard>

      </div>

      {/* ── AI Accuracy Panel ───────────────────────────────────────────────── */}
      {data.aiAccuracy && (
        <div className="card">
          <div className="card-header">
            <h3><Brain size={16} /> AI Prediction Performance</h3>
            {!hasReviews && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No admin feedback yet — go to an issue's AI tab to review
              </span>
            )}
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Total Predictions</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{ai.total_predictions ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Admin Reviewed</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{ai.total_reviewed ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Correct</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>{ai.correct_predictions ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Incorrect</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)' }}>{ai.incorrect_predictions ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Accuracy Rate</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: hasReviews ? 'var(--success)' : 'var(--text-muted)' }}>
                  {hasReviews ? `${ai.accuracy_rate}%` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Avg Confidence</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{Math.round((ai.avg_confidence || 0) * 100)}%</div>
              </div>
            </div>

            {/* Visual accuracy bar */}
            {hasReviews && (
              <div style={{ maxWidth: '480px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Accuracy breakdown ({ai.total_reviewed} reviewed)
                </div>
                <AccuracyBar
                  value={ai.correct_predictions}
                  max={ai.total_reviewed}
                  color="var(--success)"
                  label={`Correct: ${ai.correct_predictions}`}
                />
                <AccuracyBar
                  value={ai.incorrect_predictions}
                  max={ai.total_reviewed}
                  color="var(--danger)"
                  label={`Incorrect: ${ai.incorrect_predictions}`}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Based on {ai.total_reviewed} admin-reviewed issues out of {ai.total_predictions} total predictions.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {maximized === 'dept' && (
        <ChartModal title="Issues by Department — Full View" onClose={closeModal}>
          <DeptBarContent expanded={true} />
        </ChartModal>
      )}
      {maximized === 'type' && (
        <ChartModal title="Issues by Type — Full View" onClose={closeModal}>
          <IssueTypePieContent expanded={true} />
        </ChartModal>
      )}
      {maximized === 'status' && (
        <ChartModal title="Issues by Status — Full View" onClose={closeModal}>
          <StatusBarContent expanded={true} />
        </ChartModal>
      )}
      {maximized === 'severity' && (
        <ChartModal title="Issues by Severity — Full View" onClose={closeModal}>
          <SeverityPieContent expanded={true} />
        </ChartModal>
      )}
    </div>
  );
}
