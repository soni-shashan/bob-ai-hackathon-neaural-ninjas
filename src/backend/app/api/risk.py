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

    # Dynamic ML evaluation from telemetry and models
    if asset_id == "TR-104" and stage:
        slice_df = dataset_feed_service.get_stage_slice(stage)
    else:
        slice_df = dataset_feed_service.get_asset_slice(asset_id)

    if not slice_df.empty:
        row = slice_df.iloc[-1]
        oti = float(row.get("OTI", temp))
        wti = float(row.get("WTI", oti + 10.0))
        ati = float(row.get("ATI", 32.0))
        oli = float(row.get("OLI", oil))
        vl1, vl2, vl3 = float(row.get("VL1", 240.0)), float(row.get("VL2", 239.5)), float(row.get("VL3", 240.2))
        il1, il2, il3 = float(row.get("IL1", 75.0)), float(row.get("IL2", 74.0)), float(row.get("IL3", 76.0))
        inut = float(row.get("INUT", 1.5))
        oti_a = float(row.get("OTI_A", 0.0))
        oti_t = float(row.get("OTI_T", 0.0))

        h_res = compute_health_score_single(
            oti=oti, wti=wti, ati=ati, oli=oli, oti_a=oti_a, oti_t=oti_t,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3, inut=inut
        )
        a_res = anomaly_detector.predict_anomaly_single(
            oti=oti, ati=ati, oli=oli,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3
        )
        m_res = mog_classifier.predict_mog_alarm(
            oti=oti, wti=wti, ati=ati, oli=oli, oti_a=oti_a, oti_t=oti_t,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3, inut=inut
        )
        r_res = equipment_risk_engine.evaluate_risk(
            health_score=h_res["health_score"],
            normalized_anomaly_risk=a_res["normalized_anomaly_risk"],
            is_anomaly=a_res["is_anomaly"],
            mog_probability=m_res["mog_probability"]
        )
        w_res = weather_risk_engine.evaluate_weather_risk(
            temperature_c=ati,
            humidity_pct=85.0 if asset.grid_zone == "East Grid" else 55.0,
            wind_speed_ms=14.0 if asset.grid_zone == "East Grid" else 6.0,
            precipitation_mm=4.8 if asset.grid_zone == "East Grid" else 0.5,
            equipment_risk_score=r_res["equipment_risk_score"]
        )
        prob = round(float(r_res["failure_probability"]), 2)
        base_eq = int(round(r_res["equipment_risk_score"]))
        w_score = int(round(w_res["weather_risk_score"]))
    else:
        impact = risk_engine.calculate_impact_score(asset.customers_affected, asset.load_mw)
        crit = asset.criticality_score
        w_score = 75 if asset.grid_zone == "East Grid" else 30
        prob = round(min(0.95, max(0.05, (100 - asset.health_score + 15) / 100.0)), 2)
        base_eq = 100 - asset.health_score

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
