import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../api/client';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  // Field states
  const [fields, setFields] = useState({
    full_name: '',
    phone: '',
    email: ''
  });

  // Edit mode states (toggles for each editable field)
  const [editing, setEditing] = useState({
    full_name: false,
    phone: false
  });

  // Submitting states for each field
  const [saving, setSaving] = useState({
    full_name: false,
    phone: false
  });

  // Edited values (kept separate from display values until saved)
  const [tempValues, setTempValues] = useState({
    full_name: '',
    phone: ''
  });

  // Error states
  const [errors, setErrors] = useState({
    full_name: '',
    phone: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = () => {
    usersAPI.me()
      .then(res => {
        setFields({
          full_name: res.data.full_name || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
        });
      })
      .catch(err => console.error("Could not fetch profile"));
  };

  const handleEditClick = (field) => {
    setTempValues(prev => ({ ...prev, [field]: fields[field] }));
    setErrors(prev => ({ ...prev, [field]: '' }));
    setEditing(prev => ({ ...prev, [field]: true }));
  };

  const handleCancelClick = (field) => {
    setEditing(prev => ({ ...prev, [field]: false }));
  };

  const handleSaveField = async (field) => {
    // Validation
    const val = tempValues[field].trim();
    if (field === 'full_name' && !val) {
      setErrors(prev => ({ ...prev, full_name: 'Name cannot be empty' }));
      return;
    }
    if (field === 'phone' && val && !/^\+?[\d\s-]{10,15}$/.test(val)) {
      setErrors(prev => ({ ...prev, phone: 'Invalid phone number format' }));
      return;
    }

    setSaving(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: '' }));

    try {
      const payload = { ...fields, [field]: val };
      // Only name and phone allowed by backend
      await usersAPI.updateProfile({
        full_name: payload.full_name,
        phone: payload.phone || null
      });
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
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return setPassError("New passwords do not match.");
    }
    setPassLoading(true);
    try {
      await usersAPI.updatePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
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

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Profile Management</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>View and edit your personal details securely</p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
        
        {/* Personal Details with Inline Edit Mode */}
        <div className="card">
          <div className="card-header">
            <h3>Personal Information</h3>
          </div>
          <div className="card-body">
            
            {/* Full Name Block */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Full Name</label>
              {!editing.full_name ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--bg-light)', borderRadius: '4px', border: '1px solid transparent' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 500 }}>{fields.full_name || '-'}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEditClick('full_name')} title="Edit Name">
                    ✏️ Edit
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={tempValues.full_name} 
                      onChange={e => setTempValues({...tempValues, full_name: e.target.value})} 
                      disabled={saving.full_name}
                      autoFocus
                    />
                    {errors.full_name && <div style={{ color: 'var(--critical-color)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.full_name}</div>}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveField('full_name')} disabled={saving.full_name}>
                    {saving.full_name ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleCancelClick('full_name')} disabled={saving.full_name}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Number Block */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mobile Number</label>
              {!editing.phone ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--bg-light)', borderRadius: '4px', border: '1px solid transparent' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 500 }}>{fields.phone ? fields.phone : <span style={{ color: 'var(--text-muted)' }}>Not configured</span>}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEditClick('phone')} title="Edit Mobile Number">
                    ✏️ Edit
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="tel" 
                      className="form-input" 
                      value={tempValues.phone} 
                      onChange={e => setTempValues({...tempValues, phone: e.target.value})} 
                      disabled={saving.phone}
                      autoFocus
                    />
                    {errors.phone && <div style={{ color: 'var(--critical-color)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.phone}</div>}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveField('phone')} disabled={saving.phone}>
                    {saving.phone ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleCancelClick('phone')} disabled={saving.phone}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Email Block (READ ONLY) */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email Address (Read Only)</label>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>{fields.email || '-'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Change Password Block */}
        <div className="card">
          <div className="card-header">
            <h3>Change Password</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handlePasswordUpdate}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Current Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={passwordForm.current_password} 
                  onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})} 
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={passwordForm.new_password} 
                  onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})} 
                  required
                  placeholder="Min 8 characters"
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={passwordForm.confirm_password} 
                  onChange={e => setPasswordForm({...passwordForm, confirm_password: e.target.value})} 
                  required
                />
              </div>
              {passError && <div style={{ color: 'var(--critical-color)', marginBottom: '1rem', fontSize: '0.9rem' }}>{passError}</div>}
              <div>
                <button type="submit" className="btn btn-primary" disabled={passLoading}>
                  {passLoading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card" style={{ border: '1px solid var(--critical-color)' }}>
          <div className="card-header">
            <h3 style={{ color: 'var(--critical-color)' }}>Danger Zone</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              Once you delete your account, you will not be able to log in. Your previously submitted complaints and logs will be safely preserved for tracking purposes.
            </p>
            <button type="button" className="btn btn-danger" onClick={() => setShowDeleteModal(true)} disabled={deleteLoading}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="card-header"><h3>⚠️ Confirm Deletion</h3></div>
            <div className="card-body">
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                Are you absolutely sure you want to delete your account? This action will immediately terminate your session.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
