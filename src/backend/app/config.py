import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "GridGuard AI"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'gridguard.db'))}"
    )

    # Risk Engine Thresholds (Configurable - Exactly matches GridGuard_AI_Final.ipynb: Low <25, Medium 25-50, High 50-75, Critical >=75)
    RISK_THRESHOLD_LOW: float = 25.0
    RISK_THRESHOLD_MEDIUM: float = 50.0
    RISK_THRESHOLD_MODERATE: float = 50.0  # Alias for backward compatibility
    RISK_THRESHOLD_HIGH: float = 75.0
    RISK_THRESHOLD_CRITICAL: float = 75.0

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

    # IBM Bob AI API Configuration
    BOB_AI_API_KEY: str = os.getenv(
        "BOB_AI_API_KEY",
        "bob_prod_bob-apikey_vyHVwnLb1XAdFj9jWVwMtR2nuTpb8e8WtsGYcz7hVdco3ifWcRLhcsqWyWsE9Jyga7eyWpVoecWB6qB2Fz8wnNb_EzFLmG1cZheqMYnV4vTKA3RaaMuQKvbwJWsbYut4U526"
    )
    BOB_AI_API_URL: str = os.getenv(
        "BOB_AI_API_URL",
        "https://api.us-east.bob.ibm.com/inference/v1/chat/completions"
    )
    BOB_AI_MODEL: str = os.getenv("BOB_AI_MODEL", "fast")
    BOB_AI_USER_AGENT: str = "IBM Bob/1.126.0"
    BOB_AI_TIMEOUT_SECONDS: int = 15

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
