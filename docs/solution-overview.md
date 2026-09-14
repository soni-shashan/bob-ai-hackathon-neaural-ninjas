# Solution Overview: GridGuard AI

**GridGuard AI** is an AI-powered predictive grid resilience and equipment-failure decision-support platform engineered specifically for power utilities, transmission system operators, and regional load despatch centers.

It unites high-frequency asset health sensors, ML failure predictions, meteorological storm tracking, asset criticality, downstream customer impact, and crew staging into a single continuous intelligence pipeline:

```text
Prediction → Risk Assessment → Prioritization → Maintenance Recommendation → Crew Pre-positioning
```

---

## Key Platform Capabilities

### 1. Multi-Sensor Anomaly Diagnostics
GridGuard AI ingests continuous time-series telemetry across 5 core asset health dimensions:
- **Winding & Top-Oil Temperature:** Monitors thermal rise against 7-day operational baselines.
- **Harmonic Vibration:** Detects core lamination clamping looseness and mechanical winding displacement.
- **Partial Discharge (PD):** High-frequency dielectric tracking identifying internal insulation micro-fissures.
- **Oil Quality & DGA:** Measures moisture content, breakdown voltage, and dissolved gas breakdown.
- **Load Utilization:** Tracks active MW draw against MVA capacity thresholds.

### 2. Composite Risk Engine
Rather than relying on isolated metrics, GridGuard AI calculates a single transparent, calibrated composite risk score (0–100) using a multi-factor formula:

$$\text{Composite Risk} = 0.40 \times \text{Equipment Fail Prob} + 0.20 \times \text{Weather Risk} + 0.25 \times \text{Impact Score} + 0.15 \times \text{Criticality Score}$$

The risk engine decomposes the final score into:
- **Base Equipment Risk:** What the asset's risk is under normal conditions.
- **Weather Stress Delta:** How incoming severe rain, wind, and lightning amplify that risk.

### 3. Automated Maintenance Prioritization
As risks evolve, the platform automatically re-ranks maintenance actions in real-time. Assets at highest risk with critical customer exposure (e.g. trauma hospitals, water treatment plants) are moved to Priority #1.

### 4. Skill-Matched Crew Pre-positioning
GridGuard AI calculates travel ETAs and analyzes field crew certifications and onboard specialized equipment (e.g., FLIR high-resolution thermal cameras, portable SF6 analyzers, oil DGA test kits), recommending optimal pre-positioning depots within proximity to high-risk substations before weather fronts arrive.

### 5. Operator-Centric AI Advisor
The GridGuard AI Advisor provides explainable decision support. Rather than generic conversational text, it delivers structured operational briefings with:
- Summary answer
- Concrete telemetry and weather evidence
- Risk level classification
- Step-by-step mitigation actions
- Expected outage reduction and financial avoidance estimates

---

## 5-Minute Hackathon Demonstration Script

1. **Overview Dashboard (Minute 0–1):**
   - Open `/dashboard`. Note the 248 monitored assets, 78/100 grid health score, 3 active weather alerts, and the interactive SVG schematic topology map.
2. **Demo Simulator Switch (Minute 1–2):**
   - Use the **Hackathon Demo Simulator Bar** at the top.
   - Start in **Stage 1 (Baseline)**: Note TR-104 operating normally (Risk 42, Nominal temp 71.5°C, Priority #4 in maintenance queue).
   - Switch to **Stage 2 (Degradation)**: Observe thermal and vibration elevation (Risk 68, Warning status).
   - Switch to **Stage 3 (Critical Storm)**: Partial discharge surges +31%, temp reaches 91.2°C, and a severe thunderstorm alert strikes Naroda Substation (Risk 94, Critical status).
3. **Asset Diagnostic Deep-Dive (Minute 2–3):**
   - Navigate to `/assets/TR-104`.
   - Inspect the 5 sensor charts: show the sharp spike in Partial Discharge (42 pC) and Temperature against baseline.
   - Point to the **Risk Decomposition Equation**: Base Equipment Risk 68 + Weather Stress +26 = Final Risk 94.
4. **Maintenance Planner & Pre-positioning (Minute 3–4):**
   - Open `/maintenance`. TR-104 has automatically surged to **Priority #1**.
   - Review the pre-positioning recommendation for **Crew 2**: staged 10 km from Naroda Substation with thermal cameras and oil testing kits.
   - Click "Assign Crew" and confirm the dispatch.
5. **AI Advisor Briefing (Minute 4–5):**
   - Navigate to `/advisor`. Click *"Which asset requires immediate attention?"*
   - Review the structured evidence: 82% predicted failure probability, 18,500 dependent customers, and recommended proactive load shedding to prevent a regional cascade.
