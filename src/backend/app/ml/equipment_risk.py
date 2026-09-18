"""
Enhanced Equipment Failure Risk Engine
Synthesizes physics health score, condition-aware sensor anomaly, and MOG alarm
into a unified Equipment Failure Risk Score with:
- Non-linear interaction terms for compound deterioration
- Severity amplification when multiple risk sources are elevated
- Granular 5-level risk classification
- Dynamic root-cause explainability with confidence signals
"""

from typing import Dict, Any, Tuple
import numpy as np


class EquipmentRiskEngine:
    WEIGHTS = {
        "health_risk": 0.50,
        "anomaly_risk": 0.35,
        "mog_risk": 0.15
    }

    # Non-linear interaction parameters
    INTERACTION_WEIGHT = 0.15  # Weight for health×anomaly interaction term
    SEVERITY_AMPLIFICATION_THRESHOLD = 40.0  # Both must exceed this for amplification
    SEVERITY_MULTIPLIER = 1.25  # Amplification factor for compound risk

    # 5-level thresholds (added "Very High")
    THRESHOLDS = {
        "Critical": 80.0,
        "Very High": 65.0,
        "High": 45.0,
        "Medium": 25.0,
        "Low": 0.0
    }

    @staticmethod
    def _sigmoid_boost(x: float, midpoint: float = 50.0, steepness: float = 0.1) -> float:
        """Sigmoid function for smooth non-linear transitions.

        Returns values in [0, 1], centered at midpoint.
        """
        return float(1.0 / (1.0 + np.exp(-steepness * (x - midpoint))))

    @staticmethod
    def generate_explanation_and_action(risk_level: str, is_anomaly: bool, dominant_factor: str) -> Tuple[str, str]:
        if risk_level == "Critical":
            if is_anomaly:
                reason = "Critical risk: severe transformer condition deterioration coincides with abnormal sensor behavior."
            else:
                reason = "Critical risk: severe transformer condition deterioration detected. No significant sensor anomaly detected."
            action = "Immediate engineering review; prioritize field inspection and contingency response."
        elif risk_level == "Very High":
            if is_anomaly:
                reason = "Very high risk: significant compound deterioration detected with active sensor anomalies requiring urgent attention."
            else:
                reason = "Very high risk: pronounced equipment degradation approaching critical levels."
            action = "Urgent inspection required within 24-48 hours; prepare maintenance team."
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

        # Linear contributions
        contrib_health = cls.WEIGHTS["health_risk"] * c_health_risk
        contrib_anomaly = cls.WEIGHTS["anomaly_risk"] * c_anomaly_risk
        contrib_mog = cls.WEIGHTS["mog_risk"] * c_mog_risk

        linear_risk = contrib_health + contrib_anomaly + contrib_mog

        # Non-linear interaction: compound risk when both health AND anomaly are bad
        interaction_term = cls.INTERACTION_WEIGHT * (c_health_risk / 100.0) * (c_anomaly_risk / 100.0) * 100.0

        # Severity amplification for compound deterioration
        if c_health_risk > cls.SEVERITY_AMPLIFICATION_THRESHOLD and c_anomaly_risk > cls.SEVERITY_AMPLIFICATION_THRESHOLD:
            amplification = cls.SEVERITY_MULTIPLIER
        else:
            amplification = 1.0

        equip_risk = float(np.clip((linear_risk + interaction_term) * amplification, 0.0, 100.0))
        equip_risk = round(equip_risk, 1)

        # Assign risk level (5 levels)
        if equip_risk >= cls.THRESHOLDS["Critical"]:
            level = "Critical"
        elif equip_risk >= cls.THRESHOLDS["Very High"]:
            level = "Very High"
        elif equip_risk >= cls.THRESHOLDS["High"]:
            level = "High"
        elif equip_risk >= cls.THRESHOLDS["Medium"]:
            level = "Medium"
        else:
            level = "Low"

        # Dominant factor analysis
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

        # Failure probability estimation (calibrated via sigmoid)
        raw_prob = equip_risk / 100.0
        # Sigmoid calibration: low risk → very low probability, high risk → approaches 1.0
        calibrated_prob = cls._sigmoid_boost(equip_risk, midpoint=50.0, steepness=0.08)
        failure_prob = round(min(0.99, max(0.01, calibrated_prob)), 3)

        return {
            "equipment_risk_score": equip_risk,
            "risk_level": level,
            "failure_probability": failure_prob,
            "dominant_risk_factor": dominant,
            "risk_reason": reason,
            "recommended_action": action,
            "severity_amplified": amplification > 1.0,
            "contributions": {
                "health_risk_contribution": round(contrib_health, 2),
                "anomaly_risk_contribution": round(contrib_anomaly, 2),
                "mog_risk_contribution": round(contrib_mog, 2),
                "interaction_contribution": round(interaction_term, 2),
                "amplification_factor": round(amplification, 2)
            }
        }


equipment_risk_engine = EquipmentRiskEngine()
