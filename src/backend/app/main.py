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
from app.api.users import router as users_router
from app.api.tickets import router as tickets_router
from app.api.bulk_upload import router as bulk_upload_router

def ensure_schema_updates(bind_engine):
    """Safely adds new columns to existing SQLite database tables if missing."""
    from sqlalchemy import text
    with bind_engine.connect() as conn:
        for stmt in [
            "ALTER TABLE iot_devices ADD COLUMN is_simulated BOOLEAN DEFAULT 0",
            "ALTER TABLE iot_data_logs ADD COLUMN is_simulated BOOLEAN DEFAULT 0",
            "ALTER TABLE assets ADD COLUMN risk_score INTEGER DEFAULT 25",
            "ALTER TABLE assets ADD COLUMN failure_probability FLOAT DEFAULT 0.15",
            "ALTER TABLE assets ADD COLUMN equipment_risk INTEGER DEFAULT 25",
            "ALTER TABLE assets ADD COLUMN weather_risk VARCHAR(20) DEFAULT 'LOW'",
            "ALTER TABLE assets ADD COLUMN is_anomaly BOOLEAN DEFAULT 0",
            "ALTER TABLE assets ADD COLUMN last_ml_run_at VARCHAR(30)",
            "ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'MAIN_ADMIN'",
            "ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT 'Grid Operations'",
            "ALTER TABLE users ADD COLUMN phone VARCHAR(30)",
            "ALTER TABLE users ADD COLUMN permissions JSON"
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables, seed data, and run initial background ML pass
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates(engine)
    db = SessionLocal()
    try:
        seed_database(db)
        # Initial background ML evaluation pass
        from app.services.ml_background_service import ml_background_service
        ml_background_service.evaluate_all_assets_ml(db)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Startup ML evaluation warning: {e}")
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
app.include_router(users_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(tickets_router, prefix=settings.API_PREFIX, dependencies=protected)
app.include_router(bulk_upload_router, prefix=settings.API_PREFIX, dependencies=protected)

app.include_router(iot_router, prefix=settings.API_PREFIX)

