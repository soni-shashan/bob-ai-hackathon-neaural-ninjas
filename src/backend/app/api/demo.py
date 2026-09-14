from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.schemas import DemoStateResponse, DemoSetStageRequest
from app.services.demo_service import demo_service

router = APIRouter(prefix="/demo", tags=["Demo Simulation"])

@router.get("/state", response_model=DemoStateResponse)
def get_demo_state(db: Session = Depends(get_db)):
    return demo_service.get_state(db)

@router.post("/set-stage", response_model=DemoStateResponse)
def set_demo_stage(req: DemoSetStageRequest, db: Session = Depends(get_db)):
    return demo_service.set_stage(db, req.stage)

@router.post("/reset", response_model=DemoStateResponse)
def reset_demo(db: Session = Depends(get_db)):
    return demo_service.set_stage(db, "baseline")
