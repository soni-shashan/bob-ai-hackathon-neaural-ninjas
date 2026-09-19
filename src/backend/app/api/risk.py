from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.models import Asset, SensorReading, DemoScenarioState
from app.schemas.schemas import RiskAnalysisResponse
from app.services.risk_engine import risk_engine
from app.services.dataset_feed_service import dataset_feed_service
from app.ml.health_score import compute_health_score_single
from app.ml.anomaly_detector import anomaly_detector
from app.ml.mog_classifier import mog_classifier
from app.ml.equipment_risk import equipment_risk_engine
from app.ml.weather_engine import weather_risk_engine

router = APIRouter(prefix="/assets", tags=["Risk"])

@router.get("/{asset_id}/risk", response_model=RiskAnalysisResponse)
def get_asset_risk(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")

    # Use pre-computed ML predictions from database
    if asset.last_ml_run_at is None:
        from app.services.ml_background_service import ml_background_service
        ml_background_service.evaluate_asset_ml(db, asset_id)
        db.refresh(asset)

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

    prob = asset.failure_probability if asset.failure_probability is not None else 0.15
    base_eq = asset.equipment_risk if asset.equipment_risk is not None else 25
    w_score = 75 if asset.grid_zone == "East Grid" else 30
    risk_val = asset.risk_score if asset.risk_score is not None else 25

    impact = risk_engine.calculate_impact_score(asset.customers_affected, asset.load_mw)
    crit = asset.criticality_score
    risk_val, _, base_eq_comp, w_delta = risk_engine.compute_composite_risk(prob, w_score, impact, crit)
    w_risk = w_score
    window = (
        "Next 24–72 hours" if risk_val >= 80 else
        ("Next 5–7 days" if risk_val >= 65 else
        ("Next 7–14 days" if risk_val > 50 else "Routine schedule (> 30 days)"))
    )
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
