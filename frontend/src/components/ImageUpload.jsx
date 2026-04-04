import { useState, useRef } from 'react';

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
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Click or drag images here</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Upload up to {maxFiles} images • JPG, PNG, WebP
        </p>
      </div>

      {previews.length > 0 && (
        <div className="upload-preview">
          {previews.map((p, i) => (
            <div key={i} className="upload-preview-item">
              <img src={p.url} alt={p.name} />
              <button className="upload-preview-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
