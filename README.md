# GridGuard AI

> **Predictive Grid Resilience & Equipment Failure Advisor**  
> *Built for the IBM Bob Hackathon by Team Neural Ninjas*

---

## ⚡ The Problem

Power transformers and substation equipment suffer catastrophic failures that cause expensive outages, severe equipment damage, and risk to public safety. Currently, utilities rely primarily on calendar-based maintenance schedules even though sensor telemetry (temperature, acoustic vibration, partial discharge, dielectric oil quality, load) can reveal degradation long before failure occurs.

Furthermore, extreme weather events (such as severe thunderstorms, torrential rain, and high wind shear) drastically heighten equipment stress, but asset condition data and meteorological forecasts remain siloed.

---

## 🛡️ The Solution

**GridGuard AI** bridges this gap by unifying:
1. **Asset Health Sensor Telemetry & IoT Push Ingestion** (Temperature, Vibration, Partial Discharge, Oil Quality, Load via REST API & Zero-Dependency Python IoT SDK)
2. **ML-Based Transformer & Equipment Failure Inference** (6-stage pipeline: IEEE C57.91 Health Score → MoG Classifier → Isolation Forest Anomaly Detection → Equipment Risk → NASA POWER Weather Risk → Composite Risk with Async Background Worker & SSE Live Stream)
3. **Meteorological Risk & Synoptic Storm Radar Tracking** (Live NASA POWER satellite weather data)
4. **Asset Criticality & Substation Topology** (26 monitored assets across 5 grid zones)
5. **Downstream Customer & MW Load Exposure**
6. **Field Crew Proximity, Certifications, and Equipment Availability** (5 specialized crews)
7. **IBM Bob AI Real-Time Conversational Advisor** (Fleet-wide reasoning across all 26 assets)

into an end-to-end resilience workflow:

$$\text{\bf Prediction} \longrightarrow \text{\bf Risk Assessment} \longrightarrow \text{\bf Prioritization} \longrightarrow \text{\bf Maintenance Interventions} \longrightarrow \text{\bf Crew Pre-positioning}$$

---

## 📐 Architecture & ML Integration Boundary

```text
┌─────────────────────────────────────────────────────────────┐
│             React 18 + Vite Frontend & IoT Stream           │
│      (Dark Industrial Operations Center / Tailwind CSS)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST APIs (/api/*) & SSE Live Stream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                         │
│  ├── Composite Risk Engine (4-Weight Formula)               │
│  ├── Maintenance Dispatch & Crew Optimizer (5 Crews)        │
│  ├── IBM Bob AI Advisor (Fleet-Wide Reasoning Engine)       │
│  ├── Real-Time IoT Device Ingestion Engine (/api/iot/*)     │
│  ├── Async Background ML & Weather Worker (SSE Broadcast)   │
│  ├── Interactive TR-104 Demo Simulator Controller           │
│  ├── NASA POWER Weather Integration Engine                  │
│  └── 6-Stage ML Pipeline (Health → MoG → IsoForest → Risk) │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│       SQLite Database        │ │   IBM Bob AI API           │
│ (26 Assets, 2,600+ Sensors,  │ │   (Granite/fast Model)     │
│  IoT Devices & Telemetry Logs│ │   Real-Time LLM Reasoning  │
│  Incidents, Forecasts, Crews)│ │                            │
└──────────────────────────────┘ └────────────────────────────┘
```

### 🤖 IBM Bob AI Integration
The **AI Operations Advisor** (`/advisor`) is powered by IBM Bob AI API using the Granite/fast model. It provides fleet-wide conversational reasoning across all 26 assets and 5 grid zones. The advisor:
- Answers general fleet health, maintenance plan, and crew staging questions with full system context
- Provides asset-specific deep analysis when asked about a particular asset (e.g., TR-104)
- Falls back to rule-based heuristic reasoning if the API is unavailable

### 🤝 Pluggable ML Model Boundary (Zero Frontend Coupling)
The frontend communicates exclusively with `POST /api/ml/predict`. The ML model is isolated behind `src/backend/app/services/ml_service.py`. When your teammate's ML model is ready, update `src/backend/.env`:
```env
USE_EXTERNAL_ML_SERVICE=true
EXTERNAL_ML_SERVICE_URL="http://friend-ml-api:8001/predict"
```
No frontend modifications are needed!

