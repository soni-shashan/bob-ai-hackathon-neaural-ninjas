from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.session import get_db
from app.models.models import Incident, Asset
from app.schemas.schemas import IncidentResponse

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[IncidentResponse])
def get_incidents(
    asset_id: Optional[str] = Query(None, description="Filter by asset ID"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    failure_type: Optional[str] = Query(None, description="Filter by failure type"),
    location: Optional[str] = Query(None, description="Filter by substation/location"),
    db: Session = Depends(get_db)
):
    query = db.query(Incident).join(Asset)

    if asset_id:
        query = query.filter(Incident.asset_id == asset_id)
    if severity and severity.upper() != "ALL":
        query = query.filter(Incident.severity == severity.upper())
    if failure_type and failure_type.upper() != "ALL":
        query = query.filter(Incident.failure_type.ilike(f"%{failure_type}%"))
    if location and location.upper() != "ALL":
        query = query.filter(Incident.location.ilike(f"%{location}%"))

    incidents = query.order_by(Incident.timestamp.desc()).all()
    results = []
    for inc in incidents:
        results.append(IncidentResponse(
            id=inc.id,
            asset_id=inc.asset_id,
            asset_name=inc.asset.name if inc.asset else f"Asset {inc.asset_id}",
            timestamp=inc.timestamp,
            failure_type=inc.failure_type,
            severity=inc.severity,
            duration_minutes=inc.duration_minutes,
            customers_affected=inc.customers_affected,
            root_cause=inc.root_cause,
            weather_condition=inc.weather_condition,
            resolution=inc.resolution,
            location=inc.location
        ))
    return results

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found.")

    return IncidentResponse(
        id=inc.id,
        asset_id=inc.asset_id,
        asset_name=inc.asset.name if inc.asset else f"Asset {inc.asset_id}",
        timestamp=inc.timestamp,
        failure_type=inc.failure_type,
        severity=inc.severity,
        duration_minutes=inc.duration_minutes,
        customers_affected=inc.customers_affected,
        root_cause=inc.root_cause,
        weather_condition=inc.weather_condition,
        resolution=inc.resolution,
        location=inc.location
    )
