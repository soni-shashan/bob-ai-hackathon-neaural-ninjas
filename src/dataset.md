# 📊 GridGuard AI — Dataset Documentation

## Overview

GridGuard AI ingests real-world power transformer SCADA telemetry data from industrial IoT monitoring systems. The primary dataset contains high-frequency sensor readings from a distribution transformer captured over approximately **10 months** of continuous operation (June 2019 — April 2020).

---

## Primary Source Data (Archive)

| File | Records | Columns | Description |
|------|---------|---------|-------------|
| `Overview.csv` | 20,316 | 8 | Thermal, oil level, and alarm telemetry |
| `CurrentVoltage.csv` | 19,352 | 11 | 3-phase electrical measurements |
| `Power.csv` | — | — | Active power readings |
| `PowerFactor.csv` | — | — | Power factor measurements |
| `TotalPower.csv` | — | — | Aggregate power consumption |

**Source Path:** `/home/shashansoni/Downloads/archive/`  
**Time Range:** `2019-06-25T13:06` → `2020-04-14T00:30` (~10 months continuous)  
**Sampling Rate:** ~30 minutes per observation

---

## Feature Dictionary

### Overview.csv — Thermal & Oil Telemetry

| Column | Full Name | Unit | Description |
|--------|-----------|------|-------------|
| `DeviceTimeStamp` | Timestamp | ISO 8601 | SCADA recording timestamp |
| `OTI` | Oil Temperature Indicator | °C | Top oil temperature of transformer |
| `WTI` | Winding Temperature Indicator | °C | Hottest-spot winding temperature |
| `ATI` | Ambient Temperature Indicator | °C | Surrounding ambient air temperature |
| `OLI` | Oil Level Indicator | % | Conservator oil level (40–85% nominal) |
| `OTI_A` | Oil Temperature Alarm | Binary | Hardware thermal alarm trigger (0/1) |
| `OTI_T` | Oil Temperature Trip | Binary | Hardware thermal trip trigger (0/1) |
| `MOG_A` | Magnetic Oil Gauge Alarm | Binary | Oil gauge alarm (target for MOG classifier) |

### CurrentVoltage.csv — Electrical Measurements

| Column | Full Name | Unit | Description |
|--------|-----------|------|-------------|
| `DeviceTimeStamp` | Timestamp | ISO 8601 | SCADA recording timestamp |
| `VL1` | Phase L1 Voltage | V | Line-to-neutral voltage phase 1 |
| `VL2` | Phase L2 Voltage | V | Line-to-neutral voltage phase 2 |
| `VL3` | Phase L3 Voltage | V | Line-to-neutral voltage phase 3 |
| `IL1` | Phase L1 Current | A | Line current phase 1 |
| `IL2` | Phase L2 Current | A | Line current phase 2 |
| `IL3` | Phase L3 Current | A | Line current phase 3 |
| `VL12` | Line-to-Line Voltage L1-L2 | V | Derived inter-phase voltage |
| `VL23` | Line-to-Line Voltage L2-L3 | V | Derived inter-phase voltage |
| `VL31` | Line-to-Line Voltage L3-L1 | V | Derived inter-phase voltage |
| `INUT` | Neutral Current | A | Ground/neutral return current |

---

## Derived / Processed Datasets (ML Artifacts)

After the ML training pipeline executes, the following processed datasets are generated and stored in `src/backend/app/ml/artifacts/`:

| File | Rows | Description |
|------|------|-------------|
| `weather_adjusted_risk.csv` | ~19,000 | Full telemetry with health scores, anomaly flags, equipment risk, and NASA POWER weather-adjusted risk |
| `equipment_risk_ranking.csv` | ~19,000 | Equipment risk ranking with failure probabilities sorted by composite score |
| `equipment_risk_predictions.csv` | ~19,000 | Raw equipment risk model output with root-cause contributions |
| `nasa_power_weather_raw.csv` | ~8,800 | Historical NASA POWER meteorological observations for Ahmedabad region |
| `gridguard_step1_3_final_predictions.csv` | — | Intermediate: Health + Anomaly + MOG predictions merged |
| `gridguard_step3_final_predictions.csv` | — | Intermediate: Physics health scores + feature engineering |

---

## NASA POWER Weather Data

**Source:** [NASA POWER API](https://power.larc.nasa.gov/api/)  
**Location:** Ahmedabad, Gujarat, India (23.0225°N, 72.5714°E)  
**Parameters:** Temperature (T2M), Relative Humidity (RH2M), Wind Speed (WS10M), Precipitation (PRECTOTCORR)  
**Resolution:** Hourly observations  
**Period:** Aligned with transformer telemetry timeframe

---

## Data Preparation Steps

1. **Merge** `Overview.csv` and `CurrentVoltage.csv` on `DeviceTimeStamp` (inner join)
2. **Sort** chronologically by timestamp
3. **Deduplicate** exact duplicate rows
4. **Result:** ~19,000 clean, time-ordered telemetry records representing continuous transformer operation

---

## Fleet Simulation

The 26-asset regional grid fleet is simulated by sampling different temporal slices of the primary telemetry dataset, applying zone-specific perturbations and load scaling:

| Zone | Assets | Slice Strategy |
|------|--------|----------------|
| East Grid | 10 | Critical degradation window (peak-risk slices) |
| North Grid | 5 | Moderate operational stress slices |
| Central Grid | 4 | Nominal operational baseline |
| South Grid | 4 | Moderate wind/thermal stress |
| West Grid | 3 | Healthy operational baseline |

Each asset receives 100 continuous telemetry readings that drive real-time sensor displays, health scoring, and risk evaluation.
