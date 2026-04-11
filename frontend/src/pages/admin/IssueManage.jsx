import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI, referenceAPI } from '../../api/client';
import StatusBadge, { SeverityBadge, PriorityBadge, ConfidenceMeter } from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';
import { MapView } from '../../components/MapPicker';
import { ArrowLeft, User, CheckCircle2, Lock, Clock, Save, Brain, ThumbsUp, ThumbsDown, Camera, AlertTriangle, Settings2, FileText, Image, MapPin } from 'lucide-react';

const SEVERITIES = ['low','medium','high','critical'];

export default function IssueManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [deptGroups, setDeptGroups] = useState([]);
  const [filteredIssueTypes, setFilteredIssueTypes] = useState([]);
  const [updateForm, setUpdateForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('manage');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [officerName, setOfficerName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    Promise.all([
      adminAPI.getIssue(id),
      adminAPI.listDepartments(),
      referenceAPI.categories(),
    ]).then(([issueRes, deptRes, catRes]) => {
      const i = issueRes.data;
      setIssue(i);
      setDepartments(deptRes.data);
      setDeptGroups(catRes.data);
      if (i.department_id) {
        const group = catRes.data.find(g => g.department_id === i.department_id);
        setFilteredIssueTypes(group ? group.issue_types : []);
      }
      setUpdateForm({
        issue_type_id: i.issue_type_id || '', severity: i.severity, priority: i.priority,
        department_id: i.department_id || '', resolution_notes: i.resolution_notes || '', notes: '',
      });
    }).catch(() => navigate('/admin/triage'))
    .finally(() => setLoading(false));
  }, [id]);

  const handleDeptChange = (deptId) => {
    const group = deptGroups.find(g => g.department_id === deptId);
    setFilteredIssueTypes(group ? group.issue_types : []);
    setUpdateForm(f => ({ ...f, department_id: deptId, issue_type_id: '' }));
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try { const res = await adminAPI.updateIssue(id, updateForm); setIssue(res.data); setMsg('Issue updated successfully'); }
    catch (err) { setMsg(err.response?.data?.detail || 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleAssignOfficer = async () => {
    if (!officerName.trim()) return;
    setAssigning(true); setMsg('');
    try { const res = await adminAPI.assignOfficer(id, { officer_name: officerName.trim() }); setIssue(res.data); setOfficerName(''); setMsg(`Officer "${officerName.trim()}" assigned. Status → In Progress`); }
    catch (err) { setMsg(err.response?.data?.detail || 'Assignment failed'); }
    finally { setAssigning(false); }
  };

  const handleResolve = async () => {
    if (!resolveNotes.trim()) { setMsg('Resolution notes are required'); return; }
    setResolving(true); setMsg('');
    try { const res = await adminAPI.resolveIssue(id, { resolution_notes: resolveNotes.trim() }); setIssue(res.data); setResolveNotes(''); setMsg('Issue marked as resolved. Citizen will be notified.'); }
    catch (err) { setMsg(err.response?.data?.detail || 'Resolve failed'); }
    finally { setResolving(false); }
  };

  const handleAfterImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const fd = new FormData(); fd.append('file', file); await adminAPI.uploadAfterImage(id, fd); const r = await adminAPI.getIssue(id); setIssue(r.data); setMsg('After-resolution image uploaded'); }
    catch (err) { setMsg('Image upload failed'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!issue) return null;

  const beforeImages = issue.media?.filter(m => m.upload_phase === 'before') || [];
  const afterImages = issue.media?.filter(m => m.upload_phase === 'after') || [];
  const latestPrediction = issue.ai_predictions?.[issue.ai_predictions.length - 1];
  const isClosed = issue.status === 'closed';
  const canAssign = issue.status === 'not_assigned' || issue.status === 'reopened';
  const canResolve = issue.status === 'in_progress';

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/triage')} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={16} /> Back to Queue
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.35rem', marginBottom: '8px' }}>{issue.title}</h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={issue.status} />
            <SeverityBadge severity={issue.severity} />
            <PriorityBadge priority={issue.priority} />
            {issue.reopen_count > 0 && <span className="badge badge-reopened">Reopened ×{issue.reopen_count}</span>}
          </div>
          {issue.reporter && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Reported by <strong>{issue.reporter.full_name}</strong> ({issue.reporter.email})
            </p>
          )}
          {issue.officer_name && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <User size={14} /> Assigned Officer: <strong>{issue.officer_name}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}><Settings2 size={15} /> Management</button>
        <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}><Brain size={15} /> AI Analysis</button>
        <button className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}><Clock size={15} /> Timeline</button>
        <button className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}><Image size={15} /> Media</button>
      </div>

      {msg && <div className={`alert ${msg.includes('fail') || msg.includes('required') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      {activeTab === 'manage' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-header"><h3>Issue Details</h3></div>
            <div className="card-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.7 }}>{issue.description}</p>
              <div className="grid-2col" style={{ gap: '8px 16px', fontSize: '0.82rem' }}>
                <div><strong>Issue Type:</strong> {issue.category || issue.issue_type?.name || '—'}
                  {!issue.issue_type_id && issue.category && (
                    <span style={{ marginLeft: '6px', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(93,159,150,0.12)', color: 'var(--primary)' }}>AI</span>
                  )}
                </div>
                <div><strong>Department:</strong> {issue.department?.name || '—'}</div>
                <div><strong>Area Type:</strong> {issue.context || '—'}</div>
                <div><strong>Address:</strong> {issue.address || '—'}</div>
                <div><strong>Officer:</strong> {issue.officer_name || '—'}</div>
                <div><strong>Reopened:</strong> {issue.reopen_count} time(s)</div>
              </div>
              {(issue.latitude && issue.longitude) && (
                <div style={{ marginTop: '16px' }}><MapView lat={issue.latitude} lng={issue.longitude} /></div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {canAssign && !isClosed && (
              <div className="card">
                <div className="card-header"><h3><User size={16} /> Assign Officer</h3></div>
                <div className="card-body">
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Enter the officer's name. Status will change to <strong>In Progress</strong>.
                  </p>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Officer Name</label>
                    <input className="form-input" value={officerName} onChange={e => setOfficerName(e.target.value)} placeholder="Enter officer name..." />
                  </div>
                  <button className="btn btn-primary" onClick={handleAssignOfficer} disabled={assigning || !officerName.trim()}>
                    <CheckCircle2 size={16} /> {assigning ? 'Assigning...' : 'Assign Officer'}
                  </button>
                </div>
              </div>
            )}

            {canResolve && !isClosed && (
              <div className="card">
                <div className="card-header"><h3><CheckCircle2 size={16} /> Resolve Issue</h3></div>
                <div className="card-body">
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Mark this issue as resolved. The citizen will be notified to verify.
                  </p>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Resolution Notes *</label>
                    <textarea className="form-textarea" rows={3} value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Describe how the issue was resolved..." />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-success" onClick={handleResolve} disabled={resolving || !resolveNotes.trim()}>
                      <CheckCircle2 size={16} /> {resolving ? 'Resolving...' : 'Mark Resolved'}
                    </button>
                    <div>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAfterImage} />
                      <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <Camera size={16} /> {uploading ? 'Uploading...' : 'After Image'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isClosed && (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--gray-500)' }}>
                    <Lock size={24} />
                  </div>
                  <h3 style={{ marginBottom: '8px' }}>Issue Closed</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Verified and closed by the citizen. No further actions allowed.</p>
                </div>
              </div>
            )}

            {issue.status === 'resolved' && (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '999px', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--warning)' }}>
                    <Clock size={24} />
                  </div>
                  <h3 style={{ marginBottom: '8px' }}>Awaiting Citizen Verification</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Resolved and waiting for citizen to verify the resolution.</p>
                </div>
              </div>
            )}

            {!isClosed && (
              <div className="card">
                <div className="card-header"><h3>Update Issue Details</h3></div>
                <div className="card-body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Severity</label>
                      <select className="form-select" value={updateForm.severity} onChange={e => setUpdateForm(f => ({ ...f, severity: e.target.value }))}>
                        {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select className="form-select" value={updateForm.priority} onChange={e => setUpdateForm(f => ({ ...f, priority: parseInt(e.target.value) }))}>
                        {[1,2,3,4,5].map(p => <option key={p} value={p}>P{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-select" value={updateForm.department_id} onChange={e => handleDeptChange(e.target.value)}>
                      <option value="">— Select Department —</option>
                      {deptGroups.map(g => <option key={g.department_id} value={g.department_id}>{g.department_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Issue Type {updateForm.department_id ? '' : '(select department first)'}</label>
                    <select className="form-select" value={updateForm.issue_type_id} onChange={e => setUpdateForm(f => ({ ...f, issue_type_id: e.target.value }))} disabled={!updateForm.department_id}>
                      <option value="">— Select Issue Type —</option>
                      {filteredIssueTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                    <div className="form-hint">Issue type auto-assigns the department</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Update Note (audit log)</label>
                    <input className="form-input" value={updateForm.notes} placeholder="Brief note about this change" onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="card">
          <div className="card-header"><h3><Brain size={16} /> AI Predictions</h3></div>
          <div className="card-body">
            {latestPrediction ? (
              <div>
                <div className="grid-3col" style={{ marginBottom: '16px' }}>
                  <div><strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Issue Type</strong><div>{latestPrediction.predicted_category || '—'}</div></div>
                  <div><strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Department</strong><div>{latestPrediction.predicted_department || '—'}</div></div>
                  <div><strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Severity</strong><div><SeverityBadge severity={latestPrediction.predicted_severity} /></div></div>
                  <div><strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Priority</strong><div>P{latestPrediction.predicted_priority}</div></div>
                  <div><strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Model</strong><div>{latestPrediction.model_version}</div></div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Confidence</strong>
                  <div style={{ marginTop: '4px' }}><ConfidenceMeter value={latestPrediction.confidence} /></div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Reasoning</strong>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '4px' }}>{latestPrediction.reasoning}</p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '8px' }}>
                  <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '12px' }}>
                    Was this AI classification correct?
                  </strong>
                  {issue.is_ai_correct !== null && issue.is_ai_correct !== undefined && (
                    <div style={{
                      marginBottom: '12px', padding: '8px 12px', borderRadius: '8px',
                      background: issue.is_ai_correct ? 'rgba(18,183,106,0.08)' : 'rgba(240,68,56,0.08)',
                      color: issue.is_ai_correct ? 'var(--success)' : 'var(--danger)',
                      fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      {issue.is_ai_correct ? <><CheckCircle2 size={16} /> Marked as Correct</> : <><AlertTriangle size={16} /> Marked as Incorrect</>}
                      <span style={{ fontWeight: 400, marginLeft: '8px', opacity: 0.7 }}>— click below to change</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className={`btn btn-sm ${issue.is_ai_correct === true ? 'btn-success' : 'btn-secondary'}`}
                      onClick={async () => { try { const res = await adminAPI.aiFeedback(id, true); setIssue(res.data); setMsg('AI marked as Correct.'); } catch (err) { setMsg(err.response?.data?.detail || 'Failed'); } }}>
                      <ThumbsUp size={14} /> AI Was Correct
                    </button>
                    <button className={`btn btn-sm ${issue.is_ai_correct === false ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={async () => { try { const res = await adminAPI.aiFeedback(id, false); setIssue(res.data); setMsg('AI marked as Incorrect.'); } catch (err) { setMsg(err.response?.data?.detail || 'Failed'); } }}>
                      <ThumbsDown size={14} /> AI Was Wrong
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Your feedback updates the AI Accuracy metric in the Analytics Dashboard.</p>
                </div>

                {latestPrediction.confidence < 0.6 && (
                  <div className="alert alert-warning" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} /> Low confidence prediction. Manual review recommended.
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state"><p>No AI predictions available</p></div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-header"><h3>Status History</h3></div>
            <div className="card-body"><Timeline items={issue.status_history || []} /></div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Assignment History</h3></div>
            <div className="card-body">
              {issue.assignment_history?.length > 0 ? (
                issue.assignment_history.map((a, i) => (
                  <div key={a.id} style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: i < issue.assignment_history.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} /> {a.officer_name || `Dept: ${departments.find(d => d.id === a.department_id)?.name || a.department_id || '—'}`}
                    </div>
                    {a.officer_name && a.department_id && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Dept: {departments.find(d => d.id === a.department_id)?.name || a.department_id}
                      </div>
                    )}
                    {a.notes && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{a.notes}</p>}
                    <time style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleString('en-IN')}</time>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No assignment history yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'media' && (
        <div>
          <div className="before-after">
            <div className="before-after-panel">
              <div className="before-after-label before">Before</div>
              {beforeImages.length > 0 ? beforeImages.map(m => <img key={m.id} src={m.url} alt="Before" />) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No before images</div>
              )}
            </div>
            <div className="before-after-panel">
              <div className="before-after-label after">After</div>
              {afterImages.length > 0 ? afterImages.map(m => <img key={m.id} src={m.url} alt="After" />) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No after images yet
                  {!isClosed && (
                    <div style={{ marginTop: '8px' }}>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAfterImage} />
                      <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Upload After Image</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {issue.verification_votes?.length > 0 && (
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header"><h3>Citizen Verification</h3></div>
              <div className="card-body">
                {issue.verification_votes.map(v => (
                  <div key={v.id} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`badge ${v.approved ? 'badge-resolved' : 'badge-reopened'}`}>
                        {v.approved ? <><CheckCircle2 size={12} /> Approved</> : <><AlertTriangle size={12} /> Rejected</>}
                      </span>
                      {v.rating && <span style={{ color: 'var(--accent)' }}>{'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}</span>}
                    </div>
                    {v.feedback && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{v.feedback}</p>}
                    {v.rejection_reason && <p style={{ fontSize: '0.82rem', color: 'var(--danger)', marginTop: '4px' }}>Reason: {v.rejection_reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
