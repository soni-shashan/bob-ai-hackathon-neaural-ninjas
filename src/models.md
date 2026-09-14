# 🧠 GridGuard AI — Models Documentation

## Architecture Overview

GridGuard AI employs a **multi-stage ensemble pipeline** that combines physics-based engineering models with machine learning for transformer fault prediction, anomaly detection, and weather-adjusted risk scoring.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    GRIDGUARD AI MODEL ENSEMBLE                       │
│                                                                      │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐   │
│  │  Stage 1: IEEE   │   │  Stage 2: MOG     │   │  Stage 3:       │   │
│  │  C57.91 Physics  │   │  ExtraTrees       │   │  Isolation      │   │
│  │  Health Score    │   │  Classifier       │   │  Forest         │   │
│  │  (Deterministic) │   │  (Supervised)     │   │  (Unsupervised) │   │
│  └────────┬────────┘   └────────┬──────────┘   └────────┬────────┘   │
│           │                     │                       │            │
│           └─────────┬───────────┴───────────────────────┘            │
│                     ▼                                                │
│        ┌────────────────────────────┐                                │
│        │  Stage 4: Equipment Risk   │                                │
│        │  Composite Fusion Engine   │                                │
│        └────────────┬───────────────┘                                │
│                     ▼                                                │
│        ┌────────────────────────────┐                                │
│        │  Stage 5: NASA POWER       │                                │
│        │  Weather Risk Engine       │                                │
│        └────────────────────────────┘                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Stage 6: IBM Bob AI — Real-Time LLM Reasoning Engine       │    │
│  │  (Contextual Advisory / Operator Decision Support)          │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: IEEE C57.91 Physics Health Score Engine

**File:** `src/backend/app/ml/health_score.py`  
**Type:** Deterministic physics-based model  
**Standard:** IEEE C57.91 (Transformer Loading & Thermal Guidelines)

### Scoring Mechanism

Computes a **100-point health score** using three penalty domains:

| Penalty Domain | Max Penalty | Signals Used |
|---|---|---|
| **Thermal Penalty** | 35 pts | OTI, WTI, ATI (oil temp, winding temp, ambient temp) |
| **Oil/Alarm Penalty** | 35 pts | OLI (oil level), OTI_A (alarm), OTI_T (trip) |
| **Electrical Penalty** | 30 pts | VL1-3 (voltages), IL1-3 (currents), INUT (neutral) |

**Formula:** `Health Score = 100 - (Thermal + Oil/Alarm + Electrical)`

### Health Categories

| Score Range | Category | Action Level |
|---|---|---|
| 80–100 | ✅ Healthy | Routine monitoring |
| 60–79 | 🟡 Normal | Standard operations |
| 40–59 | 🟠 Warning | Increased monitoring |
| 0–39 | 🔴 Critical | Immediate intervention |

### Key Physics Rules

- **OTI Penalty:** Ramps from 0 at ≤60°C to 20 pts at ≥90°C
- **WTI Penalty:** Ramps from 0 at ≤70°C to 15 pts at ≥100°C
- **Temperature Rise:** Penalty if (OTI − ATI) exceeds 35°C (IEEE hot-spot limit)
- **Voltage Unbalance:** NEMA MG-1 threshold — penalty above 1.5% phase unbalance
- **Neutral Current:** Penalty when neutral-to-average ratio exceeds 0.35

---

## Stage 2: MOG_A Supporting Classifier

**File:** `src/backend/app/ml/mog_classifier.py`  
**Type:** Supervised classification  
**Algorithm:** `ExtraTreesClassifier` (100 estimators, scikit-learn)  
**Preprocessing:** `MinMaxScaler`  
**Target:** `MOG_A` (Magnetic Oil Gauge Alarm — binary 0/1)

### Features (16 input signals)

```
OTI, WTI, ATI, OLI, OTI_A, OTI_T,
VL1, VL2, VL3, IL1, IL2, IL3,
VL12, VL23, VL31, INUT
```

### Output

| Field | Description |
|---|---|
| `mog_predicted` | Binary alarm prediction (0 or 1) |
| `mog_probability` | Continuous probability [0.0, 1.0] |
| `mog_risk_contribution` | Scaled risk contribution [0–100] |

### Artifacts

- `mog_classifier.pkl` — Trained ExtraTreesClassifier model (~169 KB)
- `mog_preprocessor.pkl` — Fitted MinMaxScaler (~1.6 KB)

---

## Stage 3: Condition-Aware Anomaly Detection

**File:** `src/backend/app/ml/anomaly_detector.py`  
**Type:** Unsupervised anomaly detection  
**Algorithm:** `IsolationForest` (150 estimators, 5% contamination, scikit-learn)  
**Preprocessing:** `StandardScaler`

### Engineered Features (5 condition-normalized signals)

