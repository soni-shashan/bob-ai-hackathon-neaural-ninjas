from fastapi import APIRouter
from app.schemas.schemas import MLPredictRequest, MLPredictResponse
from app.services.ml_service import ml_service

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.post("/predict", response_model=MLPredictResponse)
async def predict_equipment_failure(req: MLPredictRequest):
    """
    ML Integration Endpoint.
    This endpoint isolates the frontend from the ML model implementation.
    The internal ML service routes requests to either the high-fidelity mock predictor
    or the external ML model API without altering this contract.
    """
    return await ml_service.predict_failure(req.asset_id, req.features)
