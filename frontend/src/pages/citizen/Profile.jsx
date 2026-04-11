import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Lock, Edit3, X, Check, AlertTriangle, Trash2 } from 'lucide-react';

export default function Profile() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState({ full_name: '', phone: '', email: '' });
  const [editing, setEditing] = useState({ full_name: false, phone: false });
  const [saving, setSaving] = useState({ full_name: false, phone: false });
  const [tempValues, setTempValues] = useState({ full_name: '', phone: '' });
  const [errors, setErrors] = useState({ full_name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = () => {
    usersAPI.me().then(res => {
      setFields({ full_name: res.data.full_name || '', phone: res.data.phone || '', email: res.data.email || '' });
    }).catch(() => {});
  };

  const handleEditClick = (field) => {
    setTempValues(prev => ({ ...prev, [field]: fields[field] }));
    setErrors(prev => ({ ...prev, [field]: '' }));
    setEditing(prev => ({ ...prev, [field]: true }));
  };

  const handleCancelClick = (field) => { setEditing(prev => ({ ...prev, [field]: false })); };

  const handleSaveField = async (field) => {
    const val = tempValues[field].trim();
    if (field === 'full_name' && !val) { setErrors(prev => ({ ...prev, full_name: 'Name cannot be empty' })); return; }
    if (field === 'phone' && val && !/^\+?[\d\s-]{10,15}$/.test(val)) { setErrors(prev => ({ ...prev, phone: 'Invalid phone number format' })); return; }

    setSaving(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: '' }));
    try {
      const payload = { ...fields, [field]: val };
      await usersAPI.updateProfile({ full_name: payload.full_name, phone: payload.phone || null });
      setFields(prev => ({ ...prev, [field]: val }));
      setEditing(prev => ({ ...prev, [field]: false }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [field]: err.response?.data?.detail || "Failed to save" }));
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPassError('');
    if (passwordForm.new_password !== passwordForm.confirm_password) { return setPassError("New passwords do not match."); }
    setPassLoading(true);
    try {
      await usersAPI.updatePassword({ current_password: passwordForm.current_password, new_password: passwordForm.new_password });
      alert("Password changed successfully!");
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPassError(err.response?.data?.detail || "Failed to change password");
    } finally {
      setPassLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await usersAPI.deleteAccount();
      logout();
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete account");
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const renderField = (field, label, icon, type = 'text') => (
    <div style={{ marginBottom: '24px' }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
        {icon} {label}
      </label>
      {!editing[field] ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
            {fields[field] || <span style={{ color: 'var(--text-muted)' }}>Not configured</span>}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => handleEditClick(field)} style={{ gap: '4px' }}>
            <Edit3 size={14} /> Edit
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <input type={type} className="form-input" value={tempValues[field]} onChange={e => setTempValues({...tempValues, [field]: e.target.value})} disabled={saving[field]} autoFocus />
            {errors[field] && <div className="form-error">{errors[field]}</div>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => handleSaveField(field)} disabled={saving[field]}>
            <Check size={14} /> {saving[field] ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleCancelClick(field)} disabled={saving[field]}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-title-section">
        <h1>Profile Management</h1>
        <p>View and edit your personal details securely</p>
      </div>

      <div style={{ display: 'grid', gap: '24px', maxWidth: '600px' }}>
        <div className="card">
          <div className="card-header"><h3>Personal Information</h3></div>
          <div className="card-body">
            {renderField('full_name', 'Full Name', <User size={14} />)}
            {renderField('phone', 'Mobile Number', <Phone size={14} />, 'tel')}

            <div style={{ marginBottom: '8px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                <Mail size={14} /> Email Address (Read Only)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{fields.email || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3><Lock size={16} /> Change Password</h3></div>
          <div className="card-body">
            <form onSubmit={handlePasswordUpdate}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={passwordForm.current_password} onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={passwordForm.new_password} onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})} required placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" value={passwordForm.confirm_password} onChange={e => setPasswordForm({...passwordForm, confirm_password: e.target.value})} required />
              </div>
              {passError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{passError}</div>}
              <button type="submit" className="btn btn-primary" disabled={passLoading}>
                {passLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ border: '1px solid var(--danger-border)' }}>
          <div className="card-header"><h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> Danger Zone</h3></div>
          <div className="card-body">
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Once you delete your account, you will not be able to log in. Your previously submitted complaints and logs will be safely preserved for tracking purposes.
            </p>
            <button type="button" className="btn btn-danger" onClick={() => setShowDeleteModal(true)} disabled={deleteLoading}>
              <Trash2 size={16} /> Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: 'var(--danger)' }} /> Confirm Deletion
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
                Are you absolutely sure you want to delete your account? This action will immediately terminate your session.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                  {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
