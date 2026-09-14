from typing import List, Dict, Any
from app.schemas.schemas import WeatherConditionResponse, AlertNotification

class WeatherService:
    """
    Weather intelligence service for grid resilience.
    Supports multi-zone conditions, forecasts, and storm alerts.
    """

    @classmethod
    def get_zone_conditions(cls) -> List[WeatherConditionResponse]:
        return [
            WeatherConditionResponse(
                zone="east",
                zone_name="Eastern Industrial Grid (Naroda / Odhav / Vatva)",
                rainfall_prob=85,
                rainfall_intensity_mm=48.5,
                wind_speed_kmh=52.0,
                lightning_risk="HIGH",
                flood_risk="ELEVATED",
                weather_risk_level="HIGH",
                weather_score=78,
                temperature_c=29.4,
                affected_assets_count=18,
                condition_text="Severe Thunderstorms & Heavy Rainfall"
            ),
            WeatherConditionResponse(
                zone="central",
                zone_name="Central Urban Grid (Ahmedabad Metro)",
                rainfall_prob=45,
                rainfall_intensity_mm=12.0,
                wind_speed_kmh=28.0,
                lightning_risk="MODERATE",
                flood_risk="MINIMAL",
                weather_risk_level="MODERATE",
                weather_score=42,
                temperature_c=31.2,
                affected_assets_count=32,
                condition_text="Scattered Showers & Moderate Wind"
            ),
            WeatherConditionResponse(
                zone="west",
                zone_name="Western Commercial Corridor (SG Highway / Bopal)",
                rainfall_prob=20,
                rainfall_intensity_mm=2.5,
                wind_speed_kmh=22.0,
                lightning_risk="LOW",
                flood_risk="MINIMAL",
                weather_risk_level="LOW",
                weather_score=24,
                temperature_c=33.5,
                affected_assets_count=24,
                condition_text="Partly Cloudy"
            ),
            WeatherConditionResponse(
                zone="north",
                zone_name="Northern Substation Ring (Gandhinagar / Chandkheda)",
                rainfall_prob=60,
                rainfall_intensity_mm=22.0,
                wind_speed_kmh=38.0,
                lightning_risk="MODERATE",
                flood_risk="MINIMAL",
                weather_risk_level="MODERATE",
                weather_score=51,
                temperature_c=30.1,
                affected_assets_count=19,
                condition_text="Gusty Winds & Rain Bands"
            ),
            WeatherConditionResponse(
                zone="south",
                zone_name="Southern Logistics Hub (Sanand / Sarkhej)",
                rainfall_prob=30,
                rainfall_intensity_mm=5.0,
                wind_speed_kmh=24.0,
                lightning_risk="LOW",
                flood_risk="MINIMAL",
                weather_risk_level="LOW",
                weather_score=31,
                temperature_c=32.8,
                affected_assets_count=21,
                condition_text="Overcast with Light Breeze"
            )
        ]

    @classmethod
    def get_weather_alerts(cls) -> List[AlertNotification]:
        return [
            AlertNotification(
                id="ALERT-W-01",
                severity="WEATHER",
                zone="East Grid",
                title="Severe Thunderstorm & Flash Flood Watch",
                description="Heavy downpour (48mm/hr) and 52 km/h wind gusts forecast for Eastern Naroda-Vatva corridor. Transformer oil thermal dissipation and grounding integrity may be compromised.",
                timestamp="2026-09-13T18:15:00Z"
            ),
            AlertNotification(
                id="ALERT-W-02",
                severity="HIGH",
                zone="North Grid",
                title="Sustained Wind Shear Warning",
                description="Wind gusts exceeding 40 km/h detected along northern 220kV transmission line corridors. Potential conductor sway and tree encroachment risk.",
                timestamp="2026-09-13T17:45:00Z"
            ),
            AlertNotification(
                id="ALERT-W-03",
                severity="CRITICAL",
                zone="East Grid",
                title="Lightning Activity Spike over Naroda Substation",
                description="Cloud-to-ground lightning discharge cluster identified within 3 km radius of Naroda 400kV substation yard.",
                timestamp="2026-09-13T19:10:00Z"
            )
        ]

    @classmethod
    def get_forecast_7day(cls) -> List[Dict[str, Any]]:
        return [
            {"day": "Today", "date": "Sep 13", "temp_max": 33, "temp_min": 25, "condition": "Thunderstorms", "rainfall_prob": 85, "risk_level": "HIGH"},
            {"day": "Tomorrow", "date": "Sep 14", "temp_max": 31, "temp_min": 24, "condition": "Heavy Rain", "rainfall_prob": 90, "risk_level": "VERY_HIGH"},
            {"day": "Monday", "date": "Sep 15", "temp_max": 30, "temp_min": 24, "condition": "Scattered Rain", "rainfall_prob": 65, "risk_level": "MODERATE"},
            {"day": "Tuesday", "date": "Sep 16", "temp_max": 32, "temp_min": 25, "condition": "Partly Cloudy", "rainfall_prob": 30, "risk_level": "LOW"},
            {"day": "Wednesday", "date": "Sep 17", "temp_max": 34, "temp_min": 26, "condition": "Sunny", "rainfall_prob": 10, "risk_level": "LOW"},
            {"day": "Thursday", "date": "Sep 18", "temp_max": 35, "temp_min": 26, "condition": "Sunny", "rainfall_prob": 5, "risk_level": "LOW"},
            {"day": "Friday", "date": "Sep 19", "temp_max": 34, "temp_min": 25, "condition": "Clear", "rainfall_prob": 15, "risk_level": "LOW"}
        ]

weather_service = WeatherService()
