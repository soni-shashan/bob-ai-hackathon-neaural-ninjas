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
1. **Asset Health Sensor Telemetry** (Temperature, Vibration, Partial Discharge, Oil Quality, Load)
2. **ML-Based Transformer & Equipment Failure Inference**
3. **Meteorological Risk & Synoptic Storm Radar Tracking**
4. **Asset Criticality & Substation Topology**
5. **Downstream Customer & MW Load Exposure**
6. **Field Crew Proximity, Certifications, and Equipment Availability**

into an end-to-end resilience workflow:

$$\text{\bf Prediction} \longrightarrow \text{\bf Risk Assessment} \longrightarrow \text{\bf Prioritization} \longrightarrow \text{\bf Maintenance Interventions} \longrightarrow \text{\bf Crew Pre-positioning}$$

---

## 📐 Architecture & ML Integration Boundary

```text
┌─────────────────────────────────────────────────────────────┐
│                 React 18 + Vite Frontend                    │
│      (Dark Industrial Operations Center / Tailwind CSS)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST APIs (/api/*)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                         │
│  ├── Composite Risk Engine                                  │
│  ├── Maintenance Dispatch & Crew Optimizer                  │
│  ├── AI Advisor Structured Reasoning Engine                 │
│  ├── Interactive TR-104 Demo Simulator Controller           │
│  └── Isolated ML Service Integration Boundary               │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│       SQLite Database        │ │ Teammate's ML Model        │
│ (26 Assets, 2,600+ Sensors,  │ │ (Pluggable via             │
│  Incidents, Forecasts, Crews)│ │  POST /api/ml/predict)     │
└──────────────────────────────┘ └────────────────────────────┘
```

### 🤝 Pluggable ML Model Boundary (Zero Frontend Coupling)
The frontend communicates exclusively with `POST /api/ml/predict`. The ML model is isolated behind `src/backend/app/services/ml_service.py`. When your teammate's ML model is ready, update `src/backend/.env`:
```env
USE_EXTERNAL_ML_SERVICE=true
EXTERNAL_ML_SERVICE_URL="http://friend-ml-api:8001/predict"
```
No frontend modifications are needed!

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

### 1. Install Dependencies
```powershell
# Backend
cd src/backend
python -m pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Run the Application
```powershell
# Terminal 1: Backend
cd src/backend
$env:PYTHONPATH="."
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd src/frontend
npm run dev
```

- **Operations Dashboard:** `http://localhost:5173`
- **FastAPI Interactive Docs:** `http://localhost:8000/docs`
- **Backend Health Check:** `http://localhost:8000/api/health`

### 3. Run Automated Tests
```powershell
cd src/backend
$env:PYTHONPATH="."
python -m pytest tests/test_api.py -v
```

---

## 🗺️ Application Routes

| Route | View | Description |
|---|---|---|
| `/dashboard` | Operations Center | KPI cards, interactive SVG schematic grid topology, top risk assets, 24h risk trend chart, active alerts. |
| `/assets` | Fleet Inventory | Multi-facet filtering (risk level, type, location), search, sorting, and pagination across all 248 grid assets. |
| `/assets/:assetId` | Asset Detail & SCADA | 5 sensor time-series charts (Temp, Vib, PD, Oil, Load), health diagnostics, explainable risk factors, weather stress decomposition, and action plan. |
| `/risk-map` | Geospatial Observatory | Full-screen interactive map with Doppler storm radar overlay, substation coordinates, and slide-out asset drawer. |
| `/maintenance` | Dispatch Planner | Prioritized action queue, crew pre-positioning recommendations, skill and equipment matching, and one-click crew assignment. |
| `/weather` | Meteorological Intel | Multi-zone grid risk table, active Doppler alerts, and 7-day synoptic forecast. |
| `/incidents` | Reliability Archive | Historical failure log, root-cause forensics, restoration durations, and weather correlations. |
| `/advisor` | Decision-Support AI | Structured operator reasoning engine with evidence, recommended actions, and outage avoidance estimates. |
| `/settings` | Engine Tuning | Composite risk weights sliders, classification thresholds, and ML model integration status. |

---

## 🧪 Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React, React Router DOM
- **Backend:** Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, HTTPX, Pytest
- **Database:** SQLite (Relational ORM with pre-seeded deterministic grid datasets)
- **Deployment:** Self-contained, zero external mandatory cloud dependencies for local demonstration.