| Feature | Description | Physics Basis |
|---|---|---|
| `temp_residual` | Load-adjusted thermal deviation | OTI − ATI minus expected rise from linear load model |
| `v_unbalance_pct` | 3-phase voltage unbalance (%) | Max phase deviation / average voltage × 100 |
| `v_nominal_dev_pct` | Nominal voltage deviation (%) | Distance from 240V nominal |
| `i_unbalance_pct` | 3-phase current unbalance (%) | Max phase deviation / average current × 100 |
| `oli_low_risk` | Low oil level risk | max(0, 40 − OLI) |

### Thermal Baseline Model

A linear regression fits the expected temperature rise as a function of load current (fitted on training data only):

```
Expected Rise = slope × I_avg + intercept
Temp Residual = Actual Rise − Expected Rise
```

**Trained Parameters:** slope ≈ 0.0397, intercept ≈ −0.2776

### Output

| Field | Description |
|---|---|
| `is_anomaly` | Boolean anomaly flag |
| `decision_score` | Isolation Forest decision function value |
| `normalized_anomaly_risk` | Risk score [0–100], higher = more anomalous |

### Artifacts

- `isolation_forest_model.pkl` — Trained IsolationForest (~1.6 MB)
- `isolation_preprocessor.pkl` — Fitted StandardScaler (~1 KB)
- `isolation_features.pkl` — Feature column names
- `anomaly_threshold.pkl` — Threshold config, thermal baseline, score normalization bounds

---

## Stage 4: Equipment Failure Risk Engine

**File:** `src/backend/app/ml/equipment_risk.py`  
**Type:** Weighted composite fusion  
**Approach:** Aggregates outputs from Stages 1–3 into a unified risk score

### Fusion Weights

| Component | Weight | Source |
|---|---|---|
| **Health Risk** | 55% | `100 − health_score` (Stage 1) |
| **Anomaly Risk** | 35% | `normalized_anomaly_risk` (Stage 3) |
| **MOG Risk** | 10% | `mog_probability × 100` (Stage 2) |

### Risk Classification Thresholds

| Score | Level | Operational Response |
|---|---|---|
| ≥ 75 | 🔴 Critical | Immediate engineering review and field inspection |
| ≥ 50 | 🟠 High | Prioritized inspection and maintenance scheduling |
| ≥ 25 | 🟡 Medium | Increased monitoring frequency |
| < 25 | ✅ Low | Continue routine monitoring |

### Root-Cause Explainability

The engine identifies the **dominant risk factor** driving each prediction:
- `Thermal/health deterioration` — Physics degradation is the primary driver
- `Sensor anomaly` — Unsupervised model detected abnormal sensor patterns
- `Combined deterioration` — Both health and anomaly scores are significantly elevated
- `MOG alarm` — Oil gauge alarm model flags dielectric risk

---

## Stage 5: NASA POWER Weather Risk Engine

**File:** `src/backend/app/ml/weather_engine.py`  
**Type:** Physics-based environmental risk model  
**Data Source:** [NASA POWER API](https://power.larc.nasa.gov/api/) — real satellite-derived meteorology

### Component Risk Weights

| Factor | Weight | Critical Threshold |
|---|---|---|
| Temperature | 35% | > 42°C extreme heat stress |
| Wind Speed | 30% | > 14 m/s gale-force debris risk |
| Precipitation | 20% | > 7.6 mm/h heavy rainfall (flood risk) |
| Humidity | 15% | > 95% insulation condensation risk |

### Bounded Weather-Equipment Interaction

Weather risk is **bounded** to a maximum 20-point boost on top of the equipment risk score, ensuring weather cannot overwhelm the equipment condition signal:

```
Weather Boost = min(20, weather_mod + interaction_mod)
Final Score = Equipment Risk + Weather Boost
```

The interaction term (`norm_equip × norm_weather × 14.0`) ensures weather amplifies risk proportionally more for already-degraded equipment.

---

## Stage 6: IBM Bob AI — Real-Time LLM Advisory Engine

**File:** `src/backend/app/services/advisor_service.py`  
**Type:** Large Language Model (LLM) conversational reasoning  
**Provider:** IBM Bob AI API (`ibm-bob-ai/fast`)  
**Scope:** Entire 26-asset grid fleet

### Context Injection

Every query injects a **live operational snapshot** into the LLM context:
- Fleet-wide asset health metrics across 5 grid zones
- All critical and high-risk assets with real telemetry values
- Live Doppler weather conditions per corridor
- Field crew deployment status and logistics
- Active prioritized maintenance queue

### Scope Behavior

- **General queries** → System-wide fleet reasoning (no single-asset pinning)
- **Asset-specific queries** (e.g., "TR-104") → Targeted diagnostics for that asset
- **Fallback:** Local heuristic engine with 7 rule categories guarantees zero-failure offline operation
