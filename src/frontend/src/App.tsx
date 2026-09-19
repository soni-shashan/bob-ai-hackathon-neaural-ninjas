import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { RiskMapPage } from './pages/RiskMapPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { WeatherPage } from './pages/WeatherPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { IoTStreamPage } from './pages/IoTStreamPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { TicketsPage } from './pages/TicketsPage';
import { SettingsPage } from './pages/SettingsPage';



/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Shows a loading spinner while auth state is being restored from localStorage.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b0f17]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading GridGuard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const SectionProtectedRoute: React.FC<{ section: string; children: React.ReactNode }> = ({ section, children }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(section)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Route — Login */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      {/* Protected Routes — All app pages */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assets/:assetId" element={<AssetDetailPage />} />
        <Route path="risk-map" element={<RiskMapPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="tickets" element={<SectionProtectedRoute section="tickets"><TicketsPage /></SectionProtectedRoute>} />
        <Route path="users" element={<SectionProtectedRoute section="users"><UserManagementPage /></SectionProtectedRoute>} />
        <Route path="weather" element={<WeatherPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="advisor" element={<AdvisorPage />} />
        <Route path="iot" element={<IoTStreamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Catch-all redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};


export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

