from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.models import Asset, SensorReading
from app.schemas.schemas import AssetSensorsResponse, SensorPoint

router = APIRouter(prefix="/assets", tags=["Sensors"])

@router.get("/{asset_id}/sensors", response_model=AssetSensorsResponse)
def get_asset_sensors(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.asset_id == asset_id)
        .order_by(SensorReading.timestamp.asc())
        .all()
    )

    temp_list = []
    vib_list = []
    pd_list = []
    oil_list = []
    load_list = []

    for r in readings:
        temp_list.append(SensorPoint(
            timestamp=r.timestamp,
            value=r.temperature,
            unit="°C",
            baseline=72.0,
            threshold_warning=80.0,
            threshold_critical=90.0
        ))
        vib_list.append(SensorPoint(
            timestamp=r.timestamp,
            value=r.vibration,
            unit="mm/s",
            baseline=2.5,
            threshold_warning=5.0,
            threshold_critical=7.0
        ))
        pd_list.append(SensorPoint(
            timestamp=r.timestamp,
            value=r.partial_discharge,
            unit="pC",
            baseline=15.0,
            threshold_warning=25.0,
            threshold_critical=35.0
        ))
        oil_list.append(SensorPoint(
            timestamp=r.timestamp,
            value=r.oil_quality,
            unit="Index",
            baseline=85.0,
            threshold_warning=65.0,
            threshold_critical=55.0
        ))
        load_list.append(SensorPoint(
            timestamp=r.timestamp,
            value=r.load,
            unit="MW",
            baseline=35.0,
            threshold_warning=70.0,
            threshold_critical=80.0
        ))

    return AssetSensorsResponse(
        asset_id=asset_id,
        temperature=temp_list,
        vibration=vib_list,
        partial_discharge=pd_list,
        oil_quality=oil_list,
        load=load_list
    )
