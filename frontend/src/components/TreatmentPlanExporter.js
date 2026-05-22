// frontend/src/components/TreatmentPlanExporter.js
// Crop + pest picker that POSTs to /custom-views/treatment-plan and downloads a PDF.

import React, { useState } from 'react';
import api from '../api';

const CROPS = ['Maize', 'Wheat', 'Rice', 'Cotton', 'Tomato', 'Potato', 'Soybean', 'Sugarcane', 'Coffee', 'Grape'];
const PESTS_DISEASES = [
  'Fall Armyworm',
  'Aphid',
  'Whitefly',
  'Stem Borer',
  'Thrips',
  'Powdery Mildew',
  'Late Blight',
  'Leaf Rust',
  'Bacterial Wilt',
  'Anthracnose',
];
const SEVERITIES = ['low', 'moderate', 'high'];

export default function TreatmentPlanExporter() {
  const [crop, setCrop] = useState(CROPS[0]);
  const [pest, setPest] = useState(PESTS_DISEASES[0]);
  const [severity, setSeverity] = useState('moderate');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastFile, setLastFile] = useState(null);

  async function generatePlan() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(
        '/custom-views/treatment-plan',
        { crop_name: crop, pest_or_disease: pest, severity, organic_only: organicOnly },
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `treatment_plan_${crop.replace(/\s+/g, '_')}_${pest.replace(/\s+/g, '_')}.pdf`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setLastFile({ filename, sizeKb: Math.round(blob.size / 1024) });
      // Don't revoke immediately so user can open from the link below
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Generation failed');
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
          <h2 style={{ margin: 0, color: '#14532d', fontSize: 18 }}>Treatment Plan PDF Exporter</h2>
          <div style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>
            Pick a crop and pest/disease, then download a printable IPM-aware treatment plan.
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
          PDF
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#334155' }}>
          Crop
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            style={selectStyle}
          >
            {CROPS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#334155' }}>
          Pest / Disease
          <select
            value={pest}
            onChange={(e) => setPest(e.target.value)}
            style={selectStyle}
          >
            {PESTS_DISEASES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#334155' }}>
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            style={selectStyle}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 13, color: '#1f2937' }}>
          <input
            type="checkbox"
            checked={organicOnly}
            onChange={(e) => setOrganicOnly(e.target.checked)}
          />
          Organic-only mode
        </label>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={generatePlan}
          disabled={busy}
          style={{
            background: busy ? '#a7f3d0' : '#16a34a',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Generating PDF…' : 'Generate Plan'}
        </button>
        {lastFile && (
          <span style={{ color: '#475569', fontSize: 13 }}>
            Downloaded: <strong>{lastFile.filename}</strong> ({lastFile.sizeKb} KB)
          </span>
        )}
        {error && (
          <span style={{ color: '#b91c1c', fontSize: 13 }}>Error: {error}</span>
        )}
      </div>

      <div style={{ marginTop: 14, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12.5, color: '#065f46' }}>
        Plans include treatment schedule (Day 0 / 3 / 7 / 14 / 21), dosing, pre-harvest intervals, safety guidance, and IPM alternatives.
      </div>
    </div>
  );
}

const selectStyle = {
  marginTop: 4,
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#fff',
  color: '#0f172a',
  fontSize: 14,
};
