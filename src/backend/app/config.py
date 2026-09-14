import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "GridGuard AI"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = "sqlite:///./gridguard.db"

    # Risk Engine Thresholds (Configurable)
    RISK_THRESHOLD_LOW: int = 29
    RISK_THRESHOLD_MODERATE: int = 49
    RISK_THRESHOLD_HIGH: int = 69
    RISK_THRESHOLD_VERY_HIGH: int = 84
    RISK_THRESHOLD_CRITICAL: int = 85

    # Risk Scoring Weights (Formula: 0.40 * eq + 0.20 * weather + 0.25 * impact + 0.15 * crit)
    WEIGHT_EQUIPMENT: float = 0.40
    WEIGHT_WEATHER: float = 0.20
    WEIGHT_IMPACT: float = 0.25
    WEIGHT_CRITICALITY: float = 0.15

    # ML Bridge Settings
    USE_EXTERNAL_ML_SERVICE: bool = False
    EXTERNAL_ML_SERVICE_URL: str = "http://localhost:8001/predict"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    # JWT Authentication
    JWT_SECRET_KEY: str = "gridguard-ai-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
