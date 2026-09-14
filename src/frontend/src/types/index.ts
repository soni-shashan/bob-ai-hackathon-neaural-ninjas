// Frontend Types for GridGuard AI

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'CRITICAL';

export type AssetType = 
  | 'Power Transformer'
  | 'Substation Feeder'
  | 'Circuit Breaker'
  | 'Auto-Transformer'
  | 'Busbar Section';

export interface AssetSummary {
  id: string;
  name: string;
  type: string;
  location: string;
  latitude: number;
  longitude: number;
  health_score: number;
  risk_score: number;
  failure_probability: number;
  risk_level: RiskLevel;
  customers_affected: number;
  load_mw: number;
  weather_risk: RiskLevel | string;
  last_maintenance: string;
  installed_date?: string;
  capacity_mva?: number;
  status: 'OPERATIONAL' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE';
  grid_zone?: string;
}

export interface AssetListResponse {
  total: number;
  page: number;
  limit: number;
  items: AssetSummary[];
}

export interface SensorPoint {
  timestamp: string;
  value: number;
  unit?: string;
  baseline?: number;
  threshold_warning?: number;
  threshold_critical?: number;
}

export interface AssetSensorsResponse {
  asset_id: string;
  temperature: SensorPoint[];
  vibration: SensorPoint[];
  partial_discharge: SensorPoint[];
  oil_quality: SensorPoint[];
  load: SensorPoint[];
}

export interface RiskAnalysisResponse {
  asset_id: string;
  risk_score: number;
  failure_probability: number;
  equipment_risk: number;
  weather_risk: number;
  impact_score: number;
  criticality_score: number;
  risk_level: RiskLevel;
  contributing_factors: string[];
  weather_stress_delta: number;
  base_equipment_risk: number;
  estimated_failure_window: string;
}

export interface DashboardSummary {
  total_assets: number;
  critical_assets: number;
  high_risk_assets: number;
  customers_at_risk: number;
  active_weather_alerts: number;
  grid_health_score: number;
  last_updated: string;
}

export interface RiskTrendPoint {
  timestamp: string;
  hour: string;
  avg_risk_score: number;
  critical_count: number;
}

export interface AlertNotification {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'WEATHER' | 'INFO';
  asset_id?: string;
  asset_name?: string;
  title: string;
  description: string;
  timestamp: string;
  zone?: string;
}

export interface WeatherCondition {
  zone: string;
  zone_name: string;
  rainfall_prob: number;
  rainfall_intensity_mm: number;
  wind_speed_kmh: number;
  lightning_risk: string;
  flood_risk: string;
  weather_risk_level: RiskLevel;
  weather_score: number;
  temperature_c: number;
  affected_assets_count: number;
  condition_text: string;
}

export interface WeatherForecastDay {
  day: string;
  date: string;
  temp_max: number;
  temp_min: number;
  condition: string;
  rainfall_prob: number;
  risk_level: string;
}

export interface HistoricalIncident {
  id: string;
  asset_id: string;
  asset_name?: string;
  timestamp: string;
  failure_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  duration_minutes: number;
  customers_affected: number;
  root_cause: string;
  weather_condition: string;
  resolution: string;
  location: string;
}

export interface CrewMember {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'STANDBY' | 'EN_ROUTE' | 'PREPARING';
  current_location: string;
  latitude: number;
  longitude: number;
  skills: string[];
  equipment: string[];
  assigned_asset_id?: string;
  available_from: string;
  recommended_position?: string;
  recommended_reason?: string;
  eta_minutes?: number;
}

export interface MaintenanceActionItem {
  id: string;
  priority: number;
  asset_id: string;
  asset_name: string;
  location: string;
  risk_score: number;
  action: string;
  crew_id?: string;
  crew_name?: string;
  status: 'PENDING' | 'PREPARING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  eta_minutes?: number;
  recommended_start: string;
  reason: string;
  expected_risk_reduction_pct?: number;
}

export interface MaintenancePlanResponse {
  generated_at: string;
  total_actions: number;
  actions: MaintenanceActionItem[];
}

export interface MLPredictRequest {
  asset_id: string;
  features: {
    temperature: number;
    vibration: number;
    partial_discharge: number;
    oil_quality: number;
    load: number;
    ambient_temperature?: number;
  };
}

export interface MLPredictResponse {
  asset_id: string;
  failure_probability: number;
  prediction: string;
  model_version: string;
}

export interface AdvisorQueryResponse {
  answer: string;
  priority: RiskLevel;
  evidence: string[];
  recommended_actions: string[];
  expected_impact?: string;
  related_asset_id?: string;
}

export type DemoStage = 'baseline' | 'degradation' | 'critical';

export interface DemoStateResponse {
  current_stage: DemoStage;
  asset_id: string;
  risk_score: number;
  failure_probability: number;
  status_label: string;
  stage_description: string;
  last_updated: string;
}
