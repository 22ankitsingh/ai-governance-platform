import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../api/client';
import { Link } from 'react-router-dom';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsAPI.list({ page_size: 50 }).then(r => setNotifications(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await notificationsAPI.markAllRead();
    setNotifications(n => n.map(item => ({ ...item, is_read: true })));
  };

  const markRead = async (ids) => {
    await notificationsAPI.markRead(ids);
    setNotifications(n => n.map(item => ids.includes(item.id) ? { ...item, is_read: true } : item));
  };

  const formatDate = (d) => new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const typeIcons = {
    info: 'ℹ️',
    status_change: '🔄',
    verification: '✅',
    assignment: '📋',
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Notifications</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {notifications.filter(n => !n.is_read).length} unread
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark All Read</button>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <h3>No notifications</h3>
          <p>You'll be notified when there are updates to your issues</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {notifications.map(n => (
              <div key={n.id}
                style={{
                  display: 'flex', gap: '0.75rem', padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-light)',
                  background: n.is_read ? 'transparent' : 'var(--info-bg)',
                  cursor: n.is_read ? 'default' : 'pointer',
                }}
                onClick={() => !n.is_read && markRead([n.id])}
              >
                <div style={{ fontSize: '1.25rem' }}>{typeIcons[n.notification_type] || 'ℹ️'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.2rem' }}>{n.title}</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.message}</p>
                  <time style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</time>
                  {n.reference_id && (
                    <Link to={`/dashboard/issues/${n.reference_id}`}
                      style={{ fontSize: '0.78rem', marginLeft: '1rem' }}>View Issue →</Link>
                  )}
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)', marginTop: '0.5rem' }}></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
