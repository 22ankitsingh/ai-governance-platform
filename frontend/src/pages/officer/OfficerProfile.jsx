import { useState, useEffect } from 'react';
import { officerAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  UserCog, Save, Star, AlertTriangle, ToggleLeft, ToggleRight,
  Briefcase, Mail, Phone, Award
} from 'lucide-react';

export default function OfficerProfile() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', mobile_number: '', designation: '' });
  const [saving, setSaving] = useState(false);
  const [togglingLeave, setTogglingLeave] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    officerAPI.me()
      .then(res => {
        setProfile(res.data);
        setForm({
          name: res.data.name || '',
          mobile_number: res.data.mobile_number || '',
          designation: res.data.designation || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await officerAPI.updateProfile(form);
      setProfile(res.data);
      // Update localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, name: res.data.name, designation: res.data.designation }));
      setMsg('Profile updated successfully');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveToggle = async () => {
    setTogglingLeave(true); setMsg('');
    try {
      const res = await officerAPI.toggleLeave({ is_on_leave: !profile.is_on_leave });
      setProfile(res.data);
      setMsg(res.data.is_on_leave ? 'You are now on leave' : 'Welcome back! You are now active');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Toggle failed');
    } finally {
      setTogglingLeave(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!profile) return null;

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      try {
        await officerAPI.deleteAccount();
        logout();
      } catch (err) {
        setMsg("Failed to delete account");
      }
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UserCog size={22} /> Profile Settings
      </h1>

      {msg && (
        <div className={`alert ${msg.includes('fail') ? 'alert-error' : 'alert-success'}`}>{msg}</div>
      )}

      <div className="grid-2col">
        {/* Edit Form */}
        <div className="card">
          <div className="card-header"><h3>Personal Information</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input className="form-input" value={form.mobile_number} onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))} placeholder="+91-XXXXXXXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-input" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Junior Engineer" />
            </div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Info & Performance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Read-only info */}
          <div className="card">
            <div className="card-header"><h3>Account Details</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={15} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{profile.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Briefcase size={15} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{profile.department_name || 'No department'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={15} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{profile.designation || 'No designation'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="card">
            <div className="card-header"><h3>Performance</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                    <Star size={18} fill="currentColor" /> {profile.avg_rating?.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Avg Rating ({profile.total_ratings} reviews)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: profile.negative_tickets > 0 ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                    <AlertTriangle size={18} /> {profile.negative_tickets}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Negative Tickets</div>
                </div>
              </div>
            </div>
          </div>

          {/* Suspension Status */}
          {profile.is_suspended && (
            <div className="card">
              <div className="card-body" style={{ background: 'rgba(240,68,56,0.08)', borderRadius: '8px', border: '1px solid rgba(240,68,56,0.2)' }}>
                <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> Account Suspended</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '8px', opacity: 0.9 }}>
                  Your account has been suspended due to receiving more than 5 negative tickets. You will no longer receive new issue assignments.
                </p>
              </div>
            </div>
          )}

          {/* Leave Toggle */}
          <div className="card">
            <div className="card-header"><h3>Availability</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {profile.is_on_leave ? 'Currently On Leave' : 'Currently Active'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {profile.is_suspended ? 'Suspended (No new assignments)' :
                      profile.is_on_leave
                      ? 'You will not receive new issue assignments'
                      : profile.is_available
                        ? 'You can receive new issue assignments'
                        : 'Busy with current assignment'}
                  </div>
                </div>
                <button
                  className={`btn ${profile.is_on_leave ? 'btn-success' : 'btn-warning'} btn-sm`}
                  onClick={handleLeaveToggle}
                  disabled={togglingLeave || profile.is_suspended}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {profile.is_on_leave ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {togglingLeave ? 'Updating...' : profile.is_on_leave ? 'Return to Duty' : 'Go On Leave'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
