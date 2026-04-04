import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { issuesAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';
import { MapView } from '../../components/MapPicker';

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyForm, setVerifyForm] = useState({ approved: true, rating: 5, feedback: '', rejection_reason: '' });
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    console.log(`[IssueDetail] Fetching issue ${id}`);
    issuesAPI.get(id).then(r => setIssue(r.data)).catch(() => navigate('/dashboard/issues')).finally(() => setLoading(false));
  }, [id]);

  const handleVerify = async () => {
    console.log('[IssueDetail] Submitting verification:', verifyForm);
    setVerifying(true);
    setVerifyMsg('');
    try {
      const res = await issuesAPI.verify(id, verifyForm);
      console.log('[IssueDetail] Verification successful:', res.data);
      
      // Update local issue state with full returned detail
      setIssue(res.data);
      
      // Show success message and reset tab
      setVerifyMsg(verifyForm.approved ? 'Resolution approved. This issue is now CLOSED.' : 'Resolution rejected. This issue has been REOPENED.');
      setActiveTab('details');
    } catch (err) {
      console.error('[IssueDetail] Verification failed:', err);
      setVerifyMsg(err.response?.data?.detail || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await issuesAPI.delete(id);
      navigate('/dashboard/issues');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete issue');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!issue) return null;

  const beforeImages = issue.media?.filter(m => m.upload_phase === 'before') || [];
  const afterImages = issue.media?.filter(m => m.upload_phase === 'after') || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard/issues')}>
          ← Back to Issues
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)} disabled={deleting}>
          🗑 Delete Complaint
        </button>
      </div>

      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="card-header"><h3>⚠️ Delete Complaint</h3></div>
            <div className="card-body">
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Are you sure you want to delete this complaint? This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {verifyMsg && (
        <div className={`alert ${issue.status === 'closed' ? 'alert-success' : (issue.status === 'reopened' ? 'alert-warning' : 'alert-error')}`} 
           style={{ marginBottom: '1.5rem' }}>
          {verifyMsg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>{issue.title}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={issue.status} />
            <SeverityBadge severity={issue.severity} />
            <PriorityBadge priority={issue.priority} />
            {(issue.category || issue.issue_type?.name) && (
              <span className="badge" style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {issue.category || issue.issue_type?.name}
                {!issue.issue_type_id && issue.category && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 900, opacity: 0.8 }}>AI</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
        <button className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline</button>
        <button className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}>Media</button>
        {issue.status === 'resolved' && (
          <button className={`tab-btn ${activeTab === 'verify' ? 'active' : ''}`} onClick={() => setActiveTab('verify')}>✅ Verify</button>
        )}
      </div>

      {activeTab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-body">
                <h4 style={{ marginBottom: '0.5rem' }}>Description</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{issue.description}</p>
              </div>
            </div>

            {issue.resolution_notes && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h3>📝 Resolution Notes</h3></div>
                <div className="card-body">
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{issue.resolution_notes}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-body">
                <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  <strong>Category:</strong> {issue.category || issue.issue_type?.name || '—'}
                  {!issue.issue_type_id && issue.category && (
                    <span style={{
                      marginLeft: '0.35rem',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '3px',
                      background: 'rgba(51,129,255,0.15)',
                      color: 'var(--primary-500)',
                    }}>AI</span>
                  )}
                </div>

                <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  <strong>Context:</strong> {issue.context || '—'}
                </div>
                <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  <strong>Reopened:</strong> {issue.reopen_count} time(s)
                </div>
                {issue.officer_name && (
                  <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                    <strong>👤 Assigned Officer:</strong> {issue.officer_name}
                  </div>
                )}
                <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  <strong>Reported:</strong> {new Date(issue.created_at).toLocaleDateString('en-IN')}
                </div>
                {issue.resolved_at && (
                  <div style={{ fontSize: '0.82rem' }}>
                    <strong>Resolved:</strong> {new Date(issue.resolved_at).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>📍 Location</h3></div>
              <div className="card-body" style={{ padding: '0.5rem' }}>
                <MapView lat={issue.latitude} lng={issue.longitude} />
                {issue.address && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem' }}>{issue.address}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card">
          <div className="card-body">
            <Timeline items={issue.status_history || []} />
          </div>
        </div>
      )}

      {activeTab === 'media' && (
        <div>
          {beforeImages.length > 0 || afterImages.length > 0 ? (
            <div className="before-after">
              <div className="before-after-panel">
                <div className="before-after-label before">Before</div>
                {beforeImages.length > 0 ? (
                  beforeImages.map(m => <img key={m.id} src={m.url} alt="Before" />)
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No before images</div>
                )}
              </div>
              <div className="before-after-panel">
                <div className="before-after-label after">After</div>
                {afterImages.length > 0 ? (
                  afterImages.map(m => <img key={m.id} src={m.url} alt="After" />)
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No after images yet</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-icon">📷</div><h3>No media uploaded</h3></div>
          )}
        </div>
      )}

      {activeTab === 'verify' && issue.status === 'resolved' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div className="card-header"><h3>Verify Resolution</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Is the issue resolved satisfactorily?</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className={`btn ${verifyForm.approved ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => setVerifyForm(f => ({ ...f, approved: true }))}>👍 Yes</button>
                <button className={`btn ${!verifyForm.approved ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setVerifyForm(f => ({ ...f, approved: false }))}>👎 No</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rating (1-5)</label>
              <div className="rating-stars">
                {[1,2,3,4,5].map(star => (
                  <button key={star} className={`rating-star ${verifyForm.rating >= star ? 'filled' : ''}`}
                    onClick={() => setVerifyForm(f => ({ ...f, rating: star }))}>★</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Feedback (optional)</label>
              <textarea className="form-textarea" rows={3} placeholder="Share your experience..."
                value={verifyForm.feedback} onChange={e => setVerifyForm(f => ({ ...f, feedback: e.target.value }))} />
            </div>

            {!verifyForm.approved && (
              <div className="form-group">
                <label className="form-label">Rejection Reason</label>
                <textarea className="form-textarea" rows={2} placeholder="Why is the resolution not satisfactory?"
                  value={verifyForm.rejection_reason} onChange={e => setVerifyForm(f => ({ ...f, rejection_reason: e.target.value }))} />
              </div>
            )}

            <button className="btn btn-primary" onClick={handleVerify} disabled={verifying}>
              {verifying ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
