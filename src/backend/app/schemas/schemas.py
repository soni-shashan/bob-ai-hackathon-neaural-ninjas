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
    latitude: Optional[float] = 28.6139
    longitude: Optional[float] = 77.2090
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

class RiskTierStat(BaseModel):
    count: int
    percentage: float

class RiskDistribution(BaseModel):
    critical: RiskTierStat
    high: RiskTierStat
    medium: RiskTierStat
    low: RiskTierStat

class DashboardSummaryResponse(BaseModel):
    total_assets: int
    critical_assets: int
    high_risk_assets: int
    medium_risk_assets: int = 0
    low_risk_assets: int = 0
    customers_at_risk: int
    active_weather_alerts: int
    grid_health_score: int
    normal_baseline_score: int = 78
    risk_distribution: Optional[RiskDistribution] = None
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

    # Optional detailed IEEE C57.91 transformer telemetry fields
    oti: Optional[float] = None
    wti: Optional[float] = None
    ati: Optional[float] = None
    oli: Optional[float] = None
    oti_a: Optional[float] = 0.0
    oti_t: Optional[float] = 0.0
    vl1: Optional[float] = 240.0
    vl2: Optional[float] = 240.0
    vl3: Optional[float] = 240.0
    il1: Optional[float] = None
    il2: Optional[float] = None
    il3: Optional[float] = None
    inut: Optional[float] = 0.0

class MLPredictRequest(BaseModel):
    asset_id: str
    features: MLPredictFeatures

class MLPredictResponse(BaseModel):
    asset_id: str
    failure_probability: float
    prediction: str
    model_version: str

    # Extended diagnostic insights (Optional for full backwards compatibility)
    health_score: Optional[float] = None
    health_category: Optional[str] = None
    is_anomaly: Optional[bool] = None
    decision_score: Optional[float] = None
    normalized_anomaly_risk: Optional[float] = None
    dominant_risk_factor: Optional[str] = None
    risk_reason: Optional[str] = None
    recommended_action: Optional[str] = None
    equipment_risk_score: Optional[float] = None
    mog_probability: Optional[float] = None
    penalties: Optional[Dict[str, float]] = None

class MLModelInfoResponse(BaseModel):
    model_name: str
    version: str
    architecture: str
    features: List[str]
    weights: Dict[str, float]
    status: str

