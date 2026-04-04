import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { notificationsAPI } from '../api/client';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    notificationsAPI.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    const interval = setInterval(() => {
      notificationsAPI.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <>
      <div className={`mobile-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🏛️</div>
          <h2>Governance Platform</h2>
        </div>

        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Dashboard</div>
                <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">📊</span> Overview
                </NavLink>
                <NavLink to="/admin/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">📈</span> Analytics
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Management</div>
                <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">👥</span> Users
                </NavLink>
                <NavLink to="/admin/triage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">📋</span> Triage Queue
                </NavLink>
                <NavLink to="/admin/audit-log" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">📝</span> Audit Log
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Account</div>
                <NavLink to="/admin/notifications" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">🔔</span> Notifications
                  {unread > 0 && <span className="notification-count" style={{ position: 'static', marginLeft: 'auto' }}>{unread}</span>}
                </NavLink>
              </div>
            </>
          ) : (
            <>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Dashboard</div>
                <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">🏠</span> My Dashboard
                </NavLink>
                <NavLink to="/dashboard/submit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">➕</span> Report Issue
                </NavLink>
                <NavLink to="/dashboard/issues" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">📄</span> My Issues
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Account</div>
                <NavLink to="/dashboard/notifications" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">🔔</span> Notifications
                  {unread > 0 && <span className="notification-count" style={{ position: 'static', marginLeft: 'auto' }}>{unread}</span>}
                </NavLink>
                <NavLink to="/dashboard/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                  <span className="sidebar-link-icon">👤</span> Profile
                </NavLink>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '0.75rem', color: 'rgba(255,255,255,0.6)' }} onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
