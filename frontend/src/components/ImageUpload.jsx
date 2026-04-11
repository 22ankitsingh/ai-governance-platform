import { useState, useRef } from 'react';
import { Upload, X, Image } from 'lucide-react';

export default function ImageUpload({ onFilesChange, maxFiles = 5 }) {
  const [previews, setPreviews] = useState([]);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (newFiles) => {
    const fileArr = Array.from(newFiles).slice(0, maxFiles - files.length);
    const updated = [...files, ...fileArr];
    setFiles(updated);
    onFilesChange(updated);

    fileArr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, { url: e.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    setPreviews(updatedPreviews);
    onFilesChange(updatedFiles);
  };

  return (
    <div>
      <div
        className={`upload-area ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={24} />
          </div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0' }}>Click or drag images here</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Upload up to {maxFiles} images · JPG, PNG, WebP
          </p>
        </div>
      </div>

      {previews.length > 0 && (
        <div className="upload-preview">
          {previews.map((p, i) => (
            <div key={i} className="upload-preview-item">
              <img src={p.url} alt={p.name} />
              <button className="upload-preview-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
