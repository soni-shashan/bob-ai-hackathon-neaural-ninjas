"""
Equipment Failure Risk Engine
Synthesizes physics health score, condition-aware sensor anomaly, and MOG alarm
into a unified Equipment Failure Risk Score with dynamic root-cause explainability.
"""

from typing import Dict, Any, Tuple
import numpy as np


class EquipmentRiskEngine:
    WEIGHTS = {
        "health_risk": 0.55,
        "anomaly_risk": 0.35,
        "mog_risk": 0.10
    }

    THRESHOLDS = {
        "Critical": 75.0,
        "High": 50.0,
        "Medium": 25.0,
        "Low": 0.0
    }

    @staticmethod
    def generate_explanation_and_action(risk_level: str, is_anomaly: bool, dominant_factor: str) -> Tuple[str, str]:
        if risk_level == "Critical":
            if is_anomaly:
                reason = "Critical risk: severe transformer condition deterioration coincides with abnormal sensor behavior."
            else:
                reason = "Critical risk: severe transformer condition deterioration detected. No significant sensor anomaly detected."
            action = "Immediate engineering review; prioritize field inspection and contingency response."
        elif risk_level == "High":
            if is_anomaly:
                reason = "High risk due to transformer condition deterioration combined with abnormal sensor behavior."
            else:
                reason = "High risk driven primarily by pronounced equipment health deterioration. No significant sensor anomaly detected."
            action = "Schedule prioritized inspection and maintenance."
        elif risk_level == "Medium":
            if is_anomaly:
                reason = "Medium risk with abnormal sensor behavior detected. Increase monitoring frequency."
            elif dominant_factor == "MOG alarm":
                reason = "Medium risk reflecting supporting MOG alarm trigger with stable physical health."
            else:
                reason = "Medium risk due to moderate operational thermal/electrical stress."
            action = "Increase monitoring frequency and inspect during next planned maintenance."
        else:
            if is_anomaly:
                reason = "Low overall risk, but an isolated sensor anomaly was detected. Continue monitoring."
            else:
                reason = "Low risk — transformer health is stable and no significant sensor anomaly detected."
            action = "Continue routine monitoring."
        return reason, action

    @classmethod
    def evaluate_risk(
        cls,
        health_score: float,
        normalized_anomaly_risk: float,
        is_anomaly: bool,
        mog_probability: float
    ) -> Dict[str, Any]:
        c_health_risk = float(np.clip(100.0 - health_score, 0.0, 100.0))
        c_anomaly_risk = float(np.clip(normalized_anomaly_risk, 0.0, 100.0))
        c_mog_risk = float(np.clip(mog_probability * 100.0, 0.0, 100.0))

        contrib_health = cls.WEIGHTS["health_risk"] * c_health_risk
        contrib_anomaly = cls.WEIGHTS["anomaly_risk"] * c_anomaly_risk
        contrib_mog = cls.WEIGHTS["mog_risk"] * c_mog_risk

        equip_risk = float(np.clip(contrib_health + contrib_anomaly + contrib_mog, 0.0, 100.0))
        equip_risk = round(equip_risk, 1)

        # Assign risk level
        if equip_risk >= cls.THRESHOLDS["Critical"]:
            level = "Critical"
        elif equip_risk >= cls.THRESHOLDS["High"]:
            level = "High"
        elif equip_risk >= cls.THRESHOLDS["Medium"]:
            level = "Medium"
        else:
            level = "Low"

        # Dominant factor
        if (contrib_health >= 15.0) and (contrib_anomaly >= 15.0):
            dominant = "Combined deterioration"
        else:
            cdict = {
                "Thermal/health deterioration": contrib_health,
                "Sensor anomaly": contrib_anomaly,
                "MOG alarm": contrib_mog
            }
            dominant = max(cdict, key=cdict.get)

        reason, action = cls.generate_explanation_and_action(level, is_anomaly, dominant)

        return {
            "equipment_risk_score": equip_risk,
            "risk_level": level,
            "failure_probability": round(min(0.99, max(0.01, equip_risk / 100.0)), 2),
            "dominant_risk_factor": dominant,
            "risk_reason": reason,
            "recommended_action": action,
            "contributions": {
                "health_risk_contribution": round(contrib_health, 2),
                "anomaly_risk_contribution": round(contrib_anomaly, 2),
                "mog_risk_contribution": round(contrib_mog, 2)
            }
        }


equipment_risk_engine = EquipmentRiskEngine()
