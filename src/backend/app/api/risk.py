from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.models import Asset, SensorReading, DemoScenarioState
from app.schemas.schemas import RiskAnalysisResponse
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/assets", tags=["Risk"])

@router.get("/{asset_id}/risk", response_model=RiskAnalysisResponse)
def get_asset_risk(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")

    demo_row = db.query(DemoScenarioState).filter(DemoScenarioState.id == 1).first()
    stage = demo_row.current_stage if demo_row else "critical"

    # Fetch latest sensor reading if available
    latest_reading = (
        db.query(SensorReading)
        .filter(SensorReading.asset_id == asset_id)
        .order_by(SensorReading.timestamp.desc())
        .first()
    )

    temp = latest_reading.temperature if latest_reading else 85.0
    vib = latest_reading.vibration if latest_reading else 5.0
    pd = latest_reading.partial_discharge if latest_reading else 30.0
    oil = latest_reading.oil_quality if latest_reading else 60.0
    load = latest_reading.load if latest_reading else asset.load_mw

    if asset_id == "TR-104":
        if stage == "baseline":
            risk_val = 42
            prob = 0.28
            base_eq = 42
            w_delta = 0
            w_risk = 25
            crit = 91
            impact = 88
            window = "Standard routine inspection cycle"
            factors = [
                "Dielectric partial discharge within acceptable operating limits (18 pC).",
                "Transformer winding temperature operating near baseline (71.5°C).",
                "Vibration telemetry shows normal core acoustic signature.",
                "Supplies 18,500 downstream customers with primary bus tie active."
            ]
        elif stage == "degradation":
            risk_val = 68
            prob = 0.58
            base_eq = 55
            w_delta = 13
            w_risk = 52
            crit = 91
            impact = 92
            window = "Next 5–7 days"
            factors = [
                "Partial discharge has risen to 28.5 pC (+14% over baseline).",
                "Winding temperature elevated 10°C above historical 7-day average.",
                "Harmonic vibration trend indicates incipient mechanical clamp looseness.",
                "Incoming rain squall projected to reduce ambient cooling efficiency."
            ]
        else: # critical
            risk_val = 94
            prob = 0.82
            base_eq = 68
            w_delta = 26
            w_risk = 76
            crit = 91
            impact = 97
            window = "Next 24–72 hours"
            factors = [
                "1. Partial discharge has surged 31% over dielectric baseline safety limits.",
                "2. Transformer temperature is 18°C above its 7-day operational baseline.",
                "3. Vibration telemetry shows sustained upward harmonic trend.",
                "4. Heavy rainfall & lightning storm expected in East Grid zone within 24 hours.",
                "5. The transformer supplies approximately 18,500 customers and 42 MW load.",
                "6. No immediate redundant transformer is available in Naroda yard."
            ]
    elif asset_id == "TR-087":
        risk_val = 91
        prob = 0.76
        base_eq = 66
        w_delta = 25
        w_risk = 74
        crit = 89
        impact = 93
        window = "Next 48–96 hours"
        factors = [
            "Winding temperature elevated 15°C above baseline under continuous industrial demand.",
            "Partial discharge elevated at 34 pC with dissolved combustible gas traces.",
            "Heavy rain front forecast to impact Vatva industrial corridor.",
            "Supplies 14,200 commercial and industrial customer accounts."
        ]
    elif asset_id == "TR-221":
        risk_val = 87
        prob = 0.71
        base_eq = 64
        w_delta = 23
        w_risk = 70
        crit = 86
        impact = 88
        window = "Next 3–5 days"
        factors = [
            "Core vibration amplitude increased to 5.8 mm/s during recent load swings.",
            "Thermal Dissolved Gas Analysis indicates mild overheating.",
            "Supplies 11,800 customers in Odhav sub-transmission loop."
        ]
    else:
        # Standard dynamic derivation
        impact = risk_engine.calculate_impact_score(asset.customers_affected, asset.load_mw)
        crit = asset.criticality_score
        w_score = 75 if asset.grid_zone == "East Grid" else 30
        prob = round(min(0.95, (100 - asset.health_score + 15) / 100.0), 2)
        risk_val, _, base_eq, w_delta = risk_engine.compute_composite_risk(prob, w_score, impact, crit)
        w_risk = w_score
        window = "Next 7–14 days" if risk_val > 60 else "Routine schedule (> 30 days)"
        factors = risk_engine.derive_contributing_factors(
            temp, vib, pd, oil, asset.load_mw,
            "HIGH" if w_score > 60 else "LOW",
            asset.customers_affected, prob
        )

    level = risk_engine.calculate_risk_level(risk_val)

    return RiskAnalysisResponse(
        asset_id=asset_id,
        risk_score=risk_val,
        failure_probability=prob,
        equipment_risk=base_eq,
        weather_risk=w_risk,
        impact_score=impact,
        criticality_score=crit,
        risk_level=level,
        contributing_factors=factors,
        weather_stress_delta=w_delta,
        base_equipment_risk=base_eq,
        estimated_failure_window=window
    )
