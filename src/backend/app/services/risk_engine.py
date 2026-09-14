from typing import Tuple, List, Dict, Any
from app.config import settings

class RiskEngine:
    """
    Composite Risk Engine for GridGuard AI.
    Combines:
      - Equipment failure probability (from ML prediction / sensor diagnostics)
      - Weather risk score (from meteorological telemetry & forecasts)
      - Grid / customer impact score (from load, customers affected, critical facilities)
      - Asset criticality score (from grid topology & redundancy)
    """

    @staticmethod
    def calculate_risk_level(score: float) -> str:
        """
        Risk classification matching GridGuard_AI_Final.ipynb:
          - Low: < 25.0
          - Medium: 25.0 to 49.9
          - High: 50.0 to 74.9
          - Critical: >= 75.0
        """
        if score < settings.RISK_THRESHOLD_LOW:
            return "LOW"
        elif score < settings.RISK_THRESHOLD_MEDIUM:
            return "MEDIUM"
        elif score < settings.RISK_THRESHOLD_HIGH:
            return "HIGH"
        else:
            return "CRITICAL"

    @staticmethod
    def calculate_impact_score(customers: int, load_mw: float, has_backup: bool = True) -> int:
        """Normalized 0-100 score based on grid and customer exposure."""
        customer_norm = min(100.0, (customers / 20000.0) * 60.0)
        load_norm = min(40.0, (load_mw / 60.0) * 40.0)
        base = customer_norm + load_norm
        if not has_backup:
            base = min(100.0, base * 1.25)
        return int(round(min(100.0, max(0.0, base))))

    @classmethod
    def compute_composite_risk(
        cls,
        equipment_prob: float,       # 0.0 - 1.0 (or 0-100)
        weather_score: float,        # 0 - 100
        impact_score: float,         # 0 - 100
        criticality_score: float     # 0 - 100
    ) -> Tuple[int, str, int, int]:
        """
        Returns:
          final_risk (0-100),
          risk_level (LOW/MODERATE/HIGH/VERY_HIGH/CRITICAL),
          base_equipment_risk (0-100),
          weather_stress_delta (0-100)
        """
        # Normalize equipment probability to 0-100 scale
        eq_scaled = equipment_prob * 100.0 if equipment_prob <= 1.0 else equipment_prob

        # Formula: 0.40 * eq + 0.20 * weather + 0.25 * impact + 0.15 * crit
        final = (
            settings.WEIGHT_EQUIPMENT * eq_scaled +
            settings.WEIGHT_WEATHER * weather_score +
            settings.WEIGHT_IMPACT * impact_score +
            settings.WEIGHT_CRITICALITY * criticality_score
        )
        final_clamped = int(round(min(100.0, max(0.0, final))))
        level = cls.calculate_risk_level(final_clamped)

        # Base equipment risk without severe weather stress
        base_eq_risk = int(round(
            (settings.WEIGHT_EQUIPMENT / (settings.WEIGHT_EQUIPMENT + settings.WEIGHT_IMPACT + settings.WEIGHT_CRITICALITY)) * eq_scaled +
            (settings.WEIGHT_IMPACT / (settings.WEIGHT_EQUIPMENT + settings.WEIGHT_IMPACT + settings.WEIGHT_CRITICALITY)) * impact_score +
            (settings.WEIGHT_CRITICALITY / (settings.WEIGHT_EQUIPMENT + settings.WEIGHT_IMPACT + settings.WEIGHT_CRITICALITY)) * criticality_score
        ))

        weather_delta = max(0, final_clamped - base_eq_risk)

        return final_clamped, level, base_eq_risk, weather_delta

    @classmethod
    def derive_contributing_factors(
        cls,
        temperature: float,
        vibration: float,
        partial_discharge: float,
        oil_quality: float,
        load_mw: float,
        weather_risk_level: str,
        customers: int,
        failure_prob: float
    ) -> List[str]:
        """Produces transparent, operator-focused diagnostic bullet points."""
        factors = []
        if partial_discharge > 35.0:
            pct = int(round(((partial_discharge - 25.0) / 25.0) * 100))
            factors.append(f"Partial discharge anomaly (+{pct}% over baseline dielectric threshold).")
        elif partial_discharge > 25.0:
            factors.append("Partial discharge elevation detected above nominal band.")

        if temperature >= 85.0:
            delta = round(temperature - 72.0, 1)
            factors.append(f"Transformer winding temperature is {delta}°C above 7-day average baseline.")
        elif temperature >= 78.0:
            factors.append("Thermal trending shows persistent gradient rise under peak loading.")

        if vibration > 6.0:
            factors.append("Vibration signature shows sustained harmonic upward trend indicating mechanical looseness.")

        if oil_quality < 65.0:
            factors.append(f"Dissolved gas & moisture in oil degradation index ({oil_quality}/100).")

        if weather_risk_level in ["HIGH", "VERY_HIGH", "CRITICAL"]:
            factors.append("Severe precipitation and high wind forecast in operational zone within 24 hours.")

        if customers >= 10000:
            factors.append(f"High critical load dependency: supplying approx {customers:,} downstream customers.")

        if failure_prob >= 0.70:
            factors.append(f"Predictive ML model evaluates equipment failure likelihood at {int(failure_prob * 100)}%.")

        if not factors:
            factors.append("Asset telemetry operating within nominal operational thresholds.")

        return factors

risk_engine = RiskEngine()
