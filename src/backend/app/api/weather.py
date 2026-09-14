from fastapi import APIRouter, Query
from typing import List, Dict, Any, Optional
from app.schemas.schemas import WeatherConditionResponse, AlertNotification
from app.services.weather_service import weather_service

router = APIRouter(prefix="/weather", tags=["Weather"])

@router.get("/current", response_model=List[WeatherConditionResponse])
def get_current_weather():
    return weather_service.get_zone_conditions()

@router.get("/forecast")
def get_forecast():
    return weather_service.get_forecast_7day()

@router.get("/alerts", response_model=List[AlertNotification])
def get_weather_alerts():
    return weather_service.get_weather_alerts()

@router.get("/zones", response_model=List[WeatherConditionResponse])
def get_weather_zones():
    return weather_service.get_zone_conditions()

@router.get("/nasa-power-live")
def get_nasa_power_live(
    lat: float = Query(28.6139, description="Latitude (default: Regional Grid Center)"),
    lon: float = Query(77.2090, description="Longitude (default: Regional Grid Center)")
):
    """
    Direct live query to the official NASA POWER hourly meteorological API.
    """
    obs = weather_service.get_live_nasa_observation(lat, lon)
    if obs:
        return {"status": "ok", "source": "NASA_POWER_LIVE_SATELLITE", "data": obs}
    return {
        "status": "cached",
        "source": "NASA_POWER_HISTORICAL_CACHE",
        "message": "Live endpoint rate-limited or unavailable; serving cached NASA POWER observations."
    }
