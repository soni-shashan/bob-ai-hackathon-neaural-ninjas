# GridGuard AI — Architecture & Technical Specifications

## High-Level System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Web Browser (React 18 + Vite)                   │
│                                                                        │
│   ├── Operations Dashboard (/dashboard)                                │
│   ├── Grid Fleet Inventory (/assets)                                   │
│   ├── Asset Diagnostics & SCADA (/assets/:assetId)                     │
│   ├── Geospatial Risk Map (/risk-map)                                  │
│   ├── Maintenance & Pre-positioning (/maintenance)                     │
│   ├── Meteorological Intel (/weather)                                  │
│   ├── IoT Live Stream UI (/iot)                                        │
│   ├── Reliability Archive (/incidents)                                 │
│   ├── Decision-Support Advisor (/advisor)                              │
│   └── Simulator Controller (TR-104 Demo Bar)                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST APIs (/api/*) + JWT Auth & SSE
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Backend Application Layer (FastAPI)                   │
│                                                                        │
│   ├── API Routers (auth, dashboard, assets, sensors, risk, weather,    │
│   │                incidents, maintenance, crews, ml, advisor, demo,   │
│   │                iot)                                                │
│   ├── Composite Risk Engine (Formula calculation & decomposition)      │
│   ├── Maintenance & Dispatch Optimizer (5 Priority Tiers & Crew ETA)   │
│   ├── IBM Bob AI Advisor Service (Granite / fast structured LLM)       │
│   ├── IoT Push Ingestion Engine & Device Authentication Manager        │
│   ├── Asynchronous ML Background Worker & SSE Event Broadcaster        │
│   ├── NASA POWER Satellite Weather Integration Engine                  │
│   └── 6-Stage ML Pipeline (Physics + Scikit-learn models)              │
└──────┬────────────────────────────┬────────────────────────────┬───────┘
       │                            │                            │
       ▼                            ▼                            ▼
┌──────────────┐          ┌──────────────────┐         ┌─────────────────┐
│  SQLite DB   │          │  IBM Bob AI API  │         │  Python IoT SDK │
│ (Assets, IoT │          │  (Granite/fast)  │         │ (Hardware Edge  │
│ Logs, Crews) │          │  Reasoning Engine│         │ Device Stream)  │
└──────────────┘          └──────────────────┘         └─────────────────┘
```

---

## Machine Learning & AI Integration Architecture

### 1. 6-Stage Machine Learning Pipeline
GridGuard AI executes an end-to-end multi-stage inference pipeline to evaluate equipment health and storm vulnerability:

```text
Stage 1: IEEE C57.91 Physics Health Score
    │ (Thermal limits, vibration velocity, PD thresholds)
    ▼
Stage 2: Mixture-of-Gaussians (MoG) Classifier
    │ (Unsupervised Gaussian clustering into operational regimes)
    ▼
Stage 3: Isolation Forest Anomaly Detection
    │ (Multivariate anomaly scoring on continuous SCADA telemetry)
    ▼
Stage 4: Equipment Risk Engine (0–100)
    │ (Blends anomaly score, asset age, and physical condition)
    ▼
Stage 5: NASA POWER Weather Risk Multiplier
    │ (Dynamic precipitation, wind shear, and thunderstorm scaling)
    ▼
Stage 6: Composite Outage Risk Calculation
      (Weighted multi-factor score: Equipment + Weather + Impact + Criticality)
```

**Trained ML Artifacts (`src/backend/app/ml/artifacts/`):**
- `isolation_forest_model.pkl`: Scikit-learn Isolation Forest model for anomaly detection.
- `isolation_preprocessor.pkl`: StandardScaler transformer fitted on nominal SCADA baselines.
- `mog_classifier.pkl`: Gaussian Mixture Model for regime classification.
- `equipment_risk_engine.pkl`: Calibrated equipment risk evaluator.
- `weather_risk_engine.pkl`: Weather stress interaction model.
- `nasa_power_weather_raw.csv`: NASA POWER satellite meteorological dataset.

### 2. IBM Bob AI Conversational Reasoning Boundary
The AI Operations Advisor (`/advisor`) connects directly to the **IBM Bob AI API**:
- **Endpoint:** `https://api.us-east.bob.ibm.com/inference/v1/chat/completions`
- **Model:** `fast` (Granite architecture)
- **Fleet-Wide Dynamic Context:** Ingests live telemetry across all 26 assets, 5 grid zones, active weather alerts, and 5 maintenance crews on every query.
- **Dual-Mode Reasoning:** Defaults to system-wide fleet intelligence, switching to deep-dive root-cause diagnostics when a specific asset ID (e.g., `TR-104`) is detected.
- **Failover Safety:** Includes an intelligent rule-based heuristic fallback if cloud API connectivity is interrupted.

### 3. Asynchronous Background ML & Weather Worker
To eliminate UI latency during continuous sensor ingestion and weather updates:
- **Background Execution:** `MLBackgroundService` runs multi-stage ML re-evaluations asynchronously using FastAPI background tasks.
- **Pre-Computed Database Persistence:** Evaluated failure probabilities, health scores, anomaly flags, and equipment risk scores are written back to the SQLite `assets` record (`last_ml_run_at`).
- **Real-Time SSE Streaming:** Live connected web clients subscribe to Server-Sent Events (`/api/ml/stream`), automatically re-rendering dashboard KPIs and risk maps as data updates without page refreshes.

### 4. IoT Device Push Ingestion & Python SDK Architecture
For edge hardware integration (e.g., Raspberry Pi, substation gateways, SCADA RTUs):
- **Zero-Dependency Python SDK (`src/iot_sdk`):** Lightweight client library using standard library `urllib` only. Supports single/batch reading posts, auto-collection threads, offline local sqlite buffering, and exponential backoff retry logic.
- **Authentication:** Devices authenticate via lightweight API keys generated upon registration (`X-API-Key` HTTP header).
- **Automated ML Scoring Pipeline:** Every ingested telemetry batch triggers immediate 6-stage ML inference, logging results to `iot_telemetry_logs` and triggering composite risk recalculations.

### 5. Pluggable ML Predictor Contract
For external model integration, the backend exposes an isolated ML prediction endpoint (`POST /api/ml/predict`):
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
    "model_version": "pipeline-v1"
  }
  ```

---

## Composite Risk Engine Formula

$$\text{Final Risk Score} = (w_{\text{eq}} \times S_{\text{eq}}) + (w_{\text{weather}} \times S_{\text{weather}}) + (w_{\text{impact}} \times S_{\text{impact}}) + (w_{\text{crit}} \times S_{\text{crit}})$$

Where weights and factors are configured as:
- $w_{\text{eq}} = 0.40$ (Equipment Risk Score 0–100 from ML Pipeline)
- $w_{\text{weather}} = 0.20$ (Weather Risk Score 0–100 from NASA POWER)
- $w_{\text{impact}} = 0.25$ (Grid & Customer Disruption Score 0–100)
- $w_{\text{crit}} = 0.15$ (Asset Criticality Index 0–100)

**Risk Classification Thresholds:**
- `0–24.9`: **LOW** (Routine periodic monitoring)
- `25.0–49.9`: **MEDIUM** (Operational baseline surveillance)
- `50.0–74.9`: **HIGH** (Priority maintenance inspection required)
- `≥ 75.0`: **CRITICAL** (Immediate dispatch & contingency load transfer)

---

## Single-Container Docker Architecture

```text
Host Port 3000 (or 80)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Docker Container (Single Image)             │
│                                                              │
│   Nginx (Port 80) ─── Supervisord (Process Manager)          │
│     ├── /        ───> Serves React SPA (Static Production)   │
│     └── /api/*   ───> Reverse Proxy ──> Uvicorn (Port 8000) │
│                                                │             │
│                                        FastAPI Application   │
│                                                │             │
│                                          SQLite DB           │
│                                      (/app/gridguard.db)     │
└──────────────────────────────────────────────────────────────┘
```

---

## Relational Database Schema

- **`assets`**: `id`, `name`, `asset_type`, `substation`, `grid_zone`, `latitude`, `longitude`, `capacity_mva`, `load_mw`, `health_score`, `criticality_score`, `customers_affected`, `status`, `installed_date`, `last_maintenance`, `failure_probability`, `equipment_risk`, `weather_risk`, `is_anomaly`, `last_ml_run_at` (26 high-voltage assets across 5 zones).
- **`sensor_readings`**: `id`, `asset_id`, `timestamp`, `temperature`, `vibration`, `partial_discharge`, `oil_quality`, `load`, `ambient_temperature` (2,600+ readings).
- **`iot_devices`**: `id`, `device_name`, `api_key_hash`, `asset_id`, `device_type`, `is_active`, `is_simulated`, `created_at`, `last_heartbeat` (IoT edge hardware devices).
- **`iot_telemetry_logs`**: `id`, `device_id`, `asset_id`, `timestamp`, `temperature`, `vibration`, `partial_discharge`, `oil_quality`, `load`, `failure_prob`, `prediction_label`, `is_anomaly` (IoT push telemetry audit log).
- **`weather_forecasts`**: `id`, `zone`, `zone_name`, `timestamp`, `condition`, `rainfall_prob`, `rainfall_intensity_mm`, `wind_kmh`, `lightning_risk`, `flood_risk`, `weather_risk_level`, `weather_score`, `temperature_c` (NASA POWER aligned).
- **`incidents`**: `id`, `asset_id`, `timestamp`, `failure_type`, `severity`, `duration_minutes`, `customers_affected`, `root_cause`, `weather_condition`, `resolution`, `location`.
- **`crews`**: `id`, `name`, `status`, `depot_name`, `latitude`, `longitude`, `skills`, `equipment`, `available_from`, `assigned_asset_id` (5 specialized crews).
- **`maintenance_actions`**: `id`, `asset_id`, `crew_id`, `priority`, `action`, `status`, `scheduled_time`, `estimated_duration_hours`, `reason`, `expected_risk_reduction_pct`.
- **`demo_scenario_state`**: `id`, `current_stage`, `last_updated` (Stages 1, 2, 3 for TR-104 live simulation).
