# ⚙️ GridGuard AI — Pipeline Documentation

## End-to-End ML Pipeline Architecture

The GridGuard AI pipeline transforms raw SCADA telemetry into real-time predictive risk scores across a 6-stage process. Each stage builds on the previous, creating a cascading enrichment chain from sensor data to operator-actionable intelligence.

```
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                          DATA FLOW PIPELINE                                     │
 │                                                                                 │
 │  RAW TELEMETRY           FEATURE ENGINEERING        MODEL INFERENCE             │
 │  ┌──────────┐            ┌───────────────┐          ┌──────────────────┐        │
 │  │Overview  │──merge──▶  │ Thermal       │──▶ ┌──▶  │ IEEE C57.91      │──┐     │
 │  │.csv      │            │ Residuals     │   │     │ Health Score     │  │     │
 │  └──────────┘            │ Electrical    │   │     └──────────────────┘  │     │
 │  ┌──────────┐            │ Symmetry      │   │     ┌──────────────────┐  │     │
 │  │Current   │──merge──▶  │ Oil Level     │──▶├──▶  │ Isolation Forest │──┤     │
 │  │Voltage   │            │ Load-Adjusted │   │     │ Anomaly Detector │  │     │
 │  │.csv      │            └───────────────┘   │     └──────────────────┘  │     │
 │  └──────────┘                                │     ┌──────────────────┐  │     │
 │                                              └──▶  │ ExtraTrees MOG   │──┤     │
 │                                                    │ Classifier       │  │     │
 │                                                    └──────────────────┘  │     │
 │                                                                          │     │
 │  FUSION & ENRICHMENT                                                     │     │
 │  ┌─────────────────────────────────────────────────────────────────┐     │     │
 │  │                   Equipment Risk Fusion                         │◀────┘     │
 │  │          (55% Health + 35% Anomaly + 10% MOG)                  │           │
 │  └──────────────────────────┬──────────────────────────────────────┘           │
 │                             ▼                                                  │
 │  ┌─────────────────────────────────────────────────────────────────┐           │
 │  │              NASA POWER Weather Interaction                     │           │
 │  │     (Bounded ≤20pt boost, satellite meteorological data)       │           │
 │  └──────────────────────────┬──────────────────────────────────────┘           │
 │                             ▼                                                  │
 │  ┌─────────────────────────────────────────────────────────────────┐           │
 │  │               IBM Bob AI — LLM Advisory Engine                  │           │
 │  │    (Multi-turn conversational grid advisor with live context)   │           │
 │  └─────────────────────────────────────────────────────────────────┘           │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 1: Data Preparation

**Script:** `src/backend/app/ml/train_pipeline.py` → `run_pipeline()`

| Step | Action | Detail |
|---|---|---|
| 1.1 | **Load** | Read `Overview.csv` (20,316 rows) and `CurrentVoltage.csv` (19,352 rows) |
| 1.2 | **Merge** | Inner join on `DeviceTimeStamp` → ~19,000 matched records |
| 1.3 | **Parse** | Convert timestamps to `datetime64` |
| 1.4 | **Sort** | Chronological ordering for time-series integrity |
| 1.5 | **Deduplicate** | Remove exact duplicate rows |

**Output:** `modeling_df` — clean, chronologically sorted telemetry DataFrame

---

### Stage 2: MOG_A Classifier Training

**Algorithm:** `ExtraTreesClassifier(n_estimators=100, random_state=42)`  
**Preprocessing:** `MinMaxScaler`

| Step | Action |
|---|---|
| 2.1 | Identify all MOG_A alarm indices in chronological order |
| 2.2 | Split at 60% / 80% of last alarm index (train / validation / test) |
| 2.3 | Fit MinMaxScaler on training features only |
| 2.4 | Train ExtraTreesClassifier on 16 sensor features |
| 2.5 | Evaluate on held-out test set (accuracy, F1-score) |

**Artifacts Saved:**
- `mog_classifier.pkl`
- `mog_preprocessor.pkl`

---

### Stage 3: IEEE C57.91 Physics Health Score

| Step | Action |
|---|---|
| 3.1 | Apply `compute_equipment_health_score_clean()` across entire DataFrame |
| 3.2 | Compute 3 penalty domains (thermal, oil/alarm, electrical) per row |
| 3.3 | Derive health score = 100 − total penalty |
| 3.4 | Assign health category (Healthy/Normal/Warning/Critical) |

**Artifact Saved:**
- `health_score_config.json` — Penalty bounds and category thresholds

---

### Stage 4: Condition-Aware Anomaly Detection

**Algorithm:** `IsolationForest(n_estimators=150, contamination=0.05)`  
**Preprocessing:** `StandardScaler`

| Step | Action |
|---|---|
| 4.1 | Split data 60/20/20 (train/validation/test) |
| 4.2 | Fit linear thermal baseline: `ΔT = slope × I_avg + intercept` |
| 4.3 | Engineer 5 condition-normalized features |
| 4.4 | Fit StandardScaler on training features |
| 4.5 | Train IsolationForest on scaled training data |
| 4.6 | Compute decision score normalization bounds from training set |

**Artifacts Saved:**
- `isolation_forest_model.pkl` (~1.6 MB)
- `isolation_preprocessor.pkl`
- `isolation_features.pkl`
- `anomaly_threshold.pkl` (includes thermal baseline parameters)

---

### Stage 5: Equipment Risk Fusion (Runtime)

**File:** `src/backend/app/ml/equipment_risk.py`

This stage runs at **inference time** (not during training). It fuses the outputs of Stages 2–4:

```
Equipment Risk = 0.55 × (100 − Health Score)
               + 0.35 × Normalized Anomaly Risk
               + 0.10 × (MOG Probability × 100)
