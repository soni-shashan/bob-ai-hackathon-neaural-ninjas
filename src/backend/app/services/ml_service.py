import logging
import httpx
from typing import Dict, Any, Optional
from app.config import settings
from app.schemas.schemas import MLPredictFeatures, MLPredictResponse, MLModelInfoResponse
from app.ml.health_score import compute_health_score_single
from app.ml.anomaly_detector import anomaly_detector
from app.ml.mog_classifier import mog_classifier
from app.ml.equipment_risk import equipment_risk_engine

logger = logging.getLogger(__name__)


class MLService:
    """
    ML Integration Boundary Service.
    Serves as the isolated bridge between GridGuard backend and the ML Model.
    Supports:
      1. GridGuard Multi-Stage Machine Learning Engine:
         - IEEE C57.91 Physics Health Score
         - Condition-Aware Isolation Forest Anomaly Detection
         - ExtraTreesClassifier MOG Alarm Prediction
         - Composite Equipment Failure Risk & Root-Cause Explainability
      2. Switchable external HTTP ML API (IBM watsonx / custom endpoint)
    """

    MODEL_VERSION = "GridGuard-Final-v1.0 (IsolationForest + ExtraTrees + IEEE C57.91)"

    @classmethod
    def get_model_info(cls) -> MLModelInfoResponse:
        return MLModelInfoResponse(
            model_name="GridGuard Multi-Stage Fault & Anomaly Predictor",
            version=cls.MODEL_VERSION,
            architecture="Ensemble: Condition-Aware Isolation Forest (150 estimators) + ExtraTreesClassifier (100 estimators) + IEEE C57.91 Physics Degradation",
            features=[
                "Load-Adjusted Thermal Residual (temp_residual)",
                "3-Phase Voltage Unbalance (v_unbalance_pct)",
                "Nominal Voltage Deviation (v_nominal_dev_pct)",
                "3-Phase Current Unbalance (i_unbalance_pct)",
                "Low Oil Level Hazard (oli_low_risk)",
                "Top Oil Temperature (OTI)",
                "Winding Temperature (WTI)",
                "Ambient Temperature (ATI)"
            ],
            weights={
                "health_risk": 0.55,
                "anomaly_risk": 0.35,
                "mog_risk": 0.10
            },
            status="ONLINE (Production Trained Artifacts Loaded)"
        )

    @classmethod
    async def predict_failure(cls, asset_id: str, features: MLPredictFeatures) -> MLPredictResponse:
        # 1. External service fallback if explicitly enabled
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
                            model_version=data.get("model_version", "external-v1"),
                            health_score=data.get("health_score"),
                            is_anomaly=data.get("is_anomaly"),
                            dominant_risk_factor=data.get("dominant_risk_factor"),
                            risk_reason=data.get("risk_reason"),
                            recommended_action=data.get("recommended_action")
                        )
            except Exception as e:
                logger.warning(f"External ML service call failed: {e}. Falling back to internal inference engine.")

        # 2. Extract and resolve telemetry features
        # Map basic SCADA sensor inputs to IEEE telemetry if detailed fields not provided
        oti = features.oti if features.oti is not None else features.temperature
        ati = features.ati if features.ati is not None else (features.ambient_temperature or 32.0)
        oli = features.oli if features.oli is not None else features.oil_quality

        # Winding temp estimation from OTI and load if not explicit
        if features.wti is not None:
            wti = features.wti
        else:
            wti = oti + max(3.0, (features.load / 100.0) * 14.0)

        # 3-Phase currents from load (calibrated to training dataset mean ~74A)
        nominal_current = max(15.0, (features.load / 100.0) * 85.0)
        il1 = features.il1 if features.il1 is not None else nominal_current
        il2 = features.il2 if features.il2 is not None else (nominal_current * 0.99)
        il3 = features.il3 if features.il3 is not None else (nominal_current * 1.01)

        vl1 = features.vl1 if features.vl1 is not None else 240.0
        vl2 = features.vl2 if features.vl2 is not None else 239.5
        vl3 = features.vl3 if features.vl3 is not None else 240.2

        inut = features.inut if features.inut is not None else 1.2

        # 3. Stage 3: IEEE C57.91 Physics Health Scoring
        health_res = compute_health_score_single(
            oti=oti, wti=wti, ati=ati, oli=oli,
            oti_a=features.oti_a or 0.0, oti_t=features.oti_t or 0.0,
            vl1=vl1, vl2=vl2, vl3=vl3,
            il1=il1, il2=il2, il3=il3,
            inut=inut
        )

        # Dielectric penalty from partial discharge & severe acoustic vibration
        pd_penalty = 0.0
        if features.partial_discharge > 35.0:
            pd_penalty += min(25.0, 10.0 + (features.partial_discharge - 35.0) * 2.0)
        elif features.partial_discharge > 25.0:
            pd_penalty += (features.partial_discharge - 25.0) * 1.0

        vib_penalty = 0.0
        if features.vibration > 6.0:
            vib_penalty += min(20.0, 5.0 + (features.vibration - 6.0) * 3.5)
        elif features.vibration > 4.5:
            vib_penalty += (features.vibration - 4.5) * 2.0

        effective_health = max(5.0, health_res["health_score"] - pd_penalty - vib_penalty)

        # 4. Stage 4: Condition-Aware Isolation Forest Anomaly Detection
        anom_res = anomaly_detector.predict_anomaly_single(
            oti=oti, ati=ati, oli=oli,
            vl1=vl1, vl2=vl2, vl3=vl3,
            il1=il1, il2=il2, il3=il3
        )

        # If vibration or partial discharge is abnormal, elevate anomaly severity
        if features.partial_discharge > 35.0 or features.vibration > 6.5:
            anom_res["is_anomaly"] = True
            anom_res["anomaly_prediction"] = -1
            anom_res["normalized_anomaly_risk"] = max(anom_res["normalized_anomaly_risk"], 85.0)

        # 5. Stage 2: MOG Supporting Alarm Classifier
        mog_res = mog_classifier.predict_mog_alarm(
            oti=oti, wti=wti, ati=ati, oli=oli,
            oti_a=features.oti_a or 0.0, oti_t=features.oti_t or 0.0,
            vl1=vl1, vl2=vl2, vl3=vl3,
            il1=il1, il2=il2, il3=il3,
            inut=inut
        )

        # 6. Stage 5: Equipment Failure Risk Evaluation & Explainability
        risk_res = equipment_risk_engine.evaluate_risk(
            health_score=effective_health,
            normalized_anomaly_risk=anom_res["normalized_anomaly_risk"],
            is_anomaly=anom_res["is_anomaly"],
            mog_probability=mog_res["mog_probability"]
        )

        failure_prob = risk_res["failure_probability"]

        # High-risk / Critical risk categorization compliant with API contract
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
            model_version=cls.MODEL_VERSION,
            health_score=round(effective_health, 1),
            health_category=health_res["health_category"],
            is_anomaly=anom_res["is_anomaly"],
            decision_score=anom_res["decision_score"],
            normalized_anomaly_risk=anom_res["normalized_anomaly_risk"],
            dominant_risk_factor=risk_res["dominant_risk_factor"],
            risk_reason=risk_res["risk_reason"],
            recommended_action=risk_res["recommended_action"],
            equipment_risk_score=risk_res["equipment_risk_score"],
            mog_probability=mog_res["mog_probability"],
            penalties={
                "thermal_penalty": health_res["thermal_penalty"],
                "oil_alarm_penalty": health_res["oil_alarm_penalty"],
                "electrical_penalty": health_res["electrical_penalty"],
                "partial_discharge_penalty": round(pd_penalty, 2),
                "vibration_penalty": round(vib_penalty, 2)
            }
        )


ml_service = MLService()
