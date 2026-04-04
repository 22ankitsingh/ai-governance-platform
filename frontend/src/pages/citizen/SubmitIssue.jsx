import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { issuesAPI, referenceAPI } from '../../api/client';
import MapPicker from '../../components/MapPicker';
import ImageUpload from '../../components/ImageUpload';

export default function SubmitIssue() {
  const [form, setForm] = useState({
    title: '', description: '', category: '',
    context: 'urban', address: '',
  });
  const [location, setLocation] = useState(null);
  const [files, setFiles] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    referenceAPI.categories().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const update = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (field === 'category') {
      const cat = categories.find(c => c.category === value);
      setForm(f => ({ ...f, category: value }));
    }
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
      if (form.category) formData.append('category', form.category);

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
        Help improve your community by reporting civic issues
      </p>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>Issue Details</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input id="issue-title" type="text" className="form-input" placeholder="Brief summary of the issue"
                value={form.title} onChange={e => update('title', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea id="issue-description" className="form-textarea" placeholder="Describe the issue in detail..."
                value={form.description} onChange={e => update('description', e.target.value)} required rows={4} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select id="issue-category" className="form-select" value={form.category} onChange={e => update('category', e.target.value)}>
                  <option value="">Auto-detect (AI)</option>
                  {categories.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
                <div className="form-hint">Leave empty for AI auto-classification</div>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Area Context</label>
                <select className="form-select" value={form.context} onChange={e => update('context', e.target.value)}>
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Address (optional)</label>
                <input type="text" className="form-input" placeholder="Street address or landmark"
                  value={form.address} onChange={e => update('address', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>📍 Location</h3></div>
          <div className="card-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Click on the map to pin the issue location
            </p>
            <MapPicker onLocationChange={setLocation} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h3>📷 Photos</h3></div>
          <div className="card-body">
            <ImageUpload onFilesChange={setFiles} maxFiles={5} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button id="submit-issue" type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Submitting...' : '🚀 Submit Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}