```

Produces:
- `equipment_risk_score` [0–100]
- `risk_level` (Critical / High / Medium / Low)
- `failure_probability` [0.01–0.99]
- `dominant_risk_factor` (root-cause explainability)
- `risk_reason` + `recommended_action` (human-readable)

---

### Stage 6: NASA POWER Weather-Equipment Interaction (Runtime)

**File:** `src/backend/app/ml/weather_engine.py`

Applies real satellite-derived weather data to modulate the equipment risk:

| Step | Action |
|---|---|
| 6.1 | Fetch live weather from NASA POWER API (or cached CSV) |
| 6.2 | Compute 4 component risks (temperature, wind, precipitation, humidity) |
| 6.3 | Weighted aggregate → `weather_risk_score` |
| 6.4 | Calculate bounded interaction: `boost = weather_mod + equip × weather × 14` |
| 6.5 | Clamp weather boost to ≤ 20 points |
| 6.6 | Final score = `equipment_risk + weather_boost` |

---

## Runtime Inference Pipeline

When the API receives a prediction request (`POST /api/ml/predict`), the following occurs in sequence:

```
Input: { oti, wti, ati, oli, oti_a, oti_t, vl1-3, il1-3, inut }
                          │
                          ▼
            ┌─── Stage 1: Health Score ──────────────┐
            │  compute_health_score_single()         │
            │  Returns: health_score, penalties       │
            └───────────────┬────────────────────────┘
                            │
            ┌─── Stage 2: MOG Alarm ─────────────────┐
            │  mog_classifier.predict_mog_alarm()    │
            │  Returns: mog_probability               │
            └───────────────┬────────────────────────┘
                            │
            ┌─── Stage 3: Anomaly Detection ─────────┐
            │  anomaly_detector.predict_anomaly()    │
            │  Returns: is_anomaly, anomaly_risk      │
            └───────────────┬────────────────────────┘
                            │
            ┌─── Stage 4: Risk Fusion ───────────────┐
            │  equipment_risk_engine.evaluate_risk()  │
            │  Returns: risk_score, risk_level,       │
            │           failure_prob, root_cause       │
            └───────────────┬────────────────────────┘
                            │
                            ▼
            Output: MLPredictResponse (JSON)
```

---

## Training Execution

To retrain all models from the raw archive data:

```bash
cd bob-ai-hackathon-neaural-ninjas
PYTHONPATH=src/backend src/backend/venv/bin/python -m app.ml.train_pipeline
```

The pipeline will:
1. Search for `Overview.csv` and `CurrentVoltage.csv` in known archive paths
2. Execute Stages 1–4 sequentially
3. Save all `.pkl` and `.json` artifacts to `src/backend/app/ml/artifacts/`
4. Print training metrics (accuracy, F1, thermal baseline parameters)

---

## Artifact Inventory

| Artifact | Size | Stage | Purpose |
|---|---|---|---|
| `mog_classifier.pkl` | 169 KB | 2 | Trained ExtraTreesClassifier |
| `mog_preprocessor.pkl` | 1.6 KB | 2 | Fitted MinMaxScaler |
| `isolation_forest_model.pkl` | 1.6 MB | 4 | Trained IsolationForest |
| `isolation_preprocessor.pkl` | 1.0 KB | 4 | Fitted StandardScaler |
| `isolation_features.pkl` | 103 B | 4 | Feature column names |
| `anomaly_threshold.pkl` | 413 B | 4 | Thermal baseline + normalization config |
| `health_score_config.json` | 392 B | 3 | Penalty bounds + category thresholds |
| `equipment_risk_config.json` | 312 B | 5 | Fusion weights + risk thresholds |
| `weather_risk_config.json` | 1.2 KB | 6 | Weather component weights |
| `nasa_power_weather_raw.csv` | 411 KB | 6 | Cached NASA POWER weather observations |
| `weather_adjusted_risk.csv` | 8.1 MB | Final | Full enriched telemetry dataset |
| `equipment_risk_ranking.csv` | 6.1 MB | Final | Ranked equipment risk predictions |

---

## Automated Testing

```bash
npm run test:backend
```

Runs 22 tests covering:
- Health score IEEE physics boundary conditions
- Anomaly detector condition-aware feature engineering
- MOG classifier inference and probability calibration
- Equipment risk fusion weights and threshold classification
- Weather engine bounded interaction constraints
- Full API integration (dashboard, assets, sensors, advisor)

All tests pass with **22/22 PASSED**.
