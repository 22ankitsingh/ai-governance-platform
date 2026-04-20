import { useState, useEffect } from 'react';
import { adminAPI, referenceAPI } from '../../api/client';
import {
  Briefcase, Plus, Star, AlertTriangle, UserCheck, UserX,
  Clock, Search, ChevronDown, X
} from 'lucide-react';

export default function OfficerManage() {
  const [officers, setOfficers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ department_id: '', available_only: false });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', mobile_number: '', department_id: '', designation: ''
  });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      adminAPI.listRealOfficers(filter.department_id ? { department_id: filter.department_id, available_only: filter.available_only || undefined } : { available_only: filter.available_only || undefined }),
      referenceAPI.departments(),
      adminAPI.officerStats(),
    ]).then(([officersRes, deptRes, statsRes]) => {
      setOfficers(officersRes.data);
      setDepartments(deptRes.data);
      setStats(statsRes.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [filter.department_id, filter.available_only]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      setMsg('Name, email and password are required');
      return;
    }
    setCreating(true); setMsg('');
    try {
      await adminAPI.createOfficer(createForm);
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', mobile_number: '', department_id: '', designation: '' });
      setMsg('Officer created successfully');
      loadData();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '1.35rem' }}>Manage Officers</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Create Officer</>}
        </button>
      </div>

      {msg && <div className={`alert ${msg.includes('fail') || msg.includes('required') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      {/* Stats Cards */}
      {stats && (
        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total_officers}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Officers</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{stats.available}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Available</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.busy}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Busy</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{stats.on_leave}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>On Leave</div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3><Plus size={16} /> Create New Officer</h3></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Officer's full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="officer@gov.in" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Set a password" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input className="form-input" value={createForm.mobile_number} onChange={e => setCreateForm(f => ({ ...f, mobile_number: e.target.value }))} placeholder="+91-XXXXXXXXXX" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={createForm.department_id} onChange={e => setCreateForm(f => ({ ...f, department_id: e.target.value }))}>
                  <option value="">— Select Department —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-input" value={createForm.designation} onChange={e => setCreateForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Junior Engineer" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Officer'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ maxWidth: '300px' }}
            value={filter.department_id}
            onChange={e => setFilter(f => ({ ...f, department_id: e.target.value }))}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filter.available_only}
              onChange={e => setFilter(f => ({ ...f, available_only: e.target.checked }))}
            />
            Available only
          </label>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {officers.length} officer{officers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Officers Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Officer</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Department</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Rating</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Neg. Tickets</th>
              </tr>
            </thead>
            <tbody>
              {officers.map(officer => (
                <tr key={officer.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{officer.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{officer.email}</div>
                      {officer.designation && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{officer.designation}</div>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {officer.department_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {officer.is_on_leave ? (
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}>On Leave</span>
                    ) : officer.is_available ? (
                      <span className="badge" style={{ background: 'rgba(18,183,106,0.12)', color: 'var(--success)' }}>Available</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(93,159,150,0.12)', color: 'var(--primary)' }}>Busy</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}>
                      <Star size={13} fill="currentColor" /> {officer.avg_rating?.toFixed(1)}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({officer.total_ratings})</span>
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: officer.negative_tickets > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {officer.negative_tickets}
                    </span>
                  </td>
                </tr>
              ))}
              {officers.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No officers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
