from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import math
from app.database.session import get_db
from app.models.models import Asset, SensorReading, MaintenanceAction, DemoScenarioState
from app.schemas.schemas import AssetBase, AssetCreate, AssetListResponse
from app.services.risk_engine import risk_engine
from app.services.dataset_feed_service import dataset_feed_service
from app.ml.health_score import compute_health_score_single
from app.ml.anomaly_detector import anomaly_detector
from app.ml.mog_classifier import mog_classifier
from app.ml.equipment_risk import equipment_risk_engine
from app.ml.weather_engine import weather_risk_engine

router = APIRouter(prefix="/assets", tags=["Assets"])

def _hydrate_asset(a: Asset, stage: Optional[str] = None) -> AssetBase:
    # 1. Fetch real telemetry slice based on stage or asset ID
    if a.id == "TR-104" and stage:
        slice_df = dataset_feed_service.get_stage_slice(stage)
    else:
        slice_df = dataset_feed_service.get_asset_slice(a.id)

    if not slice_df.empty:
        row = slice_df.iloc[-1]
        oti = float(row.get("OTI", 70.0))
        wti = float(row.get("WTI", oti + 10.0))
        ati = float(row.get("ATI", 32.0))
        oli = float(row.get("OLI", 75.0))
        vl1, vl2, vl3 = float(row.get("VL1", 240.0)), float(row.get("VL2", 239.5)), float(row.get("VL3", 240.2))
        il1, il2, il3 = float(row.get("IL1", 75.0)), float(row.get("IL2", 74.0)), float(row.get("IL3", 76.0))
        inut = float(row.get("INUT", 1.5))
        oti_a = float(row.get("OTI_A", 0.0))
        oti_t = float(row.get("OTI_T", 0.0))

        # 2. Stage 3: IEEE C57.91 Physics Health Score ML Model
        h_res = compute_health_score_single(
            oti=oti, wti=wti, ati=ati, oli=oli, oti_a=oti_a, oti_t=oti_t,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3, inut=inut
        )
        health = int(round(h_res["health_score"]))

        # 3. Stage 4: Condition-Aware Isolation Forest Anomaly Detection ML Model
        a_res = anomaly_detector.predict_anomaly_single(
            oti=oti, ati=ati, oli=oli,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3
        )

        # 4. Stage 2: XGBoost MOG Alarm Classifier ML Model
        m_res = mog_classifier.predict_mog_alarm(
            oti=oti, wti=wti, ati=ati, oli=oli, oti_a=oti_a, oti_t=oti_t,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3, inut=inut
        )

        # 5. Stage 5: Non-Linear Equipment Risk Fusion ML Engine
        r_res = equipment_risk_engine.evaluate_risk(
            health_score=h_res["health_score"],
            normalized_anomaly_risk=a_res["normalized_anomaly_risk"],
            is_anomaly=a_res["is_anomaly"],
            mog_probability=m_res["mog_probability"]
        )
        risk = int(round(r_res["equipment_risk_score"]))
        prob = round(float(r_res["failure_probability"]), 2)

        # 6. Stage 6: NASA POWER Sigmoidal Weather Risk Model
        w_res = weather_risk_engine.evaluate_weather_risk(
            temperature_c=ati,
            humidity_pct=85.0 if a.grid_zone == "East Grid" else 55.0,
            wind_speed_ms=14.0 if a.grid_zone == "East Grid" else 6.0,
            precipitation_mm=4.8 if a.grid_zone == "East Grid" else 0.5,
            equipment_risk_score=r_res["equipment_risk_score"]
        )
        w_risk = w_res["weather_risk_level"]
        status = "CRITICAL" if risk >= 75 else ("WARNING" if risk >= 50 else "OPERATIONAL")
    else:
        # Fallback to database health score if CSV slice is empty
        health = a.health_score
        risk = 100 - health
        prob = round(min(0.95, max(0.08, risk / 100.0)), 2)
        status = "CRITICAL" if risk >= 75 else ("WARNING" if risk >= 50 else "OPERATIONAL")
        w_risk = "HIGH" if a.grid_zone == "East Grid" else "LOW"

    return AssetBase(
        id=a.id,
        name=a.name,
        type=a.asset_type,
        location=a.substation,
        latitude=a.latitude,
        longitude=a.longitude,
        health_score=health,
        risk_score=risk,
        failure_probability=prob,
        risk_level=risk_engine.calculate_risk_level(risk),
        customers_affected=a.customers_affected,
        load_mw=a.load_mw,
        weather_risk=w_risk,
        last_maintenance=a.last_maintenance,
        installed_date=a.installed_date,
        capacity_mva=a.capacity_mva,
        status=status,
        grid_zone=a.grid_zone
    )

