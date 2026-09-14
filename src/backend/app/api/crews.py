from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.schemas.schemas import CrewResponse
from app.services.crew_service import crew_service

router = APIRouter(prefix="/crews", tags=["Crews"])

@router.get("", response_model=List[CrewResponse])
def get_crews(db: Session = Depends(get_db)):
    return crew_service.get_all_crews(db)

@router.get("/{crew_id}", response_model=CrewResponse)
def get_crew(crew_id: str, db: Session = Depends(get_db)):
    c = crew_service.get_crew_by_id(db, crew_id)
    if not c:
        raise HTTPException(status_code=404, detail=f"Crew '{crew_id}' not found.")
    return c
