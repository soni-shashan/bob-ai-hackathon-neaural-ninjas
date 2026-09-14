import logging
import httpx
from typing import Dict, Any
from app.config import settings
from app.schemas.schemas import MLPredictFeatures, MLPredictResponse

logger = logging.getLogger(__name__)

class MLService:
    """
    ML Integration Boundary Service.
    Serves as the isolated bridge between GridGuard backend and the ML Model.
    Supports:
      1. Default high-fidelity deterministic transformer failure inference engine
      2. Switchable external HTTP ML API (friend's model / IBM watsonx / custom endpoint)
    """

    @classmethod
    async def predict_failure(cls, asset_id: str, features: MLPredictFeatures) -> MLPredictResponse:
        # If external service is enabled, call it
        if settings.USE_EXTERNAL_ML_SERVICE and settings.EXTERNAL_ML_SERVICE_URL:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(
                        settings.EXTERNAL_ML_SERVICE_URL,
                        json={"asset_id": asset_id, "features": features.model_dump()}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return MLPredictResponse(
                            asset_id=asset_id,
                            failure_probability=float(data.get("failure_probability", 0.5)),
                            prediction=data.get("prediction", "MODERATE_RISK"),
                            model_version=data.get("model_version", "external-v1")
                        )
            except Exception as e:
                logger.warning(f"External ML service call failed: {e}. Falling back to internal inference engine.")

        # High-fidelity internal diagnostic model
        # Normalized weighted physics-based scoring:
        # - High partial discharge (> 30 pC) is high weight indicator of insulation breakdown
        # - High temp (> 85°C) & high load (> 80%) accelerate thermal aging
        # - High vibration (> 6 mm/s) indicates core or winding mechanical deformity
        # - Low oil quality (< 65) indicates moisture/dielectric loss
        
        pd_score = min(1.0, max(0.0, (features.partial_discharge - 15.0) / 35.0)) # 15 to 50
        temp_score = min(1.0, max(0.0, (features.temperature - 60.0) / 40.0))   # 60 to 100
        vib_score = min(1.0, max(0.0, (features.vibration - 2.0) / 8.0))        # 2 to 10
        oil_score = min(1.0, max(0.0, (85.0 - features.oil_quality) / 45.0))    # 85 down to 40
        load_score = min(1.0, max(0.0, (features.load - 50.0) / 50.0))          # 50 to 100

        # Weighted calculation
        raw_prob = (
            0.35 * pd_score +
            0.25 * temp_score +
            0.15 * vib_score +
            0.15 * oil_score +
            0.10 * load_score
        )
        
        failure_prob = round(float(min(0.99, max(0.02, raw_prob))), 2)

        # Classification label
        if failure_prob >= 0.75:
            prediction = "CRITICAL_RISK"
        elif failure_prob >= 0.50:
            prediction = "HIGH_RISK"
        elif failure_prob >= 0.25:
            prediction = "MODERATE_RISK"
        else:
            prediction = "LOW_RISK"

        return MLPredictResponse(
            asset_id=asset_id,
            failure_probability=failure_prob,
            prediction=prediction,
            model_version="mock-v1-transformer-fault-net"
        )

ml_service = MLService()
