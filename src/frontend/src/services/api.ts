import {
  DashboardSummary,
  RiskTrendPoint,
  AlertNotification,
  AssetListResponse,
  AssetSummary,
  AssetSensorsResponse,
  RiskAnalysisResponse,
  MaintenancePlanResponse,
  CrewMember,
  WeatherCondition,
  WeatherForecastDay,
  HistoricalIncident,
  AdvisorQueryResponse,
  ChatHistoryItem,
  MLPredictRequest,
  MLPredictResponse,
  MLModelInfo,
  DemoStateResponse,
  DemoStage,
  NasaPowerLiveResponse,
  IoTDeviceStatus,
  IoTLog,
  IoTDeviceRegisterRequest,
  IoTDeviceRegisterResponse
} from '../types';


// Base API configuration: In production (Vercel) and local dev, requests use relative /api/* paths.
// VITE_API_URL can optionally override the base URL if specified, but defaults to '' for relative /api/* routing.
const rawBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = rawBase === '/api' ? '' : rawBase;

/**
 * Resolves API endpoints to ensure clean relative paths (e.g. /api/health)
 * and prevents accidental path duplication like /api/api/...
 */
export function resolveUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE) {
    return cleanEndpoint;
  }
  if (API_BASE.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    return `${API_BASE.slice(0, -4)}${cleanEndpoint}`;
  }
  return `${API_BASE}${cleanEndpoint}`;
}

const TOKEN_KEY = 'gridguard_token';

// ── Auth Helper ──────────────────────────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// ── Core Fetch ───────────────────────────────────────────────────────
async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = resolveUrl(endpoint);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options?.headers || {})
      }
    });

    // Handle 401 — redirect to login
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('gridguard_user');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Authentication expired. Please login again.');
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error [${res.status}]: ${errText || res.statusText}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error(`Fetch failed for ${endpoint}:`, err);
    throw err;
  }
}

// ── Health Check ─────────────────────────────────────────────────────
export interface HealthStatusResponse {
  status: string;
  service: string;
  version: string;
}

export const checkHealth = (): Promise<HealthStatusResponse> =>
  fetchJson<HealthStatusResponse>('/api/health');

