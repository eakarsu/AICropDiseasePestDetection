import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import { featureConfig } from './featureConfig';

function Sidebar({ user, onLogout }) {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>🌿 CropGuard AI</h2>
        <p>Disease & Pest Detection</p>
      </div>
      <ul className="sidebar-nav">
        <li>
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            <span className="nav-icon">📊</span> Dashboard
          </Link>
        </li>
        {featureConfig.map((f) => (
          <li key={f.path}>
            <Link to={f.path} className={location.pathname === f.path ? 'active' : ''}>
              <span className="nav-icon">{f.icon}</span> {f.shortName || f.name}
            </Link>
          </li>
        ))}
      </ul>
      <div className="sidebar-user">
        <div className="user-name">{user?.full_name}</div>
        <div className="user-email">{user?.email}</div>
        <button className="btn btn-secondary btn-sm btn-full" style={{ marginTop: 10 }} onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

function AppLayout({ user, onLogout }) {
  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          {featureConfig.map((f) => (
            <Route key={f.path} path={f.path} element={<FeaturePage config={f} />} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return null;

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{ className: 'toast-custom', duration: 3000 }} />
      {user ? (
        <AppLayout user={user} onLogout={handleLogout} />
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </Router>
  );
}
