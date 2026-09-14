from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.schemas import MaintenancePlanResponse, CrewAssignRequest, CrewAssignResponse
from app.services.maintenance_service import maintenance_service

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

@router.get("/plan", response_model=MaintenancePlanResponse)
def get_maintenance_plan(db: Session = Depends(get_db)):
    return maintenance_service.get_maintenance_plan(db)

@router.post("/assign", response_model=CrewAssignResponse)
def assign_crew_to_asset(req: CrewAssignRequest, db: Session = Depends(get_db)):
    return maintenance_service.assign_crew(db, req.asset_id, req.crew_id)
