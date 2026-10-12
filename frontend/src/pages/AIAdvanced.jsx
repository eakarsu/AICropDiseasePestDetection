import FormattedAIReport from "../components/FormattedAIReport";
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export const TOOLS = [
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

export const EXAMPLES = [
  { label: 'Tomato field', crop_name: 'Tomato', crop_stage: 'Flowering', field_name: 'Example north field', region: 'Central Valley, California', treatment_name: 'Copper fungicide', quantity: '20 L', target_yield: '65 t/ha', current_stage: 'Flowering', observed_pests: 'Whiteflies observed on lower leaves', observed_diseases: 'Early blight lesions on older leaves', prior_treatments: 'One copper spray 10 days ago', organic_only: 'false', market_price_outlook: 'Stable wholesale tomato prices', weather_summary: 'Warm days, humid nights, light rain forecast', soil: { ph: 6.4, nitrogen_ppm: 38, phosphorus_ppm: 24, potassium_ppm: 190 }, forecast: { days: 7, rain_mm: 18, max_temp_c: 29, humidity_pct: 82 }, weather_forecast: { days: 7, rain_mm: 18, max_temp_c: 29, humidity_pct: 82 } },
  { label: 'Wheat field', crop_name: 'Wheat', crop_stage: 'Tillering', field_name: 'Example west field', region: 'Kansas, USA', treatment_name: 'Triazole fungicide', quantity: '12 L', target_yield: '5 t/ha', current_stage: 'Tillering', observed_pests: 'Aphids on scattered stems', observed_diseases: 'Possible leaf rust on lower canopy', prior_treatments: 'No treatment this season', organic_only: 'false', market_price_outlook: 'Moderate seasonal price volatility', weather_summary: 'Cool nights and intermittent showers', soil: { ph: 6.8, nitrogen_ppm: 27, phosphorus_ppm: 18, potassium_ppm: 150 }, forecast: { days: 7, rain_mm: 25, max_temp_c: 23, humidity_pct: 74 }, weather_forecast: { days: 7, rain_mm: 25, max_temp_c: 23, humidity_pct: 74 } },
  { label: 'Citrus orchard', crop_name: 'Orange', crop_stage: 'Fruit development', field_name: 'Example south orchard', region: 'Florida, USA', treatment_name: 'Horticultural oil', quantity: '30 L', target_yield: '32 t/ha', current_stage: 'Fruit development', observed_pests: 'Scale insects on several branches', observed_diseases: 'No confirmed disease; inspect discolored leaves', prior_treatments: 'Horticultural oil applied last month', organic_only: 'true', market_price_outlook: 'Higher prices for grade A fruit', weather_summary: 'Hot, wet afternoons', soil: { ph: 6.1, nitrogen_ppm: 32, phosphorus_ppm: 21, potassium_ppm: 175 }, forecast: { days: 7, rain_mm: 42, max_temp_c: 32, humidity_pct: 88 }, weather_forecast: { days: 7, rain_mm: 42, max_temp_c: 32, humidity_pct: 88 } },
];
const dateOffset = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const advancedPreset = (tool, example) => Object.fromEntries(tool.fields.map((field) => [field,
  example[field] ?? (field === 'planted_at' ? dateOffset(-120) : field === 'target_harvest_at' ? dateOffset(30) : '')
]));

export default function AIAdvanced() {
  const [tool, setTool] = useState(TOOLS[0]);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);

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
        {tool.fields.length > 0 && <div className="ai-preset-bar"><div><strong>Fill all inputs</strong><p>Examples fill every input for review and do not run AI. Field names are examples, not selected records.</p></div><div className="ai-actions">{EXAMPLES.map((example) => <button key={example.label} type="button" className="btn btn-secondary" disabled={loading} onClick={() => { setForm(advancedPreset(tool, example)); setResult(null); }}>{example.label}</button>)}</div></div>}
        {tool.fields.length === 0 && <p>Requires existing treatment results in your account. No example records are created.</p>}
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
          <FormattedAIReport response={result} title={tool.label} />
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
                  <td><button type="button" className="btn btn-secondary" onClick={() => setSelectedRun(h)}>{h.endpoint} · View report</button></td>
                  <td>{h.entity_type ? `${h.entity_type} #${h.entity_id}` : '—'}</td>
                  <td>{h.model || '—'}</td>
                  <td>{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedRun && <div className="card" style={{ padding: 20, marginTop: 24 }}><button type="button" className="btn btn-secondary" onClick={() => setSelectedRun(null)}>Close saved report</button><FormattedAIReport response={selectedRun.result} title={selectedRun.endpoint} model={selectedRun.model} /></div>}
    </div>
  );
}
