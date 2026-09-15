import os
import shutil
from pydantic_settings import BaseSettings
from typing import List

def get_database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    # Check if running in serverless environment (Vercel, AWS Lambda) or read-only filesystem
    is_serverless = bool(
        os.getenv("VERCEL")
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
        or os.getenv("LAMBDA_TASK_ROOT")
    )

    if is_serverless:
        tmp_db_path = "/tmp/gridguard.db"
        # If pre-seeded database exists in deployment package, copy to writable /tmp
        candidates = [
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "gridguard.db"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "gridguard.db"),
            os.path.join(os.getcwd(), "gridguard.db"),
            os.path.join(os.getcwd(), "src", "backend", "gridguard.db"),
            os.path.join(os.getcwd(), "backend", "gridguard.db"),
        ]
        if not os.path.exists(tmp_db_path):
            for candidate in candidates:
                if os.path.exists(candidate) and os.path.getsize(candidate) > 0:
                    try:
                        shutil.copyfile(candidate, tmp_db_path)
                        break
                    except Exception:
                        pass
        return f"sqlite:///{tmp_db_path}"

    # Local development: locate database in backend directory or workspace root
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    workspace_db = os.path.join(backend_dir, "gridguard.db")
    target_dir = os.path.dirname(workspace_db)
    if os.access(target_dir, os.W_OK):
        return f"sqlite:///{workspace_db}"
    else:
        return "sqlite:////tmp/gridguard.db"

class Settings(BaseSettings):
    PROJECT_NAME: str = "GridGuard AI"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = get_database_url()

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

    # ML Bridge Settings (Port 8001 external inference service or fallback)
    USE_EXTERNAL_ML_SERVICE: bool = os.getenv("USE_EXTERNAL_ML_SERVICE", "false").lower() in ("true", "1", "yes")
    EXTERNAL_ML_SERVICE_URL: str = os.getenv("EXTERNAL_ML_SERVICE_URL", "http://localhost:8001/predict")

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8001",
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