// ── Authentication ───────────────────────────────────────────────────
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_name: string;
  user_email: string;
  expires_in: number;
}

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const url = resolveUrl('/api/auth/login');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (res.status === 429) {
    const data = await res.json();
    throw new Error(data.detail || 'Too many login attempts. Please try again later.');
  }

  if (res.status === 401) {
    const data = await res.json();
    throw new Error(data.detail || 'Invalid email or password');
  }

  if (res.status === 403) {
    const data = await res.json();
    throw new Error(data.detail || 'Account is deactivated');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed [${res.status}]: ${errText || res.statusText}`);
  }

  return await res.json();
};

// 1. Dashboard
export const getDashboardSummary = (): Promise<DashboardSummary> =>
  fetchJson<DashboardSummary>('/api/dashboard/summary');

export const getRiskTrend = (): Promise<RiskTrendPoint[]> =>
  fetchJson<RiskTrendPoint[]>('/api/dashboard/risk-trend');

export const getActiveAlerts = (): Promise<AlertNotification[]> =>
  fetchJson<AlertNotification[]>('/api/dashboard/alerts');

// 2. Assets
export const getAssets = (params?: {
  risk_level?: string;
  asset_type?: string;
  location?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<AssetListResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
  if (params?.asset_type) searchParams.set('asset_type', params.asset_type);
  if (params?.location) searchParams.set('location', params.location);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return fetchJson<AssetListResponse>(`/api/assets${query}`);
};

export const getAsset = (assetId: string): Promise<AssetSummary> =>
  fetchJson<AssetSummary>(`/api/assets/${encodeURIComponent(assetId)}`);

export const createAsset = (data: {
  id: string;
  name: string;
  type?: string;
  location: string;
  grid_zone?: string;
  latitude?: number;
  longitude?: number;
  capacity_mva?: number;
  load_mw?: number;
  criticality_score?: number;
  customers_affected?: number;
}): Promise<AssetSummary> =>
  fetchJson<AssetSummary>('/api/assets', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// 3. Sensors
export const getSensorData = (assetId: string): Promise<AssetSensorsResponse> =>
  fetchJson<AssetSensorsResponse>(`/api/assets/${encodeURIComponent(assetId)}/sensors`);

// 4. Risk Analysis
export const getAssetRisk = (assetId: string): Promise<RiskAnalysisResponse> =>
  fetchJson<RiskAnalysisResponse>(`/api/assets/${encodeURIComponent(assetId)}/risk`);

// 5. Maintenance & Crews
export const getMaintenancePlan = (): Promise<MaintenancePlanResponse> =>
  fetchJson<MaintenancePlanResponse>('/api/maintenance/plan');

export const assignCrew = (
  assetId: string,
  crewId: string
): Promise<{ success: boolean; asset_id: string; crew_id: string; status: string; message: string }> =>
  fetchJson('/api/maintenance/assign', {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId, crew_id: crewId })
  });

export const getCrews = (): Promise<CrewMember[]> =>
  fetchJson<CrewMember[]>('/api/crews');

export const getCrew = (crewId: string): Promise<CrewMember> =>
  fetchJson<CrewMember>(`/api/crews/${encodeURIComponent(crewId)}`);

// 6. Weather
export const getWeather = (): Promise<WeatherCondition[]> =>
  fetchJson<WeatherCondition[]>('/api/weather/current');

export const getWeatherForecast = (): Promise<WeatherForecastDay[]> =>
  fetchJson<WeatherForecastDay[]>('/api/weather/forecast');

export const getWeatherAlerts = (): Promise<AlertNotification[]> =>
  fetchJson<AlertNotification[]>('/api/weather/alerts');

export const getNasaPowerLive = (lat: number = 28.6139, lon: number = 77.2090): Promise<NasaPowerLiveResponse> =>
  fetchJson<NasaPowerLiveResponse>(`/api/weather/nasa-power-live?lat=${lat}&lon=${lon}`);

// 7. Incidents
export const getIncidents = (params?: {
  asset_id?: string;
  severity?: string;
  failure_type?: string;
  location?: string;
}): Promise<HistoricalIncident[]> => {
  const searchParams = new URLSearchParams();
  if (params?.asset_id) searchParams.set('asset_id', params.asset_id);
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.failure_type) searchParams.set('failure_type', params.failure_type);
  if (params?.location) searchParams.set('location', params.location);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return fetchJson<HistoricalIncident[]>(`/api/incidents${query}`);
};

export const getIncident = (incidentId: string): Promise<HistoricalIncident> =>
  fetchJson<HistoricalIncident>(`/api/incidents/${encodeURIComponent(incidentId)}`);

// 8. ML Inference Bridge
export const predictFailure = (req: MLPredictRequest): Promise<MLPredictResponse> =>
  fetchJson<MLPredictResponse>('/api/ml/predict', {
    method: 'POST',
    body: JSON.stringify(req)
  });

export const getMLModelInfo = (): Promise<MLModelInfo> =>
  fetchJson<MLModelInfo>('/api/ml/info');

// 9. AI Advisor
export const askAdvisor = (
  question: string,
  history?: ChatHistoryItem[],
  assetId?: string
): Promise<AdvisorQueryResponse> =>
  fetchJson<AdvisorQueryResponse>('/api/advisor/query', {
    method: 'POST',
    body: JSON.stringify({ question, history, asset_id: assetId })
  });

// 10. Demo Scenario Controller
export const getDemoState = (): Promise<DemoStateResponse> =>
  fetchJson<DemoStateResponse>('/api/demo/state');

export const setDemoStage = (stage: DemoStage): Promise<DemoStateResponse> =>
  fetchJson<DemoStateResponse>('/api/demo/set-stage', {
    method: 'POST',
    body: JSON.stringify({ stage })
  });

export const resetDemo = (): Promise<DemoStateResponse> =>
  fetchJson<DemoStateResponse>('/api/demo/reset', {
    method: 'POST'
  });

// 11. IoT Devices & Live Telemetry Logs
export const getIoTDevices = (realOnly: boolean = false): Promise<IoTDeviceStatus[]> =>
  fetchJson<IoTDeviceStatus[]>(`/api/iot/devices${realOnly ? '?real_only=true' : ''}`);

export const registerIoTDevice = (data: IoTDeviceRegisterRequest): Promise<IoTDeviceRegisterResponse> =>
  fetchJson<IoTDeviceRegisterResponse>('/api/iot/devices', {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const deactivateIoTDevice = (deviceId: string): Promise<{ success: boolean; device_id: string; message: string }> =>
  fetchJson(`/api/iot/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE'
  });

export const getIoTLogs = (assetId?: string, limit: number = 50, realOnly: boolean = false): Promise<IoTLog[]> => {
  const searchParams = new URLSearchParams();
  if (assetId) searchParams.set('asset_id', assetId);
  if (limit) searchParams.set('limit', limit.toString());
  if (realOnly) searchParams.set('real_only', 'true');
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return fetchJson<IoTLog[]>(`/api/iot/logs${query}`);
};

export const purgeIoTLogs = (simulatedOnly: boolean = true): Promise<{ success: boolean; purged_count: number; simulated_only: boolean }> =>
  fetchJson(`/api/iot/logs?simulated_only=${simulatedOnly}`, {
    method: 'DELETE'
  });

export const resetIoTSystem = (): Promise<{ success: boolean; deleted_devices: number; deleted_logs: number; message: string }> =>
  fetchJson('/api/iot/reset', {
    method: 'POST'
  });



