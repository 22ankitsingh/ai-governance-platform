import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Mail, Phone, Lock } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.full_name.trim()) { setError('Full Name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
      };

      await register(payload);
      setSuccess('Account created successfully! Redirecting...');
      setTimeout(() => { navigate('/dashboard'); }, 1500);
    } catch (err) {
      if (err.response) {
        const detail = err.response.data?.detail;
        if (Array.isArray(detail)) {
          const errorMsgs = detail.map((d) => {
            const field = d.loc[d.loc.length - 1] || 'Field';
            return `${field}: ${d.msg}`;
          });
          setError(`Validation error - ${errorMsgs.join(', ')}`);
        } else if (typeof detail === 'string') {
          setError(detail);
        } else {
          setError('Server error during registration. Please try again.');
        }
      } else if (err.request) {
        setError('Network error. Please check your connection to the server.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      if (!success) setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', color: 'white', marginBottom: '16px' }}>
            <Shield size={24} />
          </div>
        </div>
        <h1>Create Account</h1>
        <p className="subtitle">Register as a citizen to report issues</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="register-name" type="text" className="form-input" style={{ paddingLeft: '36px' }} placeholder="Your full name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="register-email" type="email" className="form-input" style={{ paddingLeft: '36px' }} placeholder="your@email.com" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="register-phone" type="tel" className="form-input" style={{ paddingLeft: '36px' }} placeholder="+91-XXXXXXXXXX" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="register-password" type="password" className="form-input" style={{ paddingLeft: '36px' }} placeholder="At least 6 characters" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
            </div>
          </div>
          <button id="register-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
