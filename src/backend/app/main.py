from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.session import engine, Base, SessionLocal
from app.seed.seed_data import seed_database
from app.api.auth_deps import get_current_user

# Routers
from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.assets import router as assets_router
from app.api.sensors import router as sensors_router
from app.api.risk import router as risk_router
from app.api.weather import router as weather_router
from app.api.incidents import router as incidents_router
from app.api.maintenance import router as maintenance_router
from app.api.crews import router as crews_router
from app.api.ml import router as ml_router
from app.api.advisor import router as advisor_router
from app.api.demo import router as demo_router
from app.api.iot import router as iot_router

def ensure_schema_updates(bind_engine):
    """Safely adds new columns to existing SQLite database tables if missing."""
    from sqlalchemy import text
    with bind_engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE iot_devices ADD COLUMN is_simulated BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE iot_data_logs ADD COLUMN is_simulated BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and seed data
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates(engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

    # Shutdown: Clean up resources if needed

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="GridGuard AI - Predictive Grid Resilience & Equipment Failure Decision-Support Platform",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Health Endpoint (public — no auth required)
@app.get(f"{settings.API_PREFIX}/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "gridguard-api",
        "version": settings.VERSION
    }

# ── Public Routes (no authentication) ──────────────────────────────────
app.include_router(auth_router, prefix=settings.API_PREFIX)

# ── Protected Routes (require valid JWT token) ─────────────────────────
# All existing API routes are protected behind get_current_user dependency
protected = [Depends(get_current_user)]

app.include_router(dashboard_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(assets_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(sensors_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(risk_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(weather_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(incidents_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(maintenance_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(crews_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(ml_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(advisor_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(demo_router, prefix=settings.API_PREFIX, dependencies=protected)

# ── IoT Routes (mixed authentication) ──────────────────────────────────
# IoT ingest and heartbeat use X-API-Key header auth (handled by iot_auth dependency)
# IoT device management (register/list/get/delete) uses JWT auth
app.include_router(iot_router, prefix=settings.API_PREFIX)
