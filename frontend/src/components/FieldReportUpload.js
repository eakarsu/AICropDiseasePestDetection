// frontend/src/components/FieldReportUpload.js
// Drag-and-drop bulk uploader for JPG/PNG field images.
// POSTs multipart to /custom-views/upload-field-reports, shows previews + per-file detections.

import React, { useCallback, useRef, useState } from 'react';
import api from '../api';

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png'];

function isImage(file) {
  return ACCEPTED.includes((file.type || '').toLowerCase()) || /\.(jpe?g|png)$/i.test(file.name || '');
}

const SEV_COLOR = {
  high: '#dc2626',
  medium: '#f59e0b',
  low: '#16a34a',
};

export default function FieldReportUpload() {
  const [files, setFiles] = useState([]); // {file, previewUrl}
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // {uploaded, failed, mock_detections}
  const inputRef = useRef(null);

  const addFiles = useCallback((incoming) => {
    const accepted = [];
    incoming.forEach((f) => {
      if (isImage(f)) accepted.push({ file: f, previewUrl: URL.createObjectURL(f) });
    });
    setFiles((prev) => [...prev, ...accepted]);
    setResult(null);
    setError(null);
  }, []);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    addFiles(dropped);
  }

  function onPick(e) {
    const picked = Array.from(e.target.files || []);
    addFiles(picked);
    e.target.value = '';
  }

  function removeAt(idx) {
    setFiles((prev) => {
      const next = [...prev];
      try { URL.revokeObjectURL(next[idx]?.previewUrl); } catch (_) {}
      next.splice(idx, 1);
      return next;
    });
  }

  function clearAll() {
    files.forEach((f) => {
      try { URL.revokeObjectURL(f.previewUrl); } catch (_) {}
    });
    setFiles([]);
    setResult(null);
    setError(null);
  }

  async function upload() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      files.forEach(({ file }) => fd.append('images', file, file.name));
      fd.append('declared_count', String(files.length));
      const res = await api.post('/custom-views/upload-field-reports', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #d1fae5',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 2px 6px rgba(20,83,45,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#14532d', fontSize: 18 }}>Field Report Bulk Upload</h2>
          <div style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>
            Drop multiple field photos (JPG/PNG). Each image gets a mock pest/disease detection.
          </div>
        </div>
        <span
          style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Multi-upload
        </span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        style={{
          border: `2px dashed ${dragOver ? '#16a34a' : '#a7f3d0'}`,
          background: dragOver ? '#ecfdf5' : '#f8fafc',
          borderRadius: 10,
          padding: 28,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'background 120ms',
        }}
      >
        <div style={{ color: '#14532d', fontWeight: 600, fontSize: 15 }}>
          {dragOver ? 'Drop images to add' : 'Drag & drop JPG/PNG images here'}
        </div>
        <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
          or click to browse · up to 25 files · 15 MB each
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png"
          style={{ display: 'none' }}
          onChange={onPick}
        />
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={upload}
          disabled={busy || files.length === 0}
          style={{
            background: busy || files.length === 0 ? '#bbf7d0' : '#16a34a',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: busy || files.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Uploading…' : `Upload ${files.length} image${files.length === 1 ? '' : 's'}`}
        </button>
        {files.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={busy}
            style={{
              background: '#fff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '10px 14px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Clear
          </button>
        )}
        {result && (
          <span style={{ color: '#065f46', fontSize: 13 }}>
            Server: <strong>{result.uploaded}</strong> uploaded, <strong>{result.failed}</strong> failed.
          </span>
        )}
        {error && <span style={{ color: '#b91c1c', fontSize: 13 }}>Error: {error}</span>}
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>Preview ({files.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {files.map((f, idx) => {
              const det = result?.mock_detections?.[idx];
              return (
                <div
                  key={`${f.file.name}-${idx}`}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 8,
                    position: 'relative',
                  }}
                >
                  <img
                    src={f.previewUrl}
                    alt={f.file.name}
                    style={{
                      width: '100%',
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#e2e8f0',
                    }}
                  />
                  <div
                    title={f.file.name}
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: '#475569',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {f.file.name}
                  </div>
                  {det ? (
                    <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.35 }}>
                      <div>
                        <span style={{
                          display: 'inline-block',
                          width: 8, height: 8, borderRadius: '50%',
                          background: SEV_COLOR[det.severity] || '#94a3b8',
                          marginRight: 6,
                        }} />
                        <strong style={{ color: '#0f172a' }}>{det.detected_pest}</strong>
                      </div>
                      <div style={{ color: '#475569' }}>
                        {det.likely_crop} · {det.severity} · {Math.round((det.confidence || 0) * 100)}%
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                      Pending upload…
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAt(idx); }}
                    disabled={busy}
                    style={{
                      position: 'absolute',
                      top: 4, right: 4,
                      background: 'rgba(15,23,42,0.7)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result?.mock_detections?.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12.5, color: '#065f46' }}>
          Stored {result.uploaded} file(s) on the server. Review per-image actions in each card above.
        </div>
      )}
    </div>
  );
}
