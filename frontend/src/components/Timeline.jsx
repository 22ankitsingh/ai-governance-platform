export default function Timeline({ items = [] }) {
  const getDotColor = (status) => {
    const colors = {
      not_assigned: 'gray',
      assigned: '',
      in_process: 'yellow',
      resolved: 'green',
      approved: 'green',
      closed: 'green',
      rejected: 'red',
      reopened: 'red',
    };
    return colors[status] || '';
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (items.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No status history yet.</p>;
  }

  return (
    <div className="timeline">
      {items.map((item, i) => (
        <div key={item.id || i} className="timeline-item">
          <div className={`timeline-dot ${getDotColor(item.to_status)}`}></div>
          <div className="timeline-content">
            <h4>
              {item.from_status
                ? `${item.from_status.replace('_', ' ')} → ${item.to_status.replace('_', ' ')}`
                : item.to_status.replace('_', ' ')}
            </h4>
            {item.notes && <p>{item.notes}</p>}
            <time>{formatDate(item.created_at)}</time>
          </div>
        </div>
      ))}
    </div>
  );
}
