# Solution Overview: GridGuard AI

**GridGuard AI** is an AI-powered predictive grid resilience and equipment-failure decision-support platform engineered specifically for power utilities, transmission system operators, and regional load dispatch centers.

It unites high-frequency asset health sensors, trained machine learning failure anomaly detection, meteorological storm tracking from NASA POWER satellite data, asset criticality, downstream customer impact, and crew staging into a single continuous intelligence pipeline:

```text
Prediction → Risk Assessment → Prioritization → Maintenance Recommendation → Crew Pre-positioning
```

---

## Key Platform Capabilities

### 1. Multi-Sensor Anomaly Diagnostics & Real-Time IoT Push Ingestion
GridGuard AI ingests continuous time-series telemetry across 5 core high-voltage asset health dimensions:
- **Winding & Top-Oil Temperature (°C):** Monitors thermal rise against IEEE C57.91 operational baselines.
- **Harmonic Vibration (mm/s):** Detects core lamination clamping looseness and mechanical winding displacement.
- **Partial Discharge (PD in pC):** High-frequency dielectric tracking identifying internal insulation micro-fissures and paper degradation.
- **Oil Quality & Dielectric Strength (kV):** Measures breakdown voltage, moisture content, and dissolved gas breakdown.
- **Load Utilization (% / MW):** Tracks active load draw against rated MVA transformer capacity.

**Zero-Dependency Python IoT SDK (`src/iot_sdk`):** Edge hardware devices (Raspberry Pi, substation RTUs) use lightweight API keys (`X-API-Key`) to push real-time sensor streams (`POST /api/iot/ingest`). Features include background auto-collectors, local SQLite offline buffering, and exponential backoff retries.

### 2. Composite Risk Engine & 6-Stage ML Pipeline
Rather than relying on isolated metrics, GridGuard AI executes a calibrated 6-stage machine learning and risk modeling pipeline:
1. **Stage 1 (IEEE C57.91 Physics Health Score):** Computes nominal health index (0–100) from physical thermal/vibration/PD limits.
2. **Stage 2 (MoG Risk Classifier):** Multi-modal Mixture-of-Gaussians clustering categorizes asset operational regimes.
3. **Stage 3 (Isolation Forest Anomaly Detection):** Identifies multivariate behavioral anomalies and generates calibrated anomaly scores.
4. **Stage 4 (Equipment Risk Engine):** Blends anomaly probability with equipment age, condition, and degradation velocity into a normalized equipment risk score (0–100).
5. **Stage 5 (NASA POWER Weather Risk Engine):** Extracts live satellite wind, precipitation, and convective storm shear to compute dynamic weather stress multipliers.
6. **Stage 6 (Composite Risk Engine):** Computes final multi-factor composite risk:

$$\text{Composite Risk} = 0.40 \times \text{Equipment Risk} + 0.20 \times \text{Weather Risk} + 0.25 \times \text{Impact Score} + 0.15 \times \text{Criticality Score}$$

The risk engine decomposes the final score into:
- **Base Equipment Risk:** What the asset's risk is under nominal operating conditions.
- **Weather Stress Delta:** How incoming severe rain, wind shear, and lightning amplify physical failure probability.

**Asynchronous Background Worker & Live SSE Stream:** ML inference runs in non-blocking background workers (`MLBackgroundService`), persisting pre-computed scores to the SQLite DB and streaming live SSE updates (`/api/ml/stream`) to connected browser dashboards without UI latency.

### 3. Automated Maintenance Prioritization
As real-time telemetry and weather risks fluctuate across all 26 fleet assets, the platform dynamically re-ranks maintenance actions across 5 priority tiers. Critical high-risk assets feeding sensitive downstream loads (e.g., regional trauma hospitals, municipal water pumping facilities) automatically surge to **Priority #1**.

### 4. Skill-Matched Crew Pre-positioning
GridGuard AI tracks 5 specialized field crews across regional depots. It analyzes live geospatial transit ETAs, technician certifications (e.g., Live-Line 400kV, SF6 Gas Specialist, Thermal Thermography), and onboard specialized equipment (e.g., FLIR thermal cameras, portable DGA oil kits, dielectric test sets), recommending optimal pre-positioning staging locations before storm fronts make landfall.

### 5. Operator-Centric AI Advisor (Powered by IBM Bob AI)
The GridGuard AI Advisor provides conversational and structured decision support powered by the **IBM Bob AI API** (Granite / fast model). It delivers:
- **Fleet-Wide System Reasoning:** Synthesizes health status, risk distribution, and crew assignments across all 26 assets and 5 grid zones.
- **Asset-Specific Deep Dives:** Detailed causal explanations, telemetry anomalies, and historical degradation patterns when queried about specific assets (e.g., TR-104).
- **Actionable Mitigation Protocols:** Step-by-step dispatch recommendations, proactive load transfers, and quantified outage reduction estimates.

---

## 5-Minute Hackathon Demonstration Script

1. **Operations Dashboard & Fleet Overview (Minute 0–1):**
   - Open `/dashboard`. Note the 26 monitored high-voltage assets across 5 grid zones, live synchronized **Grid Health Index (71/100)**, risk distribution breakdown (Critical, High, Medium, Low with percentages), active weather alerts, and the interactive SVG schematic topology map.
2. **Demo Simulator Trigger (Minute 1–2):**
   - Use the **Hackathon Demo Simulator Bar** fixed at the top of the interface.
   - Start in **Stage 1 (Baseline Nominal)**: Note transformer **TR-104** (Naroda Substation, North-East zone) operating normally (Risk: 42/100, Health: 72/100, Priority #4 routine scan).
   - Switch to **Stage 2 (Incipient Degradation)**: Observe thermal rise (+10°C) and partial discharge elevation (Risk: 68/100, Status: `WARNING`). Maintenance queue automatically elevates TR-104 to Priority #2.
   - Switch to **Stage 3 (Storm Alert & Critical Spike)**: Partial discharge surges +31% (42 pC), winding temp reaches 91.2°C, and severe thunderstorm front strikes the Eastern Grid corridor. Risk Engine evaluates composite risk at **94/100 (CRITICAL)** with **82% Failure Likelihood**.
3. **Asset Diagnostic Deep-Dive (Minute 2–3):**
   - Navigate to `/assets/TR-104`.
   - Inspect the 5 sensor time-series charts showing anomalous spikes in partial discharge, winding temp, and harmonic vibration against baselines.
   - Point to the **Risk Decomposition Breakdown**: Base Equipment Risk (68) + Weather Stress (+26) = Final Risk (94).
4. **Maintenance Planner & Pre-positioning Dispatch (Minute 3–4):**
   - Navigate to `/maintenance`. TR-104 has automatically surged to **Priority #1**.
   - Review pre-positioning recommendation for **Crew 2 (Alpha Mobile Unit)**: staged 10 km from Naroda Substation equipped with thermal cameras and oil testing kits.
   - Click "Assign Crew" to confirm live dispatch and review updated fleet staging.
5. **IBM Bob AI Advisor Fleet Briefing (Minute 4–5):**
   - Navigate to `/advisor`. Click *"Generate grid-wide maintenance action plan"* to observe fleet-wide synthesis across all 26 assets and 5 zones.
   - Ask *"Which asset requires immediate emergency intervention?"* to review structured evidence, outage avoidance estimates ($2.4M protected), and load-shedding protocols for TR-104.
