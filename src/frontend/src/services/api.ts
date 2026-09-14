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
  MLPredictRequest,
  MLPredictResponse,
  DemoStateResponse,
  DemoStage
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });

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

// 9. AI Advisor
export const askAdvisor = (question: string, assetId?: string): Promise<AdvisorQueryResponse> =>
  fetchJson<AdvisorQueryResponse>('/api/advisor/query', {
    method: 'POST',
    body: JSON.stringify({ question, asset_id: assetId })
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
