export default function StatusBadge({ status }) {
  const labels = {
    not_assigned: 'Not Assigned',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    reopened: 'Reopened',
    // Legacy statuses (backward compat for old data)
    assigned: 'Assigned',
    in_process: 'In Process',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
}

export function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>;
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`badge-priority p${priority}`} title={`Priority ${priority}`}>
      P{priority}
    </span>
  );
}

export function ConfidenceMeter({ value }) {
  const pct = Math.round((value || 0) * 100);
  const level = pct >= 80 ? 'high' : pct >= 55 ? 'medium' : 'low';

  return (
    <div className="confidence-meter">
      <div className="confidence-bar">
        <div className={`confidence-fill ${level}`} style={{ width: `${pct}%` }}></div>
      </div>
      <span className="confidence-value">{pct}%</span>
    </div>
  );
}
