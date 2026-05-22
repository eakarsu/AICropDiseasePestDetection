// frontend/src/components/PestSpreadMap.js
// React-Leaflet map of pest sightings, colored by severity.

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import api from '../api';

const SEVERITY_COLOR = {
  high:   '#dc2626', // red
  medium: '#f59e0b', // amber
  low:    '#16a34a', // green
};

const SEVERITY_RADIUS = {
  high:   11,
  medium: 8,
  low:    6,
};

export default function PestSpreadMap() {
  const [data, setData]       = useState({ sightings: [], summary: { high: 0, medium: 0, low: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/custom-views/pest-spread')
      .then((res) => { if (alive) setData(res.data); })
      .catch((err) => { if (alive) setError(err?.response?.data?.error || err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#15803d' }}>🌍 Pest Spread Map</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Live pest sightings colored by severity
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
          <Badge color={SEVERITY_COLOR.high}   label={`High ${data.summary?.high ?? 0}`} />
          <Badge color={SEVERITY_COLOR.medium} label={`Medium ${data.summary?.medium ?? 0}`} />
          <Badge color={SEVERITY_COLOR.low}    label={`Low ${data.summary?.low ?? 0}`} />
        </div>
      </div>

      {loading && <div style={{ padding: 24, color: '#64748b' }}>Loading map…</div>}
      {error && <div style={{ padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 6 }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ height: 460, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {(data.sightings || []).map((s) => (
              <CircleMarker
                key={s.id}
                center={[s.lat, s.lng]}
                radius={SEVERITY_RADIUS[s.severity] || 6}
                pathOptions={{
                  color: SEVERITY_COLOR[s.severity] || '#16a34a',
                  fillColor: SEVERITY_COLOR[s.severity] || '#16a34a',
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Tooltip>{s.pest_name} — {s.crop_name}</Tooltip>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{s.pest_name}</strong><br />
                    Crop: {s.crop_name}<br />
                    Field: {s.field_name}<br />
                    Region: {s.region}<br />
                    Severity: <span style={{ color: SEVERITY_COLOR[s.severity], fontWeight: 600, textTransform: 'capitalize' }}>{s.severity}</span><br />
                    Reported: {s.reported_at ? new Date(s.reported_at).toLocaleDateString() : 'n/a'}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}

function Badge({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `${color}1A`, color }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}
