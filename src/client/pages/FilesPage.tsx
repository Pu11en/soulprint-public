import { useState, useEffect, useCallback, useRef } from 'react';
import './FilesPage.css';

interface FileItem {
  name: string;
  size: number;
  uploaded: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      setError(null);
      const session = JSON.parse(localStorage.getItem('soulprint-chat-session') || '{}');
      const res = await fetch('/api/files', {
        headers: { Authorization: `Email ${session.email}` }
      });
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const session = JSON.parse(localStorage.getItem('soulprint-chat-session') || '{}');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { Authorization: `Email ${session.email}` },
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const session = JSON.parse(localStorage.getItem('soulprint-chat-session') || '{}');
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Email ${session.email}` }
      });
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="files-page">
        <div className="files-loading">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="files-page">
      <div className="files-header">
        <h1>Files</h1>
        <label className="upload-btn">
          {uploading ? 'Uploading...' : 'Upload File'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {error && <div className="files-error">{error}</div>}

      {files.length === 0 ? (
        <div className="files-empty">
          <p>No files yet</p>
          <p className="files-empty-hint">Upload files to share with your AI</p>
        </div>
      ) : (
        <div className="files-list">
          {files.map((file) => (
            <div key={file.name} className="file-item">
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-meta">
                  {formatSize(file.size)} • {formatDate(file.uploaded)}
                </span>
              </div>
              <button
                className="file-download-btn"
                onClick={() => handleDownload(file.name)}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
