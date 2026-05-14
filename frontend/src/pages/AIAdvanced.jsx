import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import api from '../api';

const TOOLS = [
  { id: 'seasonal-risk',         label: 'Seasonal Risk Calendar',  desc: '12-month disease/pest heatmap by crop & region.', fields: ['crop_name', 'region'] },
  { id: 'cross-farm-benchmark',  label: 'Cross-Farm Benchmarking', desc: 'Compare your farm to anonymized peer cohort.',     fields: ['crop_name'] },
  { id: 'fertilizer-optimize',   label: 'Fertilizer Optimizer',    desc: 'Optimal nutrient blend & timing for max ROI.',     fields: ['crop_name', 'crop_stage', 'soil', 'target_yield'] },
  { id: 'weather-trigger',       label: 'Weather Trigger Alerts',  desc: 'Auto-flag pest risk windows from forecast.',       fields: ['field_name', 'region', 'forecast'] },
  { id: 'treatment-efficacy/insights', label: 'Treatment Efficacy Insights', desc: 'AI summary of treatment performance.', fields: [] },
  { id: 'supplier-match',        label: 'Supplier Marketplace Match', desc: 'Find local suppliers + bulk pricing strategy.',  fields: ['treatment_name', 'region', 'quantity'] },
  { id: 'predict-yield',         label: 'Predict Yield',           desc: 'Estimate expected yield from soil + weather context.', fields: ['crop_name', 'field_name', 'region', 'planted_at', 'soil', 'weather_summary', 'target_harvest_at'] },
  { id: 'optimize-harvest-timing', label: 'Optimize Harvest Timing', desc: 'Optimal harvest window balancing weather + market.', fields: ['crop_name', 'field_name', 'region', 'planted_at', 'current_stage', 'weather_forecast', 'market_price_outlook'] },
  { id: 'recommend-ipm-strategy', label: 'IPM Strategy',            desc: 'Integrated pest-management plan for the crop.',     fields: ['crop_name', 'region', 'observed_pests', 'observed_diseases', 'prior_treatments', 'organic_only'] },
];

export default function AIAdvanced() {
  const [tool, setTool] = useState(TOOLS[0]);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => { reloadHistory(); }, []);
  const reloadHistory = async () => {
    try {
      const r = await api.get('/ai-advanced/results', { params: { limit: 20 } });
      setHistory(r.data?.data || []);
    } catch (e) { /* ignore */ }
  };

  const submit = async () => {
    setLoading(true); setResult(null);
    try {
      const body = { ...form };
      ['soil', 'forecast', 'weather_forecast'].forEach((k) => {
        if (typeof body[k] === 'string') {
          try { body[k] = JSON.parse(body[k]); } catch { body[k] = {}; }
        }
      });
      const r = await api.post(`/ai-advanced/${tool.id}`, body);
      setResult(r.data);
      reloadHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'AI failed');
      setResult({ error: err.response?.data?.error || err.message });
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🤖 AI Advanced</h1>
          <p className="subtitle">Specialized agronomy AI tools</p>
        </div>
      </div>

      <div className="feature-grid" style={{ marginBottom: 24 }}>
        {TOOLS.map((t) => (
          <div
            key={t.id}
            className={`feature-card ${tool.id === t.id ? 'selected' : ''}`}
            onClick={() => { setTool(t); setForm({}); setResult(null); }}
            style={{ borderColor: tool.id === t.id ? '#10b981' : undefined }}
          >
            <h3 style={{ fontSize: 16 }}>{t.label}</h3>
            <p style={{ fontSize: 13 }}>{t.desc}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3>{tool.label}</h3>
        {tool.fields.length === 0 && <p style={{ color: '#666' }}>No inputs needed — runs over your stored history.</p>}
        {tool.fields.map((f) => (
          <div key={f} className="form-group" style={{ marginBottom: 12 }}>
            <label>{f}</label>
            {(f === 'soil' || f === 'forecast' || f === 'weather_forecast') ? (
              <textarea
                rows={3}
                value={typeof form[f] === 'string' ? form[f] : (form[f] ? JSON.stringify(form[f], null, 2) : '')}
                placeholder='e.g. {"ph": 6.5, "N": 40, "P": 20, "K": 30}'
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              />
            ) : (
              <input value={form[f] || ''} placeholder={f} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            )}
          </div>
        ))}
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Running…' : 'Run AI'}
        </button>
      </div>

      {result && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <h3>Result</h3>
          {result.raw ? (
            <ReactMarkdown>{result.raw}</ReactMarkdown>
          ) : (
            <pre style={{ overflow: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 6, fontSize: 12 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3>Recent AI Runs</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th>Endpoint</th><th>Entity</th><th>Model</th><th>When</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.endpoint}</td>
                  <td>{h.entity_type ? `${h.entity_type} #${h.entity_id}` : '—'}</td>
                  <td>{h.model || '—'}</td>
                  <td>{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
