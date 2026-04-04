import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { issuesAPI, referenceAPI } from '../../api/client';
import MapPicker from '../../components/MapPicker';
import ImageUpload from '../../components/ImageUpload';

export default function SubmitIssue() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    department_id: '',
    issue_type_id: '',
    context: '',
    address: '',
  });
  const [location, setLocation] = useState(null);
  const [files, setFiles] = useState([]);

  // Reference data for cascading dropdowns
  const [deptGroups, setDeptGroups] = useState([]);
  const [filteredIssueTypes, setFilteredIssueTypes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    referenceAPI.categories()
      .then(r => setDeptGroups(r.data))
      .catch(() => {});
  }, []);

  const handleDeptChange = (deptId) => {
    const group = deptGroups.find(g => g.department_id === deptId);
    setFilteredIssueTypes(group ? group.issue_types : []);
    setForm(f => ({ ...f, department_id: deptId, issue_type_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }

    setLoading(true);
    setAiProcessing(true);

    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      if (form.issue_type_id) formData.append('issue_type_id', form.issue_type_id);
      if (form.context) formData.append('context', form.context);
      if (form.address) formData.append('address', form.address);
      if (location) {
        formData.append('latitude', location.lat);
        formData.append('longitude', location.lng);
      }
      files.forEach(f => formData.append('images', f));

      const res = await issuesAPI.create(formData);
      setAiProcessing(false);
      setSuccess('Issue submitted successfully! AI has classified and assigned your report.');
      setTimeout(() => navigate(`/dashboard/issues/${res.data.id}`), 1800);
    } catch (err) {
      setAiProcessing(false);
      setError(err.response?.data?.detail || 'Failed to submit issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isAiMode = !form.issue_type_id;

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Report an Issue</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Describe the problem and our AI will intelligently classify, prioritize, and route it to the right department.
      </p>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* AI Processing Overlay */}
      {aiProcessing && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, rgba(51,129,255,0.12), rgba(7,196,174,0.1))',
          border: '1px solid rgba(51,129,255,0.3)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'pulse 1.5s infinite',
        }}>
          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-500)' }}>
              🤖 AI is analyzing your issue...
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Processing text{files.length > 0 ? ', image' : ''}{location ? ', location' : ''} — classifying and routing to the right department
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Issue Details ─────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Issue Details</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                id="issue-title"
                type="text"
                className="form-input"
                placeholder="Brief summary of the issue"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                id="issue-description"
                className="form-textarea"
                placeholder="Describe the problem in detail — what, where, and how long it has been happening..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
                rows={4}
              />
            </div>

            {/* ── AI Classification Mode Toggle ─────────────────────── */}
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              marginBottom: '1rem',
              border: `1px solid ${isAiMode ? 'rgba(51,129,255,0.35)' : 'rgba(7,196,174,0.35)'}`,
              background: isAiMode
                ? 'rgba(51,129,255,0.07)'
                : 'rgba(7,196,174,0.07)',
              fontSize: '0.83rem',
            }}>
              {isAiMode ? (
                <span style={{ color: 'var(--primary-600, #1d4ed8)' }}>
                  🤖 <strong>AI Auto-Classification Mode</strong> — Gemini will dynamically generate a specific issue type, assign the department, and set severity based on your description{files.length > 0 ? ', image' : ''}{location ? ', and location' : ''}.
                </span>
              ) : (
                <span style={{ color: '#0d9488' }}>
                  ✅ <strong>Manual Classification</strong> — You have selected an issue type. AI will still assess severity and priority.
                </span>
              )}
            </div>

            {/* ── Two-level Dropdowns ──────────────────────────────────── */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>(optional)</span></label>
                <select
                  id="issue-department"
                  className="form-select"
                  value={form.department_id}
                  onChange={e => handleDeptChange(e.target.value)}
                >
                  <option value="">Auto-detect (AI)</option>
                  {deptGroups.map(g => (
                    <option key={g.department_id} value={g.department_id}>
                      {g.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Issue Type <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>(optional)</span></label>
                <select
                  id="issue-type"
                  className="form-select"
                  value={form.issue_type_id}
                  onChange={e => setForm(f => ({ ...f, issue_type_id: e.target.value }))}
                  disabled={!form.department_id}
                >
                  <option value="">
                    {form.department_id ? 'AI will generate specific type' : 'Select department first'}
                  </option>
                  {filteredIssueTypes.map(it => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Area Type <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>(auto-detected from GPS)</span></label>
                <select
                  className="form-select"
                  value={form.context}
                  onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                >
                  <option value="">Auto-detect from location</option>
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Address <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>(auto-filled from map)</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Street address or landmark"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Location ─────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>📍 Location</h3>
            {location && (
              <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ GPS coordinates captured — AI will use location context
              </span>
            )}
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Pin the issue location for accurate geolocation and area-type detection (urban/rural).
            </p>
            <MapPicker onLocationChange={setLocation} />
          </div>
        </div>

        {/* ── Photos ───────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>📷 Photos</h3>
            {files.length > 0 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ {files.length} photo{files.length > 1 ? 's' : ''} — AI will analyze for visual severity
              </span>
            )}
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Photos help AI analyze visual severity and refine the issue classification.
            </p>
            <ImageUpload onFilesChange={setFiles} maxFiles={5} />
          </div>
        </div>

        {/* ── AI Input Summary ─────────────────────────────────────────── */}
        {(location || files.length > 0) && !form.issue_type_id && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            background: 'rgba(51,129,255,0.06)',
            border: '1px solid rgba(51,129,255,0.2)',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}>
            🤖 <strong style={{ color: 'var(--foreground)' }}>AI will analyze:</strong>{' '}
            Text description
            {files.length > 0 && <> + <strong>visual image</strong></>}
            {location && <> + <strong>GPS coordinates</strong> (auto-geocoded to urban/rural)</>}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard')}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            id="submit-issue"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Analyzing & Submitting...
              </span>
            ) : '🚀 Submit Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}
