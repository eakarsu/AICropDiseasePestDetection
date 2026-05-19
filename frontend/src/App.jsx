import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import AIAdvanced from './pages/AIAdvanced';
import { featureConfig } from './featureConfig';

// // === Batch 02 Gaps & Frontend Mounts ===
import CfMultiModalCropHealthAssessment from './pages/CfMultiModalCropHealthAssessment';
import CfFarmerDecisionSupport from './pages/CfFarmerDecisionSupport';
import CfSupplyChainOptimization from './pages/CfSupplyChainOptimization';
import CfIntegratedPestManagementIpmAutomation from './pages/CfIntegratedPestManagementIpmAutomation';
import GapMarketplaceExpertConsultationsLackAiDrivenMatching from './pages/GapMarketplaceExpertConsultationsLackAiDrivenMatching';
import GapFarmManagementLacksAiYieldForecastingEndpoint from './pages/GapFarmManagementLacksAiYieldForecastingEndpoint';
import GapCommunityReportsLacksAiModerationClustering from './pages/GapCommunityReportsLacksAiModerationClustering';
import GapNoMobileFieldCaptureAppSurfacesBeyondRestApi from './pages/GapNoMobileFieldCaptureAppSurfacesBeyondRestApi';
import GapNoWebhooksForSensorWeatherPushes from './pages/GapNoWebhooksForSensorWeatherPushes';
import GapNoSmsOrPushNotifications from './pages/GapNoSmsOrPushNotifications';
import GapNoPaymentMarketplaceTransactionHandling from './pages/GapNoPaymentMarketplaceTransactionHandling';
import GapNoCalendarIntegrationOnlyInternalCropCalendar from './pages/GapNoCalendarIntegrationOnlyInternalCropCalendar';

// // === Custom Views (Field Analytics) ===
import CustomViewsPage from './pages/CustomViewsPage';

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
        <li>
          <Link to="/ai-advanced" className={location.pathname === '/ai-advanced' ? 'active' : ''}>
            <span className="nav-icon">🤖</span> AI Advanced
          </Link>
        </li>
        <li>
          <Link to="/custom-views" className={location.pathname === '/custom-views' ? 'active' : ''}>
            <span className="nav-icon">🗺️</span> Field Analytics
          </Link>
        </li>
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
          <Route path="/ai-advanced" element={<AIAdvanced />} />
          <Route path="/custom-views" element={<CustomViewsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        
        {/* // === Batch 02 Gaps & Frontend Mounts === */}
        <Route path="/cf/multi-modal-crop-health-assessment" element={<CfMultiModalCropHealthAssessment />} />
        <Route path="/cf/farmer-decision-support" element={<CfFarmerDecisionSupport />} />
        <Route path="/cf/supply-chain-optimization" element={<CfSupplyChainOptimization />} />
        <Route path="/cf/integrated-pest-management-ipm-automation" element={<CfIntegratedPestManagementIpmAutomation />} />
        <Route path="/gap/marketplace-expert-consultations-lack-ai-driven-matching" element={<GapMarketplaceExpertConsultationsLackAiDrivenMatching />} />
        <Route path="/gap/farm-management-lacks-ai-yield-forecasting-endpoint" element={<GapFarmManagementLacksAiYieldForecastingEndpoint />} />
        <Route path="/gap/community-reports-lacks-ai-moderation-clustering" element={<GapCommunityReportsLacksAiModerationClustering />} />
        <Route path="/gap/no-mobile-field-capture-app-surfaces-beyond-rest-api" element={<GapNoMobileFieldCaptureAppSurfacesBeyondRestApi />} />
        <Route path="/gap/no-webhooks-for-sensor-weather-pushes" element={<GapNoWebhooksForSensorWeatherPushes />} />
        <Route path="/gap/no-sms-or-push-notifications" element={<GapNoSmsOrPushNotifications />} />
        <Route path="/gap/no-payment-marketplace-transaction-handling" element={<GapNoPaymentMarketplaceTransactionHandling />} />
        <Route path="/gap/no-calendar-integration-only-internal-crop-calendar" element={<GapNoCalendarIntegrationOnlyInternalCropCalendar />} />
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
