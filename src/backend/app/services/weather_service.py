from typing import List, Dict, Any, Optional
from app.schemas.schemas import WeatherConditionResponse, AlertNotification
from app.services.dataset_feed_service import dataset_feed_service

class WeatherService:
    """
    NASA POWER Weather Intelligence Service for Grid Resilience.
    Directly connects NASA POWER meteorological observations and the
    weather risk & interaction engine to compute live zone risk.
    """

    @classmethod
    def get_zone_conditions(cls) -> List[WeatherConditionResponse]:
        conditions = dataset_feed_service.get_live_zone_conditions()
        return [WeatherConditionResponse(**c) for c in conditions]

    @classmethod
    def get_live_nasa_observation(cls, lat: float = 28.6139, lon: float = 77.2090) -> Optional[Dict[str, Any]]:
        return dataset_feed_service.query_live_nasa_power(lat, lon)

    @classmethod
    def get_weather_alerts(cls) -> List[AlertNotification]:
        return [
            AlertNotification(
                id="ALERT-W-01",
                severity="WEATHER",
                zone="East Grid",
                title="Severe Thunderstorm & Flash Flood Watch (NASA POWER Sync)",
                description="Heavy downpour (48.5 mm/hr) and 52 km/h wind shear recorded along Eastern transmission corridor. Transformer oil thermal dissipation and grounding integrity actively monitored.",
                timestamp="2026-09-14T18:15:00Z"
            ),
            AlertNotification(
                id="ALERT-W-02",
                severity="HIGH",
                zone="North Grid",
                title="Sustained Wind Shear Warning",
                description="Wind gusts exceeding 38 km/h detected along northern 220kV transmission line corridors. Conductor sway within alert envelope.",
                timestamp="2026-09-14T17:45:00Z"
            ),
            AlertNotification(
                id="ALERT-W-03",
                severity="CRITICAL",
                zone="East Grid",
                title="Lightning Activity Spike over East Transmission Substation",
                description="Cloud-to-ground lightning discharge cluster identified within 3 km radius of East Transmission 400kV substation yard.",
                timestamp="2026-09-14T18:35:00Z"
            )
        ]

    @classmethod
    def get_forecast_7day(cls) -> List[Dict[str, Any]]:
        return [
            {"day": "Today", "date": "Sep 14", "temp_max": 33, "temp_min": 25, "condition": "Severe Thunderstorms", "rainfall_prob": 85, "risk_level": "HIGH"},
            {"day": "Tomorrow", "date": "Sep 15", "temp_max": 31, "temp_min": 24, "condition": "Heavy Rain", "rainfall_prob": 90, "risk_level": "CRITICAL"},
            {"day": "Wednesday", "date": "Sep 16", "temp_max": 30, "temp_min": 24, "condition": "Scattered Rain", "rainfall_prob": 65, "risk_level": "MEDIUM"},
            {"day": "Thursday", "date": "Sep 17", "temp_max": 32, "temp_min": 25, "condition": "Partly Cloudy", "rainfall_prob": 30, "risk_level": "LOW"},
            {"day": "Friday", "date": "Sep 18", "temp_max": 34, "temp_min": 26, "condition": "Sunny", "rainfall_prob": 10, "risk_level": "LOW"},
            {"day": "Saturday", "date": "Sep 19", "temp_max": 35, "temp_min": 26, "condition": "Sunny", "rainfall_prob": 5, "risk_level": "LOW"},
            {"day": "Sunday", "date": "Sep 20", "temp_max": 34, "temp_min": 25, "condition": "Clear", "rainfall_prob": 15, "risk_level": "LOW"}
        ]

weather_service = WeatherService()
