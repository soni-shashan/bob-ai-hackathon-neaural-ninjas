from fastapi import APIRouter
from app.schemas.schemas import MLPredictRequest, MLPredictResponse, MLModelInfoResponse
from app.services.ml_service import ml_service

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.get("/info", response_model=MLModelInfoResponse)
def get_ml_model_info():
    """
    Returns active ML model specifications, features, weights, and loaded artifact status.
    """
    return ml_service.get_model_info()

@router.post("/predict", response_model=MLPredictResponse)
async def predict_equipment_failure(req: MLPredictRequest):
    """
    ML Integration Endpoint.
    Executes real-time multi-stage inference:
      1. IEEE C57.91 Physics Health Scoring
      2. Condition-Aware Isolation Forest Anomaly Detection
      3. ExtraTreesClassifier MOG Alarm Flag
      4. Composite Equipment Failure Risk Engine with Root-Cause Explainability
    """
    return await ml_service.predict_failure(req.asset_id, req.features)
