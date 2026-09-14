import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { RiskMapPage } from './pages/RiskMapPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { WeatherPage } from './pages/WeatherPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:assetId" element={<AssetDetailPage />} />
          <Route path="risk-map" element={<RiskMapPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="weather" element={<WeatherPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="advisor" element={<AdvisorPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Catch-all redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
