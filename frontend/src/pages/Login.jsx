import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, UserCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('citizen');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password, role);
      const dest = user.role === 'admin' ? '/admin' : user.role === 'officer' ? '/officer' : '/dashboard';
      navigate(dest);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'citizen', label: 'Citizen', color: 'var(--primary)' },
    { value: 'officer', label: 'Officer', color: 'var(--accent)' },
    { value: 'admin', label: 'Admin', color: 'var(--warning)' },
  ];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', color: 'white', marginBottom: '16px' }}>
            <Shield size={24} />
          </div>
        </div>
        <h1>Welcome Back</h1>
        <p className="subtitle">Sign in to the PrajaGov platform</p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Role selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
          {roleOptions.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${role === r.value ? r.color : 'var(--border-light)'}`,
                background: role === r.value ? `${r.color}12` : 'transparent',
                color: role === r.value ? r.color : 'var(--text-secondary)',
                fontWeight: role === r.value ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserCircle size={14} />
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="login-email"
                type="email"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="login-password"
                type="password"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button id="login-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : `Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>

        <div style={{ marginTop: '24px', padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', fontSize: '0.78rem', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
          <strong>Demo accounts:</strong><br />
          Admin: admin@gov.in / admin123<br />
          Citizen: citizen@example.com / citizen123<br />
          Officer: officer@gov.in / officer123
        </div>
      </div>
    </div>
  );
}
