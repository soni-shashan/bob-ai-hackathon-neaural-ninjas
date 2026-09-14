# GridGuard AI — Architecture & Technical Specifications

## High-Level System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Web Browser (React 18)                          │
│                                                                        │
│   ├── Operations Dashboard (/dashboard)                                │
│   ├── Grid Fleet Inventory (/assets)                                   │
│   ├── Asset Diagnostics (/assets/:assetId)                             │
│   ├── Geospatial Risk Map (/risk-map)                                  │
│   ├── Maintenance & Pre-positioning (/maintenance)                     │
│   ├── Meteorological Intel (/weather)                                  │
│   ├── Reliability Archive (/incidents)                                 │
│   ├── Decision-Support Advisor (/advisor)                              │
│   └── Simulator Controller (TR-104 Demo Bar)                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST APIs (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Backend Application Layer (FastAPI)                   │
│                                                                        │
│   ├── API Endpoints (/api/dashboard, /api/assets, /api/sensors,        │
│   │                  /api/risk, /api/weather, /api/maintenance, etc.)  │
│   │                                                                    │
│   ├── Composite Risk Engine (Formula calculation & decomposition)      │
│   │                                                                    │
│   ├── Maintenance & Dispatch Optimizer (Priority re-ranking & ETA)     │
│   │                                                                    │
│   ├── AI Advisor Reasoning Engine (Structured decision trees)          │
│   │                                                                    │
│   └── Isolated ML Service Integration Boundary                         │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │     SQLite Database    │       │ Pluggable ML Predictor │
       │  (SQLAlchemy 2.0 ORM)  │       │ (Internal heuristic /  │
       │  Assets, Sensors,      │       │  External HTTP Model)  │
       │  Forecasts, Incidents  │       └────────────────────────┘
       └────────────────────────┘
```

---

## Machine Learning Integration Boundary

The ML inference boundary is completely decoupled from the user interface:

1. **Frontend Isolation:** The frontend only ever communicates with `POST /api/ml/predict`. It has zero knowledge of the ML model's host, framework, or language.
2. **API Contract:**
   - **Request:**
     ```json
     {
       "asset_id": "TR-104",
       "features": {
         "temperature": 91.2,
         "vibration": 7.8,
         "partial_discharge": 42.0,
         "oil_quality": 52.0,
         "load": 84.0,
         "ambient_temperature": 34.0
       }
     }
     ```
   - **Response:**
     ```json
     {
       "asset_id": "TR-104",
       "failure_probability": 0.82,
       "prediction": "CRITICAL_RISK",
       "model_version": "mock-v1"
     }
     ```
3. **Pluggable Architecture:**
   - In development/mock mode: `src/backend/app/services/ml_service.py` executes a physics-based transformer degradation heuristic evaluating dielectric PD anomalies, temperature baselines, and vibration harmonics.
   - In production/teammate model mode: By toggling `USE_EXTERNAL_ML_SERVICE=true` and configuring `EXTERNAL_ML_SERVICE_URL="http://friend-model:8001/predict"` in `.env`, the backend dispatches asynchronous HTTP POST requests via `httpx.AsyncClient` with automatic fallback.

---

## Composite Risk Engine Formula

$$\text{Final Risk Score} = (w_{\text{eq}} \times P_{\text{fail}} \times 100) + (w_{\text{weather}} \times S_{\text{weather}}) + (w_{\text{impact}} \times S_{\text{impact}}) + (w_{\text{crit}} \times S_{\text{crit}})$$

Where default weights are:
- $w_{\text{eq}} = 0.40$ (Equipment Failure Probability)
- $w_{\text{weather}} = 0.20$ (Weather Risk Index 0–100)
- $w_{\text{impact}} = 0.25$ (Grid & Customer Disruption Score 0–100)
- $w_{\text{crit}} = 0.15$ (Asset Criticality Index 0–100)

Risk Classifications:
- `0–29`: **LOW**
- `30–49`: **MODERATE**
- `50–69`: **HIGH**
- `70–84`: **VERY_HIGH**
- `85–100`: **CRITICAL**

---

## Relational Database Schema

- **`assets`**: `id`, `name`, `asset_type`, `substation`, `grid_zone`, `latitude`, `longitude`, `capacity_mva`, `load_mw`, `health_score`, `criticality_score`, `customers_affected`, `status`, `installed_date`, `last_maintenance`
- **`sensor_readings`**: `id`, `asset_id`, `timestamp`, `temperature`, `vibration`, `partial_discharge`, `oil_quality`, `load`, `ambient_temperature`
- **`weather_forecasts`**: `id`, `zone`, `zone_name`, `timestamp`, `condition`, `rainfall_prob`, `rainfall_intensity_mm`, `wind_kmh`, `lightning_risk`, `flood_risk`, `weather_risk_level`, `weather_score`, `temperature_c`
- **`incidents`**: `id`, `asset_id`, `timestamp`, `failure_type`, `severity`, `duration_minutes`, `customers_affected`, `root_cause`, `weather_condition`, `resolution`, `location`
- **`crews`**: `id`, `name`, `status`, `depot_name`, `latitude`, `longitude`, `skills`, `equipment`, `available_from`, `assigned_asset_id`
- **`maintenance_actions`**: `id`, `asset_id`, `crew_id`, `priority`, `action`, `status`, `scheduled_time`, `estimated_duration_hours`, `reason`, `expected_risk_reduction_pct`
- **`demo_scenario_state`**: `id`, `current_stage`, `last_updated`
