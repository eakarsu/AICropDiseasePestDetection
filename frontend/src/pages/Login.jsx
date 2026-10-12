import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const demoAvailable = import.meta.env.VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL === 'true'
    && Boolean(import.meta.env.VITE_DEMO_EMAIL && import.meta.env.VITE_DEMO_PASSWORD);

  const autoFill = () => {
    if (!demoAvailable) return;
    setEmail(import.meta.env.VITE_DEMO_EMAIL);
    setPassword(import.meta.env.VITE_DEMO_PASSWORD);
    toast.success('Demo credentials filled. Select Sign In when ready.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      toast.success(`Welcome back, ${res.data.user.full_name}!`);
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">🌿</div>
          <h1>CropGuard AI</h1>
          <p>AI-Powered Crop Disease & Pest Detection Platform</p>
        </div>

        {demoAvailable ? <button type="button" className="btn btn-auto-fill btn-full" onClick={autoFill}>
          Fill Demo Credentials
        </button> : <p role="status">Demo credentials are not configured for this app session. Use your existing account.</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}
