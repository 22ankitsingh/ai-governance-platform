import { useState, useEffect, useRef } from 'react';
import { officerAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge } from '../../components/StatusBadge';
import { MapView } from '../../components/MapPicker';
import {
  CheckCircle2, Camera, Clock, MapPin, User, FileText, Image
} from 'lucide-react';

export default function CurrentIssue() {
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const loadIssue = () => {
    setLoading(true);
    officerAPI.currentIssue()
      .then(res => setIssue(res.data))
      .catch(() => setIssue(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadIssue(); }, []);

  const handleResolve = async () => {
    if (!resolveNotes.trim()) { setMsg('Resolution notes are required'); return; }
    setResolving(true); setMsg('');
    try {
      await officerAPI.resolveIssue(issue.id, { resolution_notes: resolveNotes.trim() });
      setMsg('Issue marked as resolved! The citizen will be notified to verify.');
      setResolveNotes('');
      // Reload — should now be null
      setTimeout(loadIssue, 1500);
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Resolve failed');
    } finally {
      setResolving(false);
    }
  };

  const handleAfterImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await officerAPI.uploadAfterImage(issue.id, fd);
      loadIssue();
      setMsg('After-resolution image uploaded');
    } catch (err) {
      setMsg('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  if (!issue) {
    return (
      <div>
        <h1 style={{ fontSize: '1.35rem', marginBottom: '16px' }}>Current Issue</h1>
        {msg && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{msg}</div>}
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--gray-400)' }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>No Active Issue</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              You don't have any issues assigned right now. New issues will be automatically assigned based on your department and availability.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const beforeImages = issue.media?.filter(m => m.upload_phase === 'before') || [];
  const afterImages = issue.media?.filter(m => m.upload_phase === 'after') || [];
  const latestPrediction = issue.ai_predictions?.[issue.ai_predictions.length - 1];

  return (
    <div>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '16px' }}>Current Issue</h1>

      {msg && (
        <div className={`alert ${msg.includes('fail') || msg.includes('required') ? 'alert-error' : 'alert-success'}`}>
          {msg}
        </div>
      )}

      {/* Issue Header */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>{issue.title}</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
            <StatusBadge status={issue.status} />
            <SeverityBadge severity={issue.severity} />
            <PriorityBadge priority={issue.priority} />
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            {issue.description}
          </p>

          <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 16px', fontSize: '0.82rem' }}>
            <div><strong>Category:</strong> {issue.category || issue.issue_type?.name || '—'}</div>
            <div><strong>Department:</strong> {issue.department?.name || '—'}</div>
            <div><strong>Area:</strong> {issue.context || '—'}</div>
            <div><strong>Address:</strong> {issue.address || '—'}</div>
            {issue.reporter && (
              <div><strong>Reporter:</strong> {issue.reporter.full_name}</div>
            )}
            {issue.assigned_at && (
              <div><strong>Assigned:</strong> {new Date(issue.assigned_at).toLocaleString('en-IN')}</div>
            )}
          </div>

          {issue.latitude && issue.longitude && (
            <div style={{ marginTop: '16px' }}><MapView lat={issue.latitude} lng={issue.longitude} /></div>
          )}
        </div>
      </div>

      <div className="grid-2col">
        {/* Before/After Images */}
        <div className="card">
          <div className="card-header"><h3><Image size={16} /> Evidence Images</h3></div>
          <div className="card-body">
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Before</strong>
              {beforeImages.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {beforeImages.map(m => (
                    <img key={m.id} src={m.url} alt="Before" style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No before images</p>
              )}
            </div>
            
            {/* AI Predictions for Officer */}
            {latestPrediction && (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--gray-50)', borderRadius: '8px' }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>AI Classification</strong>
                <div style={{ fontSize: '0.82rem' }}>
                   <strong>Severity:</strong> <SeverityBadge severity={latestPrediction.predicted_severity} />
                   <br/>
                   <strong>Reasoning:</strong> {latestPrediction.reasoning}
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '12px' }}>
                  <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '8px' }}>
                    Was this AI classification correct?
                  </strong>
                  {issue.is_ai_correct !== null && issue.is_ai_correct !== undefined && (
                    <div style={{
                      marginBottom: '8px', padding: '6px 10px', borderRadius: '6px',
                      background: issue.is_ai_correct ? 'rgba(18,183,106,0.08)' : 'rgba(240,68,56,0.08)',
                      color: issue.is_ai_correct ? 'var(--success)' : 'var(--danger)',
                      fontSize: '0.82rem', fontWeight: 600
                    }}>
                      {issue.is_ai_correct ? '✔ Marked as Correct' : '✖ Marked as Incorrect'}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={`btn btn-sm ${issue.is_ai_correct === true ? 'btn-success' : 'btn-secondary'}`}
                      onClick={async () => { try { await officerAPI.aiFeedback(issue.id, true); loadIssue(); setMsg('AI marked as Correct.'); } catch (err) { setMsg('Failed'); } }}>
                      AI Was Correct
                    </button>
                    <button className={`btn btn-sm ${issue.is_ai_correct === false ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={async () => { try { await officerAPI.aiFeedback(issue.id, false); loadIssue(); setMsg('AI marked as Incorrect.'); } catch (err) { setMsg('Failed'); } }}>
                      AI Was Wrong
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>After (Resolution Proof)</strong>
              {afterImages.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {afterImages.map(m => (
                    <img key={m.id} src={m.url} alt="After" style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No after images yet</p>
              )}
              <div style={{ marginTop: '12px' }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAfterImage} />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Camera size={14} /> {uploading ? 'Uploading...' : 'Upload After Image'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Resolve Form */}
        <div className="card">
          <div className="card-header"><h3><CheckCircle2 size={16} /> Mark as Resolved</h3></div>
          <div className="card-body">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Once resolved, the citizen will be notified to verify the resolution. Upload after-images as proof before resolving.
            </p>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Resolution Notes *</label>
              <textarea
                className="form-textarea"
                rows={5}
                value={resolveNotes}
                onChange={e => setResolveNotes(e.target.value)}
                placeholder="Describe what was done to resolve this issue..."
              />
            </div>
            <button
              className="btn btn-success"
              onClick={handleResolve}
              disabled={resolving || !resolveNotes.trim()}
              style={{ width: '100%' }}
            >
              <CheckCircle2 size={16} /> {resolving ? 'Resolving...' : 'Mark Issue as Resolved'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
