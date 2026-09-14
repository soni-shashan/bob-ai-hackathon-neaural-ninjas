from fastapi import APIRouter
from typing import List, Dict, Any
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
