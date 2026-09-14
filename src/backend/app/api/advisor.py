from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.schemas import AdvisorQueryRequest, AdvisorQueryResponse
from app.services.advisor_service import advisor_service

router = APIRouter(prefix="/advisor", tags=["AI Advisor"])

@router.post("/query", response_model=AdvisorQueryResponse)
def query_grid_advisor(req: AdvisorQueryRequest, db: Session = Depends(get_db)):
    return advisor_service.answer_query(db, req.question, req.asset_id)