---

## 🧠 ML Pipeline (6-Stage Architecture)

```text
Stage 1: IEEE C57.91 Physics Health Score
    ↓
Stage 2: Mixture-of-Gaussians (MoG) Classifier → MOG_risk_label
    ↓
Stage 3: Isolation Forest Anomaly Detection → anomaly_flag + anomaly_score
    ↓
Stage 4: Equipment Risk Engine → equipment_risk_score (0-100)
    ↓
Stage 5: NASA POWER Weather Risk Engine → weather_risk_multiplier
    ↓
Stage 6: Composite Risk = 0.40×Equipment + 0.20×Weather + 0.25×Impact + 0.15×Criticality
```

**Trained Model Artifacts** (stored in `src/backend/app/ml/artifacts/`):
- `isolation_forest_model.pkl` — Isolation Forest anomaly detector
- `mog_classifier.pkl` — Mixture-of-Gaussians classifier
- `weather_risk_engine.pkl` — Weather stress multiplier model
- `equipment_risk_engine.pkl` — Equipment degradation scorer
- `nasa_power_weather_raw.csv` — Live NASA POWER satellite weather data

---

## 🎬 Hackathon 5-Minute Demo Scenario: TR-104

GridGuard AI includes a built-in **Interactive Demo Simulator Bar** located at the top of the interface:

1. **Stage 1 — Baseline Nominal Operations:**
   - Asset **TR-104** at Naroda Substation operates under normal telemetry (Risk Score: **42/100**, Health: **72/100**, Status: `OPERATIONAL`).
   - Maintenance Queue ranks TR-104 at **Priority #4** (Routine scan).
2. **Stage 2 — Incipient Degradation:**
   - Transformer temperature rises +10°C, vibration harmonics elevate, and partial discharge climbs to 28.5 pC (Risk Score: **68/100**, Status: `WARNING`).
   - Maintenance Queue promotes TR-104 to **Priority #2**.
3. **Stage 3 — Storm Alert & Critical Spike:**
   - Partial discharge surges **+31%** (42 pC), winding temp reaches **91.2°C**, and a severe thunderstorm (48.5 mm/h downpours, 52 km/h wind) hits the Eastern Grid corridor.
   - Risk Engine evaluates composite risk at **94/100 (CRITICAL)** with **82% Failure Likelihood**.
   - Risk decomposition breaks down: **Base Equipment Risk (68) + Weather Stress (+26) = Final Risk (94)**.
   - Maintenance Planner automatically moves TR-104 to **Priority #1** and recommends pre-positioning **Crew 2** (staged 10 km from Naroda with thermal imaging and oil testing gear).

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Docker (optional, for containerized deployment)

### Option 1: Docker Deployment (Recommended)

```bash
# Build and run with Docker Compose
docker compose up --build

# Access the application
# → Dashboard:  http://localhost:3000
# → API Health: http://localhost:3000/api/health
```

Or with plain Docker:
```bash
docker build -t gridguard-ai .
docker run -p 3000:80 gridguard-ai
```

### Option 2: Local Development

#### 1. Install Dependencies
```bash
# Backend
cd src/backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

#### 2. Run the Application
```bash
# Terminal 1: Backend
cd src/backend
PYTHONPATH="." python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd src/frontend
npm run dev
```

- **Operations Dashboard:** `http://localhost:5173`
- **FastAPI Interactive Docs:** `http://localhost:8000/docs`
- **Backend Health Check:** `http://localhost:8000/api/health`

### 3. Login Credentials
```
Email:    neaural.ninjas@electricity.com
Password: Admin@123
```

### 4. Run Automated Tests
```bash
cd src/backend
PYTHONPATH="." python -m pytest tests/test_api.py -v
# Expected: 22/22 tests passed
```

---

## 🗺️ Application Routes

