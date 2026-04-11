import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../api/client';
import { Link } from 'react-router-dom';
import { Bell, Info, RotateCcw, CheckCircle2, ClipboardList, ArrowRight } from 'lucide-react';

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

  const getIcon = (type) => {
    const icons = {
      info: <Info size={18} />,
      status_change: <RotateCcw size={18} />,
      verification: <CheckCircle2 size={18} />,
      assignment: <ClipboardList size={18} />,
    };
    return icons[type] || <Info size={18} />;
  };

  const getIconColor = (type) => {
    const colors = { info: 'var(--info)', status_change: 'var(--accent)', verification: 'var(--success)', assignment: 'var(--primary)' };
    return colors[type] || 'var(--info)';
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-title-section" style={{ marginBottom: 0 }}>
          <h1>Notifications</h1>
          <p>{notifications.filter(n => !n.is_read).length} unread</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark All Read</button>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={28} /></div>
          <h3>No notifications</h3>
          <p>You'll be notified when there are updates to your issues</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: 0 }}>
            {notifications.map(n => (
              <div key={n.id}
                style={{
                  display: 'flex', gap: '12px', padding: '16px 24px',
                  borderBottom: '1px solid var(--border-light)',
                  background: n.is_read ? 'transparent' : 'var(--primary-50)',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => !n.is_read && markRead([n.id])}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: n.is_read ? 'var(--gray-100)' : 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: n.is_read ? 'var(--text-muted)' : getIconColor(n.notification_type), flexShrink: 0 }}>
                  {getIcon(n.notification_type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>{n.title}</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{n.message}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <time style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</time>
                    {n.reference_id && (
                      <Link to={`/dashboard/issues/${n.reference_id}`} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        View Issue <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: '8px', flexShrink: 0 }}></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
