import { Outlet } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';
import { notificationsAPI } from '../api/client';
import {
  Menu, Search, Bell, ChevronDown, LogOut, User,
  LayoutDashboard, PlusCircle, FileText, Settings,
  BarChart3, Users, ClipboardList, ScrollText, TrendingUp,
  Shield, X, Briefcase, History, UserCog, AlertCircle
} from 'lucide-react';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout, isAdmin, isOfficer } = useAuth();
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [unread, setUnread] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Officers don't use the notifications system (yet)
    if (isOfficer) return;
    notificationsAPI.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    const interval = setInterval(() => {
      notificationsAPI.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [isOfficer]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  const initials = (user?.full_name || user?.name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const displayName = user?.full_name || user?.name || 'User';
  const basePath = isAdmin ? '/admin' : isOfficer ? '/officer' : '/dashboard';
  const notifPath = `${basePath}/notifications`;

  return (
    <div className="app-layout">
      {/* Mobile Overlay */}
      <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Shield size={20} />
          </div>
          <div>
            <h2>PrajaGov</h2>
            <div className="sidebar-brand-subtitle">Governance Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Overview</div>
                <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><LayoutDashboard size={18} /></span>
                  Dashboard
                </NavLink>
                <NavLink to="/admin/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><TrendingUp size={18} /></span>
                  Analytics
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Management</div>
                <NavLink to="/admin/triage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><ClipboardList size={18} /></span>
                  Triage Queue
                </NavLink>
                <NavLink to="/admin/officers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><Briefcase size={18} /></span>
                  Officers
                </NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><Users size={18} /></span>
                  Citizens
                </NavLink>
                <NavLink to="/admin/audit-log" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><ScrollText size={18} /></span>
                  Audit Log
                </NavLink>
              </div>
            </>
          ) : isOfficer ? (
            <>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Overview</div>
                <NavLink to="/officer" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><LayoutDashboard size={18} /></span>
                  Dashboard
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Issues</div>
                <NavLink to="/officer/current-issue" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><AlertCircle size={18} /></span>
                  Current Issue
                </NavLink>
                <NavLink to="/officer/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><History size={18} /></span>
                  Issue History
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Account</div>
                <NavLink to="/officer/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><UserCog size={18} /></span>
                  Profile
                </NavLink>
              </div>
            </>
          ) : (
            <>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Menu</div>
                <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><LayoutDashboard size={18} /></span>
                  Dashboard
                </NavLink>
                <NavLink to="/dashboard/submit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><PlusCircle size={18} /></span>
                  Report Issue
                </NavLink>
                <NavLink to="/dashboard/issues" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><FileText size={18} /></span>
                  My Issues
                </NavLink>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Account</div>
                <NavLink to="/dashboard/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="sidebar-link-icon"><Settings size={18} /></span>
                  Settings
                </NavLink>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: '12px', color: 'rgba(255,255,255,0.5)', justifyContent: 'flex-start', gap: '8px' }}
            onClick={handleLogout}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Top Navbar */}
        <header className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mobile-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>

            {/* Search bar */}
            <form 
              className="navbar-search" 
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  const target = isAdmin ? '/admin/triage' : isOfficer ? '/officer/history' : '/dashboard/issues';
                  navigate(`${target}?search=${encodeURIComponent(searchQuery.trim())}`);
                  setSidebarOpen(false);
                }
              }}
            >
              <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Notification bell (not for officers) */}
            {!isOfficer && (
              <button
                className="navbar-icon-btn"
                onClick={() => navigate(notifPath)}
                title="Notifications"
              >
                <Bell size={20} />
                {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
              </button>
            )}

            {/* Profile dropdown */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <div
                className="navbar-profile"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="navbar-profile-avatar">{initials}</div>
                <span className="navbar-profile-name">{displayName.split(' ')[0]}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              </div>

              {profileOpen && (
                <div className="profile-dropdown">
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>{user?.role}</div>
                  </div>
                  {isOfficer && (
                    <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/officer/profile'); }}>
                      <UserCog size={16} /> Profile Settings
                    </button>
                  )}
                  {!isAdmin && !isOfficer && (
                    <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/dashboard/profile'); }}>
                      <User size={16} /> Profile Settings
                    </button>
                  )}
                  {!isOfficer && (
                    <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate(notifPath); }}>
                      <Bell size={16} /> Notifications {unread > 0 && <span style={{ marginLeft: 'auto', background: 'var(--danger)', color: 'white', borderRadius: '999px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>{unread}</span>}
                    </button>
                  )}
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page body */}
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
