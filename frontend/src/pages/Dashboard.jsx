import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { featureConfig } from '../featureConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
    featureConfig.forEach(f => {
      api.get(f.apiPath).then(r => {
        setCounts(prev => ({ ...prev, [f.path]: r.data.length }));
      }).catch(() => {});
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🌿 Dashboard</h1>
          <p className="subtitle">AI-Powered Crop Disease & Pest Detection Platform</p>
        </div>
      </div>

      {stats && (
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalDiseases}</div>
            <div className="stat-label">Diseases Detected</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-value">{stats.totalPests}</div>
            <div className="stat-label">Pests Identified</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-value">{stats.avgHealthScore}%</div>
            <div className="stat-label">Avg Crop Health</div>
          </div>
          <div className="stat-card red">
            <div className="stat-value">{stats.activeAlerts}</div>
            <div className="stat-label">Active Alerts</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-value">{stats.totalFarms}</div>
            <div className="stat-label">Farm Records</div>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Features</h2>
      <div className="feature-grid">
        {featureConfig.map((f) => (
          <div
            key={f.path}
            className="feature-card"
            onClick={() => navigate(f.path)}
          >
            <div className="card-icon">{f.icon}</div>
            <h3>{f.name}</h3>
            <p>{f.description}</p>
            {counts[f.path] !== undefined && (
              <div className="card-count">{counts[f.path]} records</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
