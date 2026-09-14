from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SensorPoint(BaseModel):
    timestamp: str
    value: float
    unit: Optional[str] = None
    baseline: Optional[float] = None
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None

class AssetSensorsResponse(BaseModel):
    asset_id: str
    temperature: List[SensorPoint]
    vibration: List[SensorPoint]
    partial_discharge: List[SensorPoint]
    oil_quality: List[SensorPoint]
    load: List[SensorPoint]

class AssetBase(BaseModel):
    id: str
    name: str
    type: str = Field(alias="type")
    location: str
    latitude: float
    longitude: float
    health_score: int
    risk_score: int
    failure_probability: float
    risk_level: str
    customers_affected: int
    load_mw: float
    weather_risk: str
    last_maintenance: str
    installed_date: Optional[str] = None
    capacity_mva: Optional[float] = None
    status: str
    grid_zone: Optional[str] = "East Grid"

    class Config:
        populate_by_name = True
        from_attributes = True

class AssetCreate(BaseModel):
    id: str
    name: str
    type: Optional[str] = "Power Transformer"
    location: str
    grid_zone: Optional[str] = "East Grid"
    latitude: Optional[float] = 23.05
    longitude: Optional[float] = 72.65
    capacity_mva: Optional[float] = 50.0
    load_mw: Optional[float] = 30.0
    criticality_score: Optional[int] = 70
    customers_affected: Optional[int] = 5000
    installed_date: Optional[str] = "2024-01-01"

class AssetListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AssetBase]

class RiskAnalysisResponse(BaseModel):
    asset_id: str
    risk_score: int
    failure_probability: float
    equipment_risk: int
    weather_risk: int
    impact_score: int
    criticality_score: int
    risk_level: str
    contributing_factors: List[str]
    weather_stress_delta: int
    base_equipment_risk: int
    estimated_failure_window: str

class DashboardSummaryResponse(BaseModel):
    total_assets: int
    critical_assets: int
    high_risk_assets: int
    customers_at_risk: int
    active_weather_alerts: int
    grid_health_score: int
    last_updated: str

class RiskTrendPoint(BaseModel):
    timestamp: str
    hour: str
    avg_risk_score: float
    critical_count: int

class AlertNotification(BaseModel):
    id: str
    severity: str # CRITICAL, HIGH, WEATHER, INFO
    asset_id: Optional[str] = None
    asset_name: Optional[str] = None
    title: str
    description: str
    timestamp: str
    zone: Optional[str] = None

class WeatherConditionResponse(BaseModel):
    zone: str
    zone_name: str
    rainfall_prob: int
    rainfall_intensity_mm: float
    wind_speed_kmh: float
    lightning_risk: str
    flood_risk: str
    weather_risk_level: str
    weather_score: int
    temperature_c: float
    affected_assets_count: int
    condition_text: str

class IncidentResponse(BaseModel):
    id: str
    asset_id: str
    asset_name: Optional[str] = None
    timestamp: str
    failure_type: str
    severity: str
    duration_minutes: int
    customers_affected: int
    root_cause: str
    weather_condition: str
    resolution: str
    location: str

    class Config:
        from_attributes = True

class CrewResponse(BaseModel):
    id: str
    name: str
    status: str
    current_location: str
    latitude: float
    longitude: float
    skills: List[str]
    equipment: List[str]
    assigned_asset_id: Optional[str] = None
    available_from: str
    recommended_position: Optional[str] = None
    recommended_reason: Optional[str] = None
    eta_minutes: Optional[int] = None

    class Config:
        from_attributes = True

class CrewAssignRequest(BaseModel):
    asset_id: str
    crew_id: str

class CrewAssignResponse(BaseModel):
    success: bool
    asset_id: str
    crew_id: str
    status: str
    message: str

class MaintenanceActionItem(BaseModel):
    id: str
    priority: int
    asset_id: str
    asset_name: str
    location: str
    risk_score: int
    action: str
    crew_id: Optional[str] = None
    crew_name: Optional[str] = None
    status: str
    eta_minutes: Optional[int] = None
    recommended_start: str
    reason: str
    expected_risk_reduction_pct: Optional[int] = 50

class MaintenancePlanResponse(BaseModel):
    generated_at: str
    total_actions: int
    actions: List[MaintenanceActionItem]

class MLPredictFeatures(BaseModel):
    temperature: float
    vibration: float
    partial_discharge: float
    oil_quality: float
    load: float
    ambient_temperature: Optional[float] = 32.0

class MLPredictRequest(BaseModel):
    asset_id: str
    features: MLPredictFeatures

class MLPredictResponse(BaseModel):
    asset_id: str
    failure_probability: float
    prediction: str
    model_version: str

class AdvisorQueryRequest(BaseModel):
    question: str
    asset_id: Optional[str] = None

class AdvisorQueryResponse(BaseModel):
    answer: str
    priority: str
    evidence: List[str]
    recommended_actions: List[str]
    expected_impact: Optional[str] = None
    related_asset_id: Optional[str] = None

class DemoSetStageRequest(BaseModel):
    stage: str # 'baseline', 'degradation', 'critical'

class DemoStateResponse(BaseModel):
    current_stage: str
    asset_id: str
    risk_score: int
    failure_probability: float
    status_label: str
    stage_description: str
    last_updated: str
