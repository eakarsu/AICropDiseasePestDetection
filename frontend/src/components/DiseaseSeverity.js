// frontend/src/components/DiseaseSeverity.js
// Recharts stacked bar of disease case counts per crop, segmented by severity.

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../api';

const COLORS = {
  low:    '#16a34a',
  medium: '#f59e0b',
  high:   '#dc2626',
};

export default function DiseaseSeverity() {
  const [data, setData]       = useState({ crops: [], total_cases: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/custom-views/disease-severity')
      .then((res) => { if (alive) setData(res.data); })
      .catch((err) => { if (alive) setError(err?.response?.data?.error || err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#15803d' }}>📊 Disease Severity by Crop</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Detected cases stacked by severity per crop
          </p>
        </div>
        <div style={{ color: '#0f766e', fontWeight: 600 }}>
          Total cases: {data.total_cases ?? 0}
        </div>
      </div>

      {loading && <div style={{ padding: 24, color: '#64748b' }}>Loading chart…</div>}
      {error && <div style={{ padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 6 }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ height: 380, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.crops || []} margin={{ top: 12, right: 20, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="crop" angle={-20} textAnchor="end" interval={0} height={60} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                formatter={(v, name) => [v, name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
              <Bar dataKey="low"    stackId="sev" fill={COLORS.low}    name="low" />
              <Bar dataKey="medium" stackId="sev" fill={COLORS.medium} name="medium" />
              <Bar dataKey="high"   stackId="sev" fill={COLORS.high}   name="high" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
