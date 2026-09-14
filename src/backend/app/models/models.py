from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False, default="Admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(String(30), default=lambda: datetime.now(timezone.utc).isoformat())

class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    asset_type = Column(String(50), nullable=False)
    substation = Column(String(100), nullable=False)
    grid_zone = Column(String(50), default="East Grid")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity_mva = Column(Float, default=50.0)
    load_mw = Column(Float, default=35.0)
    health_score = Column(Integer, default=75)
    criticality_score = Column(Integer, default=70)
    customers_affected = Column(Integer, default=5000)
    status = Column(String(20), default="OPERATIONAL") # OPERATIONAL, WARNING, CRITICAL, MAINTENANCE
    installed_date = Column(String(20), default="2018-04-15")
    last_maintenance = Column(String(20), default="2026-03-10")

    sensor_readings = relationship("SensorReading", back_populates="asset", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="asset")
    maintenance_actions = relationship("MaintenanceAction", back_populates="asset")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(String(50), ForeignKey("assets.id"), index=True, nullable=False)
    timestamp = Column(String(30), nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    vibration = Column(Float, nullable=False)
    partial_discharge = Column(Float, nullable=False)
    oil_quality = Column(Float, nullable=False)
    load = Column(Float, nullable=False)
    ambient_temperature = Column(Float, default=32.0)

    asset = relationship("Asset", back_populates="sensor_readings")


class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone = Column(String(50), nullable=False, index=True) # east, west, north, south, central
    zone_name = Column(String(100), nullable=False)
    timestamp = Column(String(30), nullable=False)
    condition = Column(String(50), default="Clear")
    rainfall_prob = Column(Integer, default=15)
    rainfall_intensity_mm = Column(Float, default=0.0)
    wind_kmh = Column(Float, default=18.0)
    lightning_risk = Column(String(20), default="LOW") # LOW, MODERATE, HIGH, SEVERE
    flood_risk = Column(String(20), default="MINIMAL") # MINIMAL, ELEVATED, HIGH, SEVERE
    weather_risk_level = Column(String(20), default="LOW") # LOW, MODERATE, HIGH, VERY_HIGH, CRITICAL
    weather_score = Column(Integer, default=20) # 0 - 100
    temperature_c = Column(Float, default=33.0)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(50), primary_key=True, index=True)
    asset_id = Column(String(50), ForeignKey("assets.id"), index=True, nullable=False)
    timestamp = Column(String(30), nullable=False)
    failure_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    duration_minutes = Column(Integer, default=120)
    customers_affected = Column(Integer, default=2000)
    root_cause = Column(Text, nullable=False)
    weather_condition = Column(String(100), default="Dry / Normal")
    resolution = Column(Text, nullable=False)
    location = Column(String(100), nullable=False)

    asset = relationship("Asset", back_populates="incidents")


class Crew(Base):
    __tablename__ = "crews"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    status = Column(String(20), default="AVAILABLE") # AVAILABLE, ASSIGNED, STANDBY, EN_ROUTE
    depot_name = Column(String(100), default="Ahmedabad Central Depot")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    skills = Column(JSON, default=list)
    equipment = Column(JSON, default=list)
    available_from = Column(String(30), default="Immediate")
    assigned_asset_id = Column(String(50), nullable=True)


class MaintenanceAction(Base):
    __tablename__ = "maintenance_actions"

    id = Column(String(50), primary_key=True, index=True)
    asset_id = Column(String(50), ForeignKey("assets.id"), index=True, nullable=False)
    crew_id = Column(String(50), ForeignKey("crews.id"), nullable=True)
    priority = Column(Integer, default=3) # 1 (Highest) to 5
    action = Column(String(200), nullable=False)
    status = Column(String(20), default="PENDING") # PENDING, PREPARING, ASSIGNED, IN_PROGRESS, COMPLETED
    scheduled_time = Column(String(30), nullable=False)
    estimated_duration_hours = Column(Float, default=4.0)
    reason = Column(Text, nullable=False)
    expected_risk_reduction_pct = Column(Integer, default=50)

    asset = relationship("Asset", back_populates="maintenance_actions")


class DemoScenarioState(Base):
    __tablename__ = "demo_scenario_state"

    id = Column(Integer, primary_key=True, default=1)
    current_stage = Column(String(30), default="critical") # baseline, degradation, critical
    last_updated = Column(String(30), default=lambda: datetime.now(timezone.utc).isoformat())
