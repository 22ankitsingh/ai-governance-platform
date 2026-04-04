import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { issuesAPI, referenceAPI } from '../../api/client';
import MapPicker from '../../components/MapPicker';
import ImageUpload from '../../components/ImageUpload';

export default function SubmitIssue() {
  const [form, setForm] = useState({
    title: '', description: '',
    department_id: '',    // step 1: choose department
    issue_type_id: '',    // step 2: choose issue type (filtered by department)
    context: 'urban', address: '',
  });
  const [location, setLocation] = useState(null);
  const [files, setFiles] = useState([]);

  // Reference data
  const [deptGroups, setDeptGroups] = useState([]);  // [{department_id, department_name, issue_types:[{id,name}]}]
  const [filteredIssueTypes, setFilteredIssueTypes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    referenceAPI.categories()
      .then(r => setDeptGroups(r.data))
      .catch(() => {});
  }, []);

  // When department changes, update filtered issue types
  const handleDeptChange = (deptId) => {
    const group = deptGroups.find(g => g.department_id === deptId);
    setFilteredIssueTypes(group ? group.issue_types : []);
    setForm(f => ({ ...f, department_id: deptId, issue_type_id: '' }));
  };

  const handleIssueTypeChange = (itId) => {
    setForm(f => ({ ...f, issue_type_id: itId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }

    setLoading(true);
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
      setSuccess('Issue submitted successfully! AI is processing your report...');
      setTimeout(() => navigate(`/dashboard/issues/${res.data.id}`), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Report an Issue</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Help improve your community by reporting civic issues. Select the department and issue type, or leave both empty for AI auto-classification.
      </p>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* ── Issue Details Card ─────────────────────────────────────────── */}
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
                placeholder="Describe the issue in detail — what, where, and how long it has been happening..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
                rows={4}
              />
            </div>

            {/* ── Two-level Department → Issue Type selection ─────────── */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
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
                <div className="form-hint">Select the responsible department</div>
              </div>

              <div className="form-group">
                <label className="form-label">Issue Type</label>
                <select
                  id="issue-type"
                  className="form-select"
                  value={form.issue_type_id}
                  onChange={e => handleIssueTypeChange(e.target.value)}
                  disabled={!form.department_id}
                >
                  <option value="">
                    {form.department_id ? 'Select issue type...' : 'Select department first'}
                  </option>
                  {filteredIssueTypes.map(it => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
                <div className="form-hint">
                  {form.department_id
                    ? 'Select the specific issue type'
                    : 'Leave empty for AI auto-classification'}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Area Context</label>
                <select
                  className="form-select"
                  value={form.context}
                  onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                >
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Address (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Street address or landmark"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>

            {/* AI hint */}
            {!form.issue_type_id && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--primary-50, rgba(51,129,255,0.08))',
                border: '1px solid var(--primary-200, rgba(51,129,255,0.25))',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: 'var(--primary-600, #1d4ed8)',
              }}>
                🤖 <strong>AI will auto-classify</strong> this issue if no issue type is selected
              </div>
            )}
          </div>
        </div>

        {/* ── Location Card ───────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>📍 Location</h3></div>
          <div className="card-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Click on the map to pin the issue location
            </p>
            <MapPicker onLocationChange={setLocation} />
          </div>
        </div>

        {/* ── Photos Card ─────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>📷 Photos</h3></div>
          <div className="card-body">
            <ImageUpload onFilesChange={setFiles} maxFiles={5} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button
            id="submit-issue"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? 'Submitting...' : '🚀 Submit Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}
