import React, { useState } from 'react';
import api from '../api';

export default function HarvestDiseaseWindow() {
  const [payload, setPayload] = useState('{"crop":"tomato","field":"North 4","days_to_harvest":9,"humidity_pct":82,"rain_forecast_mm":18,"active_disease":"late blight"}');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const run = async () => {
    setError('');
    try { setResult((await api.post('/harvest-disease-window', JSON.parse(payload || '{}'))).data); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };
  return <div className="page"><h1>Harvest Disease Window</h1><textarea rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} /><button className="btn btn-primary" onClick={run}>Plan Window</button>{error && <div className="error">{error}</div>}{result && <pre>{JSON.stringify(result, null, 2)}</pre>}</div>;
}
