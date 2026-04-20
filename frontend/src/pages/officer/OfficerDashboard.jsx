import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { officerAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Star, AlertTriangle, CheckCircle2, Clock, Briefcase,
  ArrowRight, ToggleLeft, ToggleRight
} from 'lucide-react';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [currentIssue, setCurrentIssue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      officerAPI.stats(),
      officerAPI.currentIssue(),
    ]).then(([statsRes, issueRes]) => {
      setStats(statsRes.data);
      setCurrentIssue(issueRes.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  const displayName = user?.name || user?.full_name || 'Officer';
  const designation = user?.designation || 'Officer';

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Welcome, {displayName}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {designation} • {user?.department_name || 'Department'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(93,159,150,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--primary)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats?.total_resolved || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Issues Resolved</div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
            <Star size={22} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats?.avg_rating?.toFixed(1) || '0.0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Avg Rating ({stats?.total_ratings || 0} reviews)
          </div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(240,68,56,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--danger)' }}>
            <AlertTriangle size={22} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: stats?.negative_tickets > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {stats?.negative_tickets || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Negative Tickets</div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: stats?.is_available ? 'rgba(18,183,106,0.12)' : 'rgba(107,114,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: stats?.is_available ? 'var(--success)' : 'var(--text-muted)' }}>
            <Briefcase size={22} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: stats?.is_on_leave ? 'var(--warning)' : stats?.is_available ? 'var(--success)' : 'var(--text-secondary)' }}>
            {stats?.is_on_leave ? 'On Leave' : stats?.is_available ? 'Available' : 'Busy'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Current Status</div>
        </div>
      </div>

      {/* Current Assignment */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Current Assignment
          </h3>
        </div>
        <div className="card-body">
          {currentIssue ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '1.05rem' }}>{currentIssue.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                    {currentIssue.description?.slice(0, 200)}{currentIssue.description?.length > 200 ? '...' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span><strong>Category:</strong> {currentIssue.category || '—'}</span>
                    <span><strong>Severity:</strong> {currentIssue.severity}</span>
                    <span><strong>Priority:</strong> P{currentIssue.priority}</span>
                    {currentIssue.assigned_at && (
                      <span><strong>Assigned:</strong> {new Date(currentIssue.assigned_at).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/officer/current-issue')}
                  style={{ flexShrink: 0 }}
                >
                  View & Resolve <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--gray-400)' }}>
                <CheckCircle2 size={28} />
              </div>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>No Active Assignment</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                You currently have no issues assigned. New issues will be automatically assigned when available.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