class ChatMessagePayload(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class AdvisorQueryRequest(BaseModel):
    question: str
    asset_id: Optional[str] = None
    history: Optional[List[ChatMessagePayload]] = None
    language: Optional[str] = "en"

class AdvisorQueryResponse(BaseModel):
    answer: str
    priority: str = "MEDIUM"
    evidence: List[str] = []
    recommended_actions: List[str] = []
    expected_impact: Optional[str] = None
    related_asset_id: Optional[str] = None
    model_name: Optional[str] = "ibm-bob-ai/fast"

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


# ── IoT Device & Sensor Data Ingestion Schemas ────────────────────────────

class IoTSensorPayload(BaseModel):
    """Single sensor reading from an IoT device."""
    temperature: float = Field(..., description="Top oil temperature (°C)")
    vibration: float = Field(..., description="Acoustic vibration (mm/s)")
    partial_discharge: float = Field(..., description="Partial discharge activity (pC)")
    oil_quality: float = Field(..., description="Dielectric oil quality index (0-100)")
    load: float = Field(..., description="Active load (MW)")
    ambient_temperature: Optional[float] = Field(32.0, description="Ambient temperature (°C)")
    timestamp: Optional[str] = Field(None, description="ISO 8601 timestamp. Server generates if omitted.")

    # Optional detailed IEEE C57.91 telemetry fields
    oti: Optional[float] = None
    wti: Optional[float] = None
    ati: Optional[float] = None
    oli: Optional[float] = None
    oti_a: Optional[float] = 0.0
    oti_t: Optional[float] = 0.0
    vl1: Optional[float] = 240.0
    vl2: Optional[float] = 240.0
    vl3: Optional[float] = 240.0
    il1: Optional[float] = None
    il2: Optional[float] = None
    il3: Optional[float] = None
    inut: Optional[float] = 0.0


class IoTBatchIngestRequest(BaseModel):
    """Batch of sensor readings from an IoT device. API key passed via header."""
    readings: List[IoTSensorPayload] = Field(..., min_length=1, max_length=500,
                                              description="Array of sensor readings (1-500 per batch)")


class IoTPredictionResult(BaseModel):
    """ML prediction result for a single sensor reading."""
    prediction: str
    failure_probability: float
    health_score: Optional[float] = None
    is_anomaly: Optional[bool] = None
    risk_level: str
    dominant_risk_factor: Optional[str] = None
    recommended_action: Optional[str] = None


class IoTBatchIngestResponse(BaseModel):
    """Response from batch data ingestion."""
    success: bool
    device_id: str
    asset_id: str
    readings_accepted: int
    readings_rejected: int = 0
    latest_prediction: Optional[IoTPredictionResult] = None
    alerts: List[str] = []
    message: str


class IoTDeviceRegisterRequest(BaseModel):
    """Request to register a new IoT device."""
    device_name: str = Field(..., min_length=3, max_length=100)
    asset_id: str = Field(..., description="Asset ID this device monitors (e.g., TR-104)")
    device_type: Optional[str] = Field("sensor_gateway",
                                        description="Device type: sensor_gateway, edge_node, plc, raspberry_pi")
    firmware_version: Optional[str] = "1.0.0"
    is_simulated: Optional[bool] = False


class IoTDeviceRegisterResponse(BaseModel):
    """Response after registering an IoT device. Contains the generated API key."""
    device_id: str
    device_name: str
    asset_id: str
    api_key: str = Field(..., description="Store securely. Shown only once.")
    message: str


class IoTDeviceStatusResponse(BaseModel):
    """Status of a registered IoT device."""
    device_id: str
    device_name: str
    asset_id: str
    device_type: str
    firmware_version: str
    is_active: bool
    is_simulated: bool = False
    last_heartbeat: Optional[str] = None
    total_readings_sent: int
    created_at: str

    class Config:
        from_attributes = True


class IoTHeartbeatResponse(BaseModel):
    """Response to device heartbeat."""
    device_id: str
    status: str
    server_time: str
    message: str


class IoTLogResponse(BaseModel):
    """Log record of IoT telemetry ingestion and automatic ML prediction."""
    id: int
    device_id: str
    asset_id: str
    readings_count: int
    timestamp: str
    prediction_triggered: bool
    prediction_result: Optional[str] = None
    failure_probability: Optional[float] = None
    health_score: Optional[float] = None
    is_anomaly: Optional[bool] = None
    is_simulated: bool = False

    class Config:
        from_attributes = True


# ── User Management & RBAC Schemas ─────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: Optional[str] = "GRID_OPERATOR"
    department: Optional[str] = "Grid Operations"
    phone: Optional[str] = None
    permissions: Optional[Dict[str, str]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[Dict[str, str]] = None


class UserPasswordReset(BaseModel):
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    department: Optional[str] = "Grid Operations"
    phone: Optional[str] = None
    permissions: Optional[Dict[str, str]] = None
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class UserMinimal(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None

    class Config:
        from_attributes = True


# ── Maintenance Ticket System Schemas ──────────────────────────────────

class TicketCreate(BaseModel):
    asset_id: str
    title: str
    description: str
    priority: Optional[str] = "MEDIUM" # LOW, MEDIUM, HIGH, CRITICAL
    assigned_to_user_id: Optional[int] = None
    assigned_crew_id: Optional[str] = None
    due_date: Optional[str] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None # OPEN, IN_PROGRESS, PENDING_REVIEW, RESOLVED, CLOSED
    assigned_to_user_id: Optional[int] = None
    assigned_crew_id: Optional[str] = None
    due_date: Optional[str] = None
    resolution_notes: Optional[str] = None


class TicketCommentCreate(BaseModel):
    comment: str


class TicketActivityResponse(BaseModel):
    id: int
    ticket_id: str
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    comment: Optional[str] = None
    timestamp: str

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: str
    asset_id: str
    asset_name: Optional[str] = None
    asset_health: Optional[int] = None
    asset_risk_score: Optional[int] = None
    title: str
    description: str
    priority: str
    status: str
    created_by_user_id: int
    created_by_name: Optional[str] = None
    assigned_to_user_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    assigned_crew_id: Optional[str] = None
    assigned_crew_name: Optional[str] = None
    created_at: str
    updated_at: str
    due_date: Optional[str] = None
    resolution_notes: Optional[str] = None
    activities: List[TicketActivityResponse] = []

    class Config:
        from_attributes = True




