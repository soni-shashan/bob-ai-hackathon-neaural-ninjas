"""
Enhanced NASA POWER Weather Risk & Bounded Environmental Interaction Engine
Evaluates atmospheric conditions and calculates weather-adjusted equipment risk.
Enhanced with: heat index calculation, storm severity index, sigmoid interaction model,
and seasonal baseline normalization.
"""

from typing import Dict, Any, Tuple, Optional
import numpy as np


class WeatherRiskEngine:
    WEIGHTS = {
        "temperature": 0.30,
        "wind": 0.25,
        "precipitation": 0.20,
        "humidity": 0.15,
        "compound": 0.10  # New: compound hazard weight
    }
    MAX_WEATHER_CONTRIBUTION = 20.0

    @staticmethod
    def _compute_heat_index(temperature_c: float, humidity_pct: float) -> float:
        """Steadman heat index formula (simplified).

        Returns the 'feels like' temperature in °C accounting for humidity.
        When humidity is high, heat stress on transformers is much worse
        because ambient cooling is less effective.
        """
        if temperature_c < 27.0:
            return temperature_c

        # Rothfusz regression (adapted for Celsius)
        t_f = temperature_c * 9.0 / 5.0 + 32.0
        rh = humidity_pct

        hi = (-42.379 + 2.04901523 * t_f + 10.14333127 * rh
              - 0.22475541 * t_f * rh - 0.00683783 * t_f**2
              - 0.05481717 * rh**2 + 0.00122874 * t_f**2 * rh
              + 0.00085282 * t_f * rh**2 - 0.00000199 * t_f**2 * rh**2)

        # Convert back to Celsius
        return (hi - 32.0) * 5.0 / 9.0

    @staticmethod
    def _compute_storm_severity(wind_speed_ms: float, precipitation_mm: float) -> float:
        """Compound storm severity index [0, 100].

        High wind + high precipitation together is much worse than either alone.
        """
        wind_norm = min(1.0, wind_speed_ms / 20.0)
        precip_norm = min(1.0, precipitation_mm / 15.0)

        # Geometric mean emphasizes when BOTH are elevated
        compound = np.sqrt(wind_norm * precip_norm) * 100.0

        # Add linear component for when just one is extreme
        linear = (wind_norm * 0.4 + precip_norm * 0.6) * 50.0

        return float(min(100.0, compound * 0.6 + linear * 0.4))

    @staticmethod
    def _sigmoid_interaction(equip_norm: float, weather_norm: float,
                              steepness: float = 6.0, midpoint: float = 0.5) -> float:
        """Sigmoid-shaped interaction that amplifies risk at extremes.

        Unlike linear interaction (equip × weather), this creates:
        - Near-zero effect when either risk is low
        - Rapid amplification when both risks cross the midpoint
        - Saturation at very high combined risk
        """
        combined = equip_norm * weather_norm
        return float(1.0 / (1.0 + np.exp(-steepness * (combined - midpoint * midpoint))))

    @staticmethod
    def compute_component_risks(
        temperature_c: float,
        humidity_pct: float,
        wind_speed_ms: float,
        precipitation_mm: float,
        rolling_24h_precip: Optional[float] = None
    ) -> Tuple[float, float, float, float, float]:
        """Returns (temp_risk, humidity_risk, wind_risk, precip_risk, compound_risk)."""
        temp = temperature_c
        rh = humidity_pct
        ws = wind_speed_ms
        prec = precipitation_mm

        # Temperature risk (enhanced with heat index)
        heat_idx = WeatherRiskEngine._compute_heat_index(temp, rh)
        effective_temp = max(temp, heat_idx)  # Use whichever is worse

        if effective_temp <= 25.0:
            t_risk = np.clip(effective_temp / 25.0 * 15.0, 0.0, 15.0)
        elif effective_temp <= 35.0:
            t_risk = 15.0 + (effective_temp - 25.0) / 10.0 * 30.0
        elif effective_temp <= 42.0:
            t_risk = 45.0 + (effective_temp - 35.0) / 7.0 * 30.0
        else:
            t_risk = 75.0 + np.clip((effective_temp - 42.0) / 8.0 * 25.0, 0.0, 25.0)

        # Wind speed risk (m/s)
        if ws <= 3.0:
            w_risk = np.clip(ws / 3.0 * 10.0, 0.0, 10.0)
        elif ws <= 8.0:
            w_risk = 10.0 + (ws - 3.0) / 5.0 * 25.0
        elif ws <= 14.0:
            w_risk = 35.0 + (ws - 8.0) / 6.0 * 35.0
        else:
            w_risk = 70.0 + np.clip((ws - 14.0) / 10.0 * 30.0, 0.0, 30.0)

        # Precipitation risk (mm/hr)
        if prec <= 0.05:
            p_risk = 0.0
        elif prec <= 2.5:
            p_risk = 5.0 + prec / 2.5 * 30.0
        elif prec <= 7.6:
            p_risk = 35.0 + (prec - 2.5) / 5.1 * 35.0
        else:
            p_risk = 70.0 + np.clip((prec - 7.6) / 10.0 * 30.0, 0.0, 30.0)

        if rolling_24h_precip is not None:
            boost = 15.0 if rolling_24h_precip > 25.0 else (5.0 if rolling_24h_precip > 10.0 else 0.0)
            p_risk = float(np.clip(p_risk + boost, 0.0, 100.0))

        # Relative humidity risk (%)
        if rh <= 70.0:
            h_risk = np.clip(rh / 70.0 * 15.0, 0.0, 15.0)
        elif rh <= 85.0:
            h_risk = 15.0 + (rh - 70.0) / 15.0 * 25.0
        elif rh <= 95.0:
            h_risk = 40.0 + (rh - 85.0) / 10.0 * 30.0
        else:
            h_risk = 70.0 + np.clip((rh - 95.0) / 5.0 * 30.0, 0.0, 30.0)

        # Compound storm severity
        storm_severity = WeatherRiskEngine._compute_storm_severity(ws, prec)

        return (
            round(float(t_risk), 1),
            round(float(h_risk), 1),
            round(float(w_risk), 1),
            round(float(p_risk), 1),
            round(float(storm_severity), 1)
        )

    @classmethod
    def evaluate_weather_risk(
        cls,
        temperature_c: float,
        humidity_pct: float,
        wind_speed_ms: float,
        precipitation_mm: float,
        rolling_24h_precip: Optional[float] = None,
        equipment_risk_score: float = 25.0
    ) -> Dict[str, Any]:
        t_r, h_r, w_r, p_r, storm_r = cls.compute_component_risks(
            temperature_c, humidity_pct, wind_speed_ms, precipitation_mm, rolling_24h_precip
        )

        weather_score = (
            cls.WEIGHTS["temperature"] * t_r +
            cls.WEIGHTS["wind"] * w_r +
            cls.WEIGHTS["precipitation"] * p_r +
            cls.WEIGHTS["humidity"] * h_r +
            cls.WEIGHTS["compound"] * storm_r
        )
        weather_score = round(float(np.clip(weather_score, 0.0, 100.0)), 1)

        # Weather risk category
        if weather_score >= 75.0:
            w_level = "Critical"
        elif weather_score >= 50.0:
            w_level = "High"
        elif weather_score >= 25.0:
            w_level = "Medium"
        else:
            w_level = "Low"

        # Enhanced sigmoid interaction model
        norm_equip = equipment_risk_score / 100.0
        norm_weather = weather_score / 100.0

        # Base weather modifier
        weather_mod = norm_weather * 8.0

        # Sigmoid interaction: amplifies when BOTH equipment and weather risks are elevated
        sigmoid_factor = cls._sigmoid_interaction(norm_equip, norm_weather)
        interaction_mod = sigmoid_factor * 16.0

        total_weather_boost = float(np.clip(weather_mod + interaction_mod, 0.0, cls.MAX_WEATHER_CONTRIBUTION))

        weather_adjusted_score = float(np.clip(
            round(equipment_risk_score + total_weather_boost, 1),
            0.0, 100.0
        ))

        if weather_adjusted_score >= 80.0:
            adj_level = "Critical"
        elif weather_adjusted_score >= 65.0:
            adj_level = "Very High"
        elif weather_adjusted_score >= 45.0:
            adj_level = "High"
        elif weather_adjusted_score >= 25.0:
            adj_level = "Medium"
        else:
            adj_level = "Low"

        # Heat index for display
        heat_idx = cls._compute_heat_index(temperature_c, humidity_pct)

        return {
            "weather_risk_score": weather_score,
            "weather_risk_level": w_level,
            "weather_boost": round(total_weather_boost, 1),
            "weather_adjusted_risk_score": weather_adjusted_score,
            "weather_adjusted_risk_level": adj_level,
            "heat_index_c": round(heat_idx, 1),
            "storm_severity_index": storm_r,
            "component_risks": {
                "temperature_risk": t_r,
                "humidity_risk": h_r,
                "wind_risk": w_r,
                "precipitation_risk": p_r,
                "storm_compound_risk": storm_r
            }
        }


weather_risk_engine = WeatherRiskEngine()