@router.get("", response_model=AssetListResponse)
def get_assets(
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type"),
    location: Optional[str] = Query(None, description="Filter by location/substation"),
    search: Optional[str] = Query(None, description="Search term"),
    sort: Optional[str] = Query("risk_desc", description="Sort order: risk_desc, risk_asc, failure_desc, customers_desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    demo_row = db.query(DemoScenarioState).filter(DemoScenarioState.id == 1).first()
    stage = demo_row.current_stage if demo_row else "critical"

    query = db.query(Asset).filter(~Asset.id.like("TR-TEST-%"))
    raw_assets = query.all()

    # Hydrate and calculate dynamic metrics
    hydrated = [_hydrate_asset(a, stage) for a in raw_assets]

    # Filters
    if risk_level and risk_level.upper() != "ALL":
        hydrated = [a for a in hydrated if a.risk_level.upper() == risk_level.upper()]

    if asset_type and asset_type.upper() != "ALL":
        hydrated = [a for a in hydrated if a.type.lower() == asset_type.lower()]

    if location and location.upper() != "ALL":
        hydrated = [a for a in hydrated if location.lower() in a.location.lower()]

    if search:
        s = search.lower()
        hydrated = [
            a for a in hydrated
            if s in a.id.lower() or s in a.name.lower() or s in a.location.lower()
        ]

    # Sorting
    if sort == "risk_desc":
        hydrated.sort(key=lambda x: x.risk_score, reverse=True)
    elif sort == "risk_asc":
        hydrated.sort(key=lambda x: x.risk_score)
    elif sort == "failure_desc":
        hydrated.sort(key=lambda x: x.failure_probability, reverse=True)
    elif sort == "customers_desc":
        hydrated.sort(key=lambda x: x.customers_affected, reverse=True)
    elif sort == "health_asc":
        hydrated.sort(key=lambda x: x.health_score)

    total = len(hydrated)
    start = (page - 1) * limit
    paged_items = hydrated[start : start + limit]

    return AssetListResponse(
        total=total,
        page=page,
        limit=limit,
        items=paged_items
    )

@router.get("/{asset_id}", response_model=AssetBase)
def get_asset(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")

    demo_row = db.query(DemoScenarioState).filter(DemoScenarioState.id == 1).first()
    stage = demo_row.current_stage if demo_row else "critical"

    return _hydrate_asset(asset, stage)

@router.post("", response_model=AssetBase)
def create_asset(req: AssetCreate, db: Session = Depends(get_db)):
    asset_id = req.id.strip().upper()
    existing = db.query(Asset).filter(Asset.id == asset_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Asset with ID '{asset_id}' is already registered.")

    now = datetime.now(timezone.utc)
    new_asset = Asset(
        id=asset_id,
        name=req.name.strip(),
        asset_type=req.type or "Power Transformer",
        substation=req.location.strip(),
        grid_zone=req.grid_zone or "East Grid",
        latitude=req.latitude or 28.6139,
        longitude=req.longitude or 77.2090,
        capacity_mva=req.capacity_mva or 50.0,
        load_mw=req.load_mw or 30.0,
        health_score=82,
        criticality_score=req.criticality_score or 70,
        customers_affected=req.customers_affected or 5000,
        status="OPERATIONAL",
        installed_date=req.installed_date or now.strftime("%Y-%m-%d"),
        last_maintenance=now.strftime("%Y-%m-%d")
    )
    db.add(new_asset)
    db.flush()

    # Generate 100 nominal historical sensor readings so telemetry charts work immediately
    sensor_points = []
    for step in range(100):
        hours_ago = 24.0 * (1.0 - (step / 99.0))
        ts = (now - timedelta(hours=hours_ago)).isoformat()
        temp = 66.0 + math.sin(step * 0.25) * 4.0
        vib = 2.4 + math.cos(step * 0.3) * 0.5
        pd = 14.0 + math.sin(step * 0.2) * 2.5
        oil = 86.0 - math.sin(step * 0.1) * 2.0
        load = (req.load_mw or 30.0) + math.sin(step * 0.15) * 4.0

        sensor_points.append(SensorReading(
            asset_id=asset_id,
            timestamp=ts,
            temperature=round(temp, 2),
            vibration=round(vib, 2),
            partial_discharge=round(pd, 2),
            oil_quality=round(oil, 2),
            load=round(load, 2),
            ambient_temperature=round(31.0 + math.sin(step * 0.15) * 3.0, 1)
        ))
    db.bulk_save_objects(sensor_points)

    # Initial routine maintenance action
    db.add(MaintenanceAction(
        id=f"MA-{asset_id}-INIT",
        asset_id=asset_id,
        crew_id=None,
        priority=4,
        action="Initial Baseline Commissioning & Diagnostic Scan",
        status="PENDING",
        scheduled_time=(now + timedelta(days=7)).isoformat(),
        estimated_duration_hours=2.0,
        reason="New transformer onboarded to GridGuard AI active monitoring.",
        expected_risk_reduction_pct=15
    ))

    db.commit()
    db.refresh(new_asset)
    return _hydrate_asset(new_asset, "critical")

