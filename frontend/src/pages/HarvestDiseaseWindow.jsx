import FormattedAIReport from "../components/FormattedAIReport";
import React, { useState } from 'react';
import api from '../api';

const examples = [
  { label: 'Tomato blight', crop: 'tomato', field: 'Example north field', days_to_harvest: 9, humidity_pct: 82, rain_forecast_mm: 18, active_disease: 'suspected late blight' },
  { label: 'Wheat rust', crop: 'wheat', field: 'Example west field', days_to_harvest: 24, humidity_pct: 68, rain_forecast_mm: 6, active_disease: 'suspected leaf rust' },
  { label: 'Citrus canker', crop: 'orange', field: 'Example south orchard', days_to_harvest: 42, humidity_pct: 88, rain_forecast_mm: 32, active_disease: 'suspected citrus canker' },
];

export default function HarvestDiseaseWindow() {
  const [payload, setPayload] = useState('{"crop":"tomato","field":"North 4","days_to_harvest":9,"humidity_pct":82,"rain_forecast_mm":18,"active_disease":"late blight"}');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const run = async () => {
    setError('');
    try { setResult((await api.post('/harvest-disease-window', JSON.parse(payload || '{}'))).data); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };
  return <div className="page"><h1>Harvest Disease Window</h1><p>Illustrative inputs only; no field record is selected.</p><div className="ai-preset-bar"><div><strong>Fill all inputs</strong><p>Review the JSON before planning. Presets only fill the form.</p></div><div className="ai-actions">{examples.map(({ label, ...fields }) => <button key={label} type="button" className="btn btn-secondary" onClick={() => { setPayload(JSON.stringify(fields, null, 2)); setResult(null); setError(''); }}>{label}</button>)}</div></div><textarea aria-label="Harvest window inputs" rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} /><button className="btn btn-primary" onClick={run}>Plan Window</button>{error && <div className="error">{error}</div>}{result && <FormattedAIReport response={result} />}</div>;
}