| Route | View | Description |
|---|---|---|
| `/dashboard` | Operations Center | KPI cards (Grid Health Index, Active Alerts, Critical/High/Medium/Low risk distribution with percentages), interactive SVG schematic grid topology, top risk assets, 24h risk trend chart. |
| `/assets` | Fleet Inventory | Multi-facet filtering (risk level, type, location), search, sorting, and pagination across all 26 monitored grid assets. |
| `/assets/:assetId` | Asset Detail & SCADA | 5 sensor time-series charts (Temp, Vib, PD, Oil, Load), health diagnostics, explainable risk factors, weather stress decomposition, and action plan. |
| `/risk-map` | Geospatial Observatory | Full-screen interactive map with Doppler storm radar overlay, substation coordinates, and slide-out asset drawer. |
| `/maintenance` | Dispatch Planner | Prioritized action queue (5 priority levels), crew pre-positioning recommendations, skill and equipment matching, and one-click crew assignment. |
| `/weather` | Meteorological Intel | Multi-zone grid risk table (5 zones), active Doppler alerts, and 7-day synoptic forecast from NASA POWER satellite data. |
| `/iot` | IoT Live Stream UI | Real-time IoT push telemetry ingestion monitor, device registration, Python IoT SDK live streaming & hardware connectivity manager. |
| `/incidents` | Reliability Archive | Historical failure log, root-cause forensics, restoration durations, and weather correlations. |
| `/advisor` | AI Operations Advisor | IBM Bob AI-powered fleet-wide conversational reasoning engine with evidence-backed recommendations, maintenance plans, storm vulnerability analysis, and crew staging guidance. |
| `/settings` | Engine Tuning | Composite risk weights sliders, classification thresholds, and ML model integration status. |

---

## 🧪 Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, Leaflet, Lucide React, React Router DOM
- **Backend:** Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, HTTPX, Pytest, SSE Streaming
- **IoT & SDK:** Python IoT Client Library (`src/iot_sdk`), `X-API-Key` Device Authentication, Offline Buffer & Auto-Sync
- **ML/AI:** Scikit-learn (Isolation Forest, ExtraTrees), IBM Bob AI API (Granite/fast), IEEE C57.91 Physics Model
- **Database:** SQLite (Relational ORM with 26 pre-seeded deterministic grid assets, IoT devices & telemetry logs)
- **Weather:** NASA POWER Satellite API (Live meteorological data integration)
- **Deployment:** Docker, Nginx, Supervisord (single-container production deployment)

---

## 📁 Project Structure

```text
bob-ai-hackathon-neaural-ninjas/
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # One-command deployment
├── docker/
│   ├── nginx.conf                # Reverse proxy + SPA serving
│   ├── supervisord.conf          # Process manager (Nginx + Uvicorn)
│   └── start.sh                  # Container startup script
├── src/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/              # REST API route handlers (incl. /iot, /advisor, /ml)
│   │   │   ├── models/           # SQLAlchemy ORM models (Asset, IoTDevice, IoTLog)
│   │   │   ├── schemas/          # Pydantic request/response schemas
│   │   │   ├── services/         # Business logic (advisor, risk, ML, IoT, ML background)
│   │   │   ├── ml/               # ML pipeline & trained model artifacts
│   │   │   ├── seed/             # Database seed data
│   │   │   ├── config.py         # Application configuration
│   │   │   └── main.py           # FastAPI app entry point
│   │   ├── tests/                # Automated API tests
│   │   └── requirements.txt      # Python dependencies
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── pages/            # 11 application pages (incl. IoT Live Stream)
│   │   │   ├── components/       # Reusable UI components
│   │   │   └── services/         # API client services
│   │   ├── package.json          # Node.js dependencies
│   │   └── vite.config.ts        # Vite + proxy configuration
│   ├── iot_sdk/                  # Zero-dependency Python IoT Client Library & SDK
│   │   ├── gridguard_iot/        # Client package
│   │   └── README.md             # IoT SDK installation & usage guide
│   ├── dataset.md                # Data source documentation
│   ├── models.md                 # ML model architecture documentation
│   └── pipeline.md               # Training & inference pipeline docs
├── submission.yaml               # Hackathon submission metadata
└── README.md                     # This file
```

---

## 👥 Team Neural Ninjas

| Role | Name | Email |
|---|---|---|
| Team Lead | Shashan Lumbhani | 23cs042@charusat.edu.in |
| Member | Nikhil Vaghela | 23dce124@charusat.edu.in |
| Member | Vinay Trivedi | 23it134@charusat.edu.in |
| Member | Het Prajapati | 23dce100@charusat.edu.in |
