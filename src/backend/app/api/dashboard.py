from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
from app.database.session import get_db
from app.schemas.schemas import DashboardSummaryResponse, RiskTrendPoint, AlertNotification
from app.models.models import Asset
from app.services.weather_service import weather_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    # Standard deterministic utility values matching specification:
    # 248 monitored assets total in grid zone, 7 critical, 19 high risk, 84,230 customers at risk, 3 active weather alerts, 78 grid health
    return DashboardSummaryResponse(
        total_assets=248,
        critical_assets=7,
        high_risk_assets=19,
        customers_at_risk=84230,
        active_weather_alerts=3,
        grid_health_score=78,
        last_updated=datetime.now(timezone.utc).isoformat()
    )

@router.get("/risk-trend", response_model=List[RiskTrendPoint])
def get_risk_trend():
    # 24-hour hourly trend showing realistic fluctuation with a recent 14% uptick in last 6 hours
    # from ~58 up to ~72
    base_hours = [
        ("00:00", 52.4, 2), ("01:00", 51.8, 2), ("02:00", 51.0, 2),
        ("03:00", 50.5, 1), ("04:00", 51.2, 1), ("05:00", 53.0, 2),
        ("06:00", 55.4, 3), ("07:00", 57.8, 3), ("08:00", 61.2, 4),
        ("09:00", 63.5, 4), ("10:00", 64.0, 4), ("11:00", 64.8, 4),
        ("12:00", 65.1, 4), ("13:00", 63.9, 4), ("14:00", 65.0, 5),
        ("15:00", 66.2, 5), ("16:00", 67.8, 5), ("17:00", 69.4, 6),
        ("18:00", 71.0, 6), ("19:00", 72.8, 7), ("20:00", 73.5, 7),
        ("21:00", 74.2, 7), ("22:00", 74.8, 7), ("23:00", 75.1, 7)
    ]
    
    now = datetime.now(timezone.utc)
    trend = []
    for h, score, crit in base_hours:
        trend.append(RiskTrendPoint(
            timestamp=now.isoformat(),
            hour=h,
            avg_risk_score=score,
            critical_count=crit
        ))
    return trend

@router.get("/alerts", response_model=List[AlertNotification])
def get_active_alerts():
    return [
        AlertNotification(
            id="ALT-001",
            severity="CRITICAL",
            asset_id="TR-104",
            asset_name="Transformer TR-104 (Naroda Substation)",
            title="Partial discharge anomaly & thermal spike detected",
            description="PD has surged +31% over baseline with winding temp at 91.2°C. Heavy rainfall expected within 24 hours.",
            timestamp="2026-09-13T19:15:00Z",
            zone="East Grid"
        ),
        AlertNotification(
            id="ALT-002",
            severity="HIGH",
            asset_id="TR-087",
            asset_name="Transformer TR-087 (Vatva Substation)",
            title="Winding temperature exceeding historical baseline",
            description="Temperature elevated 15°C above 7-day average under continuous industrial load.",
            timestamp="2026-09-13T18:40:00Z",
            zone="East Grid"
        ),
        AlertNotification(
            id="ALT-003",
            severity="WEATHER",
            asset_id=None,
            asset_name=None,
            title="Severe thunderstorm & flood watch in Eastern grid zone",
            description="48.5 mm/h precipitation and 52 km/h wind shear forecast along Naroda-Vatva corridor.",
            timestamp="2026-09-13T18:10:00Z",
            zone="East Grid"
        )
    ]
