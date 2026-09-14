"""
NASA POWER Weather Risk & Bounded Environmental Interaction Engine
Evaluates atmospheric conditions and calculates weather-adjusted equipment risk.
"""

from typing import Dict, Any, Tuple, Optional
import numpy as np


class WeatherRiskEngine:
    WEIGHTS = {
        "temperature": 0.35,
        "wind": 0.30,
        "precipitation": 0.20,
        "humidity": 0.15
    }
    MAX_WEATHER_CONTRIBUTION = 20.0

    @staticmethod
    def compute_component_risks(
        temperature_c: float,
        humidity_pct: float,
        wind_speed_ms: float,
        precipitation_mm: float,
        rolling_24h_precip: Optional[float] = None
    ) -> Tuple[float, float, float, float]:
        temp = temperature_c
        rh = humidity_pct
        ws = wind_speed_ms
        prec = precipitation_mm

        # Temperature risk
        if temp <= 25.0:
            t_risk = np.clip(temp / 25.0 * 15.0, 0.0, 15.0)
        elif temp <= 35.0:
            t_risk = 15.0 + (temp - 25.0) / 10.0 * 30.0
        elif temp <= 42.0:
            t_risk = 45.0 + (temp - 35.0) / 7.0 * 30.0
        else:
            t_risk = 75.0 + np.clip((temp - 42.0) / 8.0 * 25.0, 0.0, 25.0)

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

        return (
            round(float(t_risk), 1),
            round(float(h_risk), 1),
            round(float(w_risk), 1),
            round(float(p_risk), 1)
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
        t_r, h_r, w_r, p_r = cls.compute_component_risks(
            temperature_c, humidity_pct, wind_speed_ms, precipitation_mm, rolling_24h_precip
        )

        weather_score = (
            cls.WEIGHTS["temperature"] * t_r +
            cls.WEIGHTS["wind"] * w_r +
            cls.WEIGHTS["precipitation"] * p_r +
            cls.WEIGHTS["humidity"] * h_r
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

        # Bounded interaction
        norm_equip = equipment_risk_score / 100.0
        norm_weather = weather_score / 100.0

        weather_mod = norm_weather * 10.0
        interaction_mod = norm_equip * norm_weather * 14.0
        total_weather_boost = float(np.clip(weather_mod + interaction_mod, 0.0, cls.MAX_WEATHER_CONTRIBUTION))

        weather_adjusted_score = float(np.clip(
            round(equipment_risk_score + total_weather_boost, 1),
            0.0, 100.0
        ))

        if weather_adjusted_score >= 75.0:
            adj_level = "Critical"
        elif weather_adjusted_score >= 50.0:
            adj_level = "High"
        elif weather_adjusted_score >= 25.0:
            adj_level = "Medium"
        else:
            adj_level = "Low"

        return {
            "weather_risk_score": weather_score,
            "weather_risk_level": w_level,
            "weather_boost": round(total_weather_boost, 1),
            "weather_adjusted_risk_score": weather_adjusted_score,
            "weather_adjusted_risk_level": adj_level,
            "component_risks": {
                "temperature_risk": t_r,
                "humidity_risk": h_r,
                "wind_risk": w_r,
                "precipitation_risk": p_r
            }
        }


weather_risk_engine = WeatherRiskEngine()
