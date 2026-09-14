import math
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.models.models import Asset, SensorReading, WeatherForecast, Incident, Crew, MaintenanceAction, DemoScenarioState, User
from app.services.risk_engine import risk_engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_database(db: Session):
    """
    Populates deterministic mock database with 26 assets, 100+ sensor points each,
    15 historical incidents, 5 crews, multi-zone weather, and maintenance actions.
    Also seeds default admin user on first run.
    """
    # Seed default admin user if not exists
    existing_user = db.query(User).filter(User.email == "neaural.ninjas@electricity.com").first()
    if not existing_user:
        default_user = User(
            email="neaural.ninjas@electricity.com",
            hashed_password=pwd_context.hash("Admin@123"),
            name="Neural Ninjas Admin",
            is_active=True
        )
        db.add(default_user)
        db.commit()

    # Check if already seeded (assets)
    if db.query(Asset).first():
        return

    now = datetime.now(timezone.utc)

    # 1. Assets (Ahmedabad / Gujarat Grid Region Context)
    assets_data = [
        # Primary Demo Asset
        {
            "id": "TR-104",
            "name": "Naroda 400kV Step-Down Transformer 104",
            "asset_type": "Power Transformer",
            "substation": "Naroda Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0685,
            "longitude": 72.6562,
            "capacity_mva": 100.0,
            "load_mw": 42.0,
            "health_score": 42, # Poor health score
            "criticality_score": 94,
            "customers_affected": 18500,
            "status": "CRITICAL",
            "installed_date": "2016-08-12",
            "last_maintenance": "2026-02-14"
        },
        {
            "id": "TR-087",
            "name": "Vatva Heavy Feeder Transformer 087",
            "asset_type": "Power Transformer",
            "substation": "Vatva Substation",
            "grid_zone": "East Grid",
            "latitude": 22.9560,
            "longitude": 72.6350,
            "capacity_mva": 80.0,
            "load_mw": 38.5,
            "health_score": 48,
            "criticality_score": 91,
            "customers_affected": 14200,
            "status": "CRITICAL",
            "installed_date": "2017-03-22",
            "last_maintenance": "2026-01-20"
        },
        {
            "id": "TR-221",
            "name": "Odhav Industrial Interconnect 221",
            "asset_type": "Auto-Transformer",
            "substation": "Odhav Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0245,
            "longitude": 72.6715,
            "capacity_mva": 90.0,
            "load_mw": 34.0,
            "health_score": 53,
            "criticality_score": 88,
            "customers_affected": 11800,
            "status": "WARNING",
            "installed_date": "2019-11-10",
            "last_maintenance": "2026-04-05"
        },
        {
            "id": "CB-104",
            "name": "Naroda 400kV SF6 Circuit Breaker",
            "asset_type": "Circuit Breaker",
            "substation": "Naroda Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0690,
            "longitude": 72.6570,
            "capacity_mva": 120.0,
            "load_mw": 42.0,
            "health_score": 58,
            "criticality_score": 85,
            "customers_affected": 18500,
            "status": "WARNING",
            "installed_date": "2018-05-14",
            "last_maintenance": "2026-03-01"
        },
        {
            "id": "TR-305",
            "name": "Gandhinagar Ring Auto-Transformer 305",
            "asset_type": "Auto-Transformer",
            "substation": "Gandhinagar Substation",
            "grid_zone": "North Grid",
            "latitude": 23.2156,
            "longitude": 72.6369,
            "capacity_mva": 150.0,
            "load_mw": 58.0,
            "health_score": 62,
            "criticality_score": 82,
            "customers_affected": 9400,
            "status": "WARNING",
            "installed_date": "2020-02-18",
            "last_maintenance": "2026-05-12"
        },
        {
            "id": "TR-118",
            "name": "Sabarmati Central Grid Step-Down",
            "asset_type": "Power Transformer",
            "substation": "Sabarmati Substation",
            "grid_zone": "Central Grid",
            "latitude": 23.0810,
            "longitude": 72.5850,
            "capacity_mva": 75.0,
            "load_mw": 28.0,
            "health_score": 76,
            "criticality_score": 75,
            "customers_affected": 8100,
            "status": "OPERATIONAL",
            "installed_date": "2021-06-08",
            "last_maintenance": "2026-06-15"
        },
        {
            "id": "FD-042",
            "name": "Sanand Automotive Feeder Unit 42",
            "asset_type": "Substation Feeder",
            "substation": "Sanand Substation",
            "grid_zone": "South Grid",
            "latitude": 22.9850,
            "longitude": 72.3850,
            "capacity_mva": 60.0,
            "load_mw": 26.0,
            "health_score": 82,
            "criticality_score": 70,
            "customers_affected": 4200,
            "status": "OPERATIONAL",
            "installed_date": "2022-01-19",
            "last_maintenance": "2026-07-22"
        },
        {
            "id": "TR-402",
            "name": "Bopal Suburban Distribution Unit",
            "asset_type": "Power Transformer",
            "substation": "Bopal Substation",
            "grid_zone": "West Grid",
            "latitude": 23.0380,
            "longitude": 72.4650,
            "capacity_mva": 50.0,
            "load_mw": 19.5,
            "health_score": 88,
            "criticality_score": 62,
            "customers_affected": 3600,
            "status": "OPERATIONAL",
            "installed_date": "2022-09-14",
            "last_maintenance": "2026-08-01"
        },
        {
            "id": "BB-201",
            "name": "SG Highway 220kV Main Busbar Section",
            "asset_type": "Busbar Section",
            "substation": "Thaltej Substation",
            "grid_zone": "West Grid",
            "latitude": 23.0540,
            "longitude": 72.5120,
            "capacity_mva": 110.0,
            "load_mw": 32.0,
            "health_score": 91,
            "criticality_score": 78,
            "customers_affected": 5200,
            "status": "OPERATIONAL",
            "installed_date": "2021-04-10",
            "last_maintenance": "2026-08-15"
        },
        {
            "id": "TR-055",
            "name": "Chandkheda Northern Intertie Transformer",
            "asset_type": "Power Transformer",
            "substation": "Chandkheda Substation",
            "grid_zone": "North Grid",
            "latitude": 23.1120,
            "longitude": 72.5920,
            "capacity_mva": 70.0,
            "load_mw": 25.0,
            "health_score": 69,
            "criticality_score": 68,
            "customers_affected": 4900,
            "status": "WARNING",
            "installed_date": "2019-07-25",
            "last_maintenance": "2026-02-28"
        },
        {
            "id": "TR-168",
            "name": "Nikol Heavy Load Feeder Transformer",
            "asset_type": "Power Transformer",
            "substation": "Nikol Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0450,
            "longitude": 72.6680,
            "capacity_mva": 65.0,
            "load_mw": 31.0,
            "health_score": 56,
            "criticality_score": 79,
            "customers_affected": 7300,
            "status": "WARNING",
            "installed_date": "2018-12-05",
            "last_maintenance": "2026-03-18"
        },
        {
            "id": "CB-087",
            "name": "Vatva 220kV Line Breaker Unit",
            "asset_type": "Circuit Breaker",
            "substation": "Vatva Substation",
            "grid_zone": "East Grid",
            "latitude": 22.9565,
            "longitude": 72.6355,
            "capacity_mva": 85.0,
            "load_mw": 38.5,
            "health_score": 52,
            "criticality_score": 83,
            "customers_affected": 14200,
            "status": "CRITICAL",
            "installed_date": "2017-09-12",
            "last_maintenance": "2026-01-14"
        },
        {
            "id": "TR-512",
            "name": "Maninagar Traction Substation Unit",
            "asset_type": "Power Transformer",
            "substation": "Maninagar Substation",
            "grid_zone": "Central Grid",
            "latitude": 22.9980,
            "longitude": 72.6050,
            "capacity_mva": 55.0,
            "load_mw": 22.0,
            "health_score": 84,
            "criticality_score": 74,
            "customers_affected": 3100,
            "status": "OPERATIONAL",
            "installed_date": "2023-03-01",
            "last_maintenance": "2026-06-20"
        },
        {
            "id": "TR-330",
            "name": "Sarkhej Logistics Distribution Feeder",
            "asset_type": "Power Transformer",
            "substation": "Sarkhej Substation",
            "grid_zone": "South Grid",
            "latitude": 22.9820,
            "longitude": 72.4980,
            "capacity_mva": 45.0,
            "load_mw": 18.0,
            "health_score": 79,
            "criticality_score": 64,
            "customers_affected": 2800,
            "status": "OPERATIONAL",
            "installed_date": "2021-10-15",
            "last_maintenance": "2026-05-30"
        },
        {
            "id": "FD-112",
            "name": "Asarwa Civil Hospital Dedicated Feeder",
            "asset_type": "Substation Feeder",
            "substation": "Asarwa Substation",
            "grid_zone": "Central Grid",
            "latitude": 23.0490,
            "longitude": 72.6020,
            "capacity_mva": 40.0,
            "load_mw": 16.0,
            "health_score": 89,
            "criticality_score": 96, # Very high criticality (Trauma center)
            "customers_affected": 2200,
            "status": "OPERATIONAL",
            "installed_date": "2023-08-10",
            "last_maintenance": "2026-08-25"
        },
        {
            "id": "TR-092",
            "name": "Changodar Heavy Industrial Transformer",
            "asset_type": "Power Transformer",
            "substation": "Changodar Substation",
            "grid_zone": "South Grid",
            "latitude": 22.9150,
            "longitude": 72.4410,
            "capacity_mva": 95.0,
            "load_mw": 41.0,
            "health_score": 64,
            "criticality_score": 72,
            "customers_affected": 3900,
            "status": "WARNING",
            "installed_date": "2019-01-20",
            "last_maintenance": "2026-04-12"
        },
        {
            "id": "BB-104",
            "name": "Naroda 220kV Transfer Bus Section",
            "asset_type": "Busbar Section",
            "substation": "Naroda Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0688,
            "longitude": 72.6568,
            "capacity_mva": 130.0,
            "load_mw": 42.0,
            "health_score": 61,
            "criticality_score": 89,
            "customers_affected": 18500,
            "status": "WARNING",
            "installed_date": "2018-09-05",
            "last_maintenance": "2026-03-12"
        },
        {
            "id": "TR-420",
            "name": "Ranip Rail & Metro Intertie Unit",
            "asset_type": "Auto-Transformer",
            "substation": "Ranip Substation",
            "grid_zone": "North Grid",
            "latitude": 23.0780,
            "longitude": 72.5650,
            "capacity_mva": 60.0,
            "load_mw": 23.0,
            "health_score": 83,
            "criticality_score": 77,
            "customers_affected": 4100,
            "status": "OPERATIONAL",
            "installed_date": "2022-04-18",
            "last_maintenance": "2026-07-10"
        },
        {
            "id": "TR-105",
            "name": "Naroda Auxiliary Substation Transformer 105",
            "asset_type": "Power Transformer",
            "substation": "Naroda Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0692,
            "longitude": 72.6558,
            "capacity_mva": 45.0,
            "load_mw": 14.0,
            "health_score": 78,
            "criticality_score": 71,
            "customers_affected": 3200,
            "status": "OPERATIONAL",
            "installed_date": "2021-02-14",
            "last_maintenance": "2026-05-19"
        },
        {
            "id": "FD-201",
            "name": "GIDC Vatva Chemical Zone Feeder",
            "asset_type": "Substation Feeder",
            "substation": "Vatva Substation",
            "grid_zone": "East Grid",
            "latitude": 22.9550,
            "longitude": 72.6340,
            "capacity_mva": 50.0,
            "load_mw": 24.0,
            "health_score": 67,
            "criticality_score": 73,
            "customers_affected": 2900,
            "status": "WARNING",
            "installed_date": "2020-11-20",
            "last_maintenance": "2026-03-25"
        },
        {
            "id": "TR-602",
            "name": "Prahlad Nagar Commercial Core Transformer",
            "asset_type": "Power Transformer",
            "substation": "Thaltej Substation",
            "grid_zone": "West Grid",
            "latitude": 23.0120,
            "longitude": 72.5080,
            "capacity_mva": 70.0,
            "load_mw": 29.0,
            "health_score": 86,
            "criticality_score": 66,
            "customers_affected": 4500,
            "status": "OPERATIONAL",
            "installed_date": "2023-01-15",
            "last_maintenance": "2026-08-10"
        },
        {
            "id": "CB-305",
            "name": "Gandhinagar Ring 400kV Breaker",
            "asset_type": "Circuit Breaker",
            "substation": "Gandhinagar Substation",
            "grid_zone": "North Grid",
            "latitude": 23.2160,
            "longitude": 72.6375,
            "capacity_mva": 140.0,
            "load_mw": 58.0,
            "health_score": 71,
            "criticality_score": 80,
            "customers_affected": 9400,
            "status": "OPERATIONAL",
            "installed_date": "2020-03-10",
            "last_maintenance": "2026-04-18"
        },
        {
            "id": "TR-711",
            "name": "Bavla Rural Intertie Transformer",
            "asset_type": "Power Transformer",
            "substation": "Sanand Substation",
            "grid_zone": "South Grid",
            "latitude": 22.8350,
            "longitude": 72.3650,
            "capacity_mva": 40.0,
            "load_mw": 14.5,
            "health_score": 73,
            "criticality_score": 59,
            "customers_affected": 1800,
            "status": "OPERATIONAL",
            "installed_date": "2019-09-28",
            "last_maintenance": "2026-05-02"
        },
        {
            "id": "FD-088",
            "name": "Ahmedabad Airport Aviation Feeder",
            "asset_type": "Substation Feeder",
            "substation": "Naroda Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0720,
            "longitude": 72.6320,
            "capacity_mva": 35.0,
            "load_mw": 11.5,
            "health_score": 92,
            "criticality_score": 98, # High criticality
            "customers_affected": 1200,
            "status": "OPERATIONAL",
            "installed_date": "2023-11-12",
            "last_maintenance": "2026-08-20"
        },
        {
            "id": "TR-804",
            "name": "Vastrapur Urban Residential Transformer",
            "asset_type": "Power Transformer",
            "substation": "Thaltej Substation",
            "grid_zone": "West Grid",
            "latitude": 23.0360,
            "longitude": 72.5280,
            "capacity_mva": 50.0,
            "load_mw": 21.0,
            "health_score": 90,
            "criticality_score": 60,
            "customers_affected": 3800,
            "status": "OPERATIONAL",
            "installed_date": "2022-07-19",
            "last_maintenance": "2026-07-28"
        },
        {
            "id": "CB-221",
            "name": "Odhav 66kV Outgoing Line Breaker",
            "asset_type": "Circuit Breaker",
            "substation": "Odhav Substation",
            "grid_zone": "East Grid",
            "latitude": 23.0250,
            "longitude": 72.6720,
            "capacity_mva": 65.0,
            "load_mw": 34.0,
            "health_score": 63,
            "criticality_score": 76,
            "customers_affected": 11800,
            "status": "WARNING",
            "installed_date": "2019-12-01",
            "last_maintenance": "2026-03-05"
        }
    ]

    for a_dict in assets_data:
        asset = Asset(**a_dict)
        db.add(asset)

    db.flush()

    # 2. Sensor Readings (100+ points per asset over past 24 hours)
    sensor_records = []
    # 100 points at ~14.4 minute intervals over 24 hours
    for a in assets_data:
        a_id = a["id"]
        is_tr104 = (a_id == "TR-104")
        is_tr087 = (a_id == "TR-087")
        is_tr221 = (a_id == "TR-221")

        for step in range(100):
            # t_offset from 24h ago to now
            hours_ago = 24.0 * (1.0 - (step / 99.0))
            ts = (now - timedelta(hours=hours_ago)).isoformat()
            fraction = step / 99.0 # 0.0 to 1.0

            if is_tr104:
                # Upward degradation trajectory to critical values
                temp = 73.0 + fraction * 18.2 + math.sin(step * 0.4) * 0.8 # up to 91.2°C
                vib = 3.2 + fraction * 4.6 + math.sin(step * 0.6) * 0.25   # up to 7.8 mm/s
                pd = 18.0 + (fraction**1.8) * 24.0 + math.cos(step * 0.3) * 0.5 # spikes to 42 pC
                oil = 82.0 - fraction * 30.0 + math.sin(step * 0.2) * 1.0  # degrades to 52
                load = 52.0 + fraction * 32.0 + math.cos(step * 0.5) * 1.5 # up to 84 MW
            elif is_tr087:
                temp = 72.0 + fraction * 15.0 + math.sin(step * 0.3) * 0.7 # up to 87.0°C
                vib = 3.0 + fraction * 3.8 + math.sin(step * 0.5) * 0.2    # up to 6.8 mm/s
                pd = 16.0 + fraction * 18.0 + math.cos(step * 0.4) * 0.4   # up to 34 pC
                oil = 80.0 - fraction * 22.0
                load = 48.0 + fraction * 25.0
            elif is_tr221:
                temp = 70.0 + fraction * 12.0 + math.sin(step * 0.3) * 0.5
                vib = 2.8 + fraction * 3.0
                pd = 15.0 + fraction * 15.0
                oil = 84.0 - fraction * 18.0
                load = 45.0 + fraction * 20.0
            else:
                # Nominal healthy fluctuations
                temp = 64.0 + math.sin(step * 0.2) * 3.5
                vib = 2.1 + math.cos(step * 0.3) * 0.4
                pd = 12.0 + math.sin(step * 0.25) * 2.0
                oil = 88.0 - math.sin(step * 0.1) * 2.0
                load = 32.0 + math.sin(step * 0.15) * 5.0

            sensor_records.append(SensorReading(
                asset_id=a_id,
                timestamp=ts,
                temperature=round(temp, 2),
                vibration=round(vib, 2),
                partial_discharge=round(pd, 2),
                oil_quality=round(oil, 2),
                load=round(load, 2),
                ambient_temperature=round(30.0 + math.sin(step * 0.15) * 4.0, 1)
            ))

    db.bulk_save_objects(sensor_records)

    # 3. Weather Forecasts
    weather_rows = [
        WeatherForecast(
            zone="east",
            zone_name="Eastern Industrial Grid (Naroda / Odhav / Vatva)",
            timestamp=now.isoformat(),
            condition="Severe Thunderstorms & Torrential Rain",
            rainfall_prob=85,
            rainfall_intensity_mm=48.5,
            wind_kmh=52.0,
            lightning_risk="HIGH",
            flood_risk="ELEVATED",
            weather_risk_level="HIGH",
            weather_score=78,
            temperature_c=29.4
        ),
        WeatherForecast(
            zone="central",
            zone_name="Central Urban Grid (Ahmedabad Metro)",
            timestamp=now.isoformat(),
            condition="Scattered Showers & Moderate Wind",
            rainfall_prob=45,
            rainfall_intensity_mm=12.0,
            wind_kmh=28.0,
            lightning_risk="MODERATE",
            flood_risk="MINIMAL",
            weather_risk_level="MODERATE",
            weather_score=42,
            temperature_c=31.2
        ),
        WeatherForecast(
            zone="west",
            zone_name="Western Commercial Corridor (SG Highway / Bopal)",
            timestamp=now.isoformat(),
            condition="Partly Cloudy",
            rainfall_prob=20,
            rainfall_intensity_mm=2.5,
            wind_kmh=22.0,
            lightning_risk="LOW",
            flood_risk="MINIMAL",
            weather_risk_level="LOW",
            weather_score=24,
            temperature_c=33.5
        ),
        WeatherForecast(
            zone="north",
            zone_name="Northern Substation Ring (Gandhinagar / Chandkheda)",
            timestamp=now.isoformat(),
            condition="Gusty Winds & Rain Bands",
            rainfall_prob=60,
            rainfall_intensity_mm=22.0,
            wind_kmh=38.0,
            lightning_risk="MODERATE",
            flood_risk="MINIMAL",
            weather_risk_level="MODERATE",
            weather_score=51,
            temperature_c=30.1
        ),
        WeatherForecast(
            zone="south",
            zone_name="Southern Logistics Hub (Sanand / Sarkhej)",
            timestamp=now.isoformat(),
            condition="Overcast with Light Breeze",
            rainfall_prob=30,
            rainfall_intensity_mm=5.0,
            wind_kmh=24.0,
            lightning_risk="LOW",
            flood_risk="MINIMAL",
            weather_risk_level="LOW",
            weather_score=31,
            temperature_c=32.8
        )
    ]
    db.bulk_save_objects(weather_rows)

    # 4. Crews
    crews_data = [
        Crew(
            id="CREW-01",
            name="Rapid Response Team Alpha",
            status="ASSIGNED",
            depot_name="Vatva Regional Depot",
            latitude=22.9570,
            longitude=72.6340,
            skills=["HV Feeder Breakers", "Gas Insulated Switchgear", "Emergency De-energization"],
            equipment=["SF6 Gas Recovery Cart", "Breaker Timing Analyzer", "100kV Dielectric Tester"],
            available_from="Immediate",
            assigned_asset_id="TR-087"
        ),
        Crew(
            id="CREW-02",
            name="Heavy Transformer Diagnostic Unit 2",
            status="ASSIGNED",
            depot_name="Ahmedabad East Depot (Staged 10 km from Naroda)",
            latitude=23.0550,
            longitude=72.6650,
            skills=["HV Transformer Diagnostics", "Electrical Thermal Inspection", "Oil DGA Sampling", "Bushing Replacement"],
            equipment=["FLIR High-Res Thermal Camera", "Portable Oil Dissolved Gas Analyzer", "HV Safety PPE 400kV", "Transformer Winding Ohmmeter"],
            available_from="Immediate",
            assigned_asset_id="TR-104"
        ),
        Crew(
            id="CREW-03",
            name="Substation Protection & Busbar Squad",
            status="PREPARING",
            depot_name="Odhav East Substation Staging Yard",
            latitude=23.0240,
            longitude=72.6710,
            skills=["Busbar Differential Protection", "CT/PT Calibration", "Emergency Switching"],
            equipment=["Relay Test Set", "Secondary Injection Kit", "Busbar Grounding Rigs"],
            available_from="15 mins",
            assigned_asset_id="TR-221"
        ),
        Crew(
            id="CREW-04",
            name="Northern Corridor Overhead Line Patrol",
            status="AVAILABLE",
            depot_name="Gandhinagar North Depot",
            latitude=23.2150,
            longitude=72.6360,
            skills=["Transmission Line Repair", "Thermal Drone Sweeps", "Insulator String Washing"],
            equipment=["Industrial Inspection Drone", "Live-Line Insulator Wash Truck", "Climbing Rigging Sets"],
            available_from="Immediate",
            assigned_asset_id=None
        ),
        Crew(
            id="CREW-05",
            name="Emergency Grid Restoration Corps",
            status="STANDBY",
            depot_name="Ahmedabad Central Operations Center Depot",
            latitude=23.0300,
            longitude=72.5800,
            skills=["Mobile Substation Deployment", "Load Shedding Management", "Black-Start Support"],
            equipment=["50 MVA Mobile Substation Trailer", "Heavy Diesel Generators (2MW)", "Satellite Comms Rig"],
            available_from="30 mins",
            assigned_asset_id=None
        )
    ]
    db.bulk_save_objects(crews_data)

    # 5. Maintenance Actions
    actions_data = [
        MaintenanceAction(
            id="MA-101",
            asset_id="TR-104",
            crew_id="CREW-02",
            priority=1,
            action="Immediate Emergency Thermal & Partial Discharge Inspection",
            status="ASSIGNED",
            scheduled_time=(now + timedelta(hours=2)).isoformat(),
            estimated_duration_hours=4.5,
            reason="82% failure probability with severe rain forecast; supplies 18,500 customers and trauma hospital feeder.",
            expected_risk_reduction_pct=58
        ),
        MaintenanceAction(
            id="MA-102",
            asset_id="TR-087",
            crew_id="CREW-01",
            priority=2,
            action="Preventive Winding Degassing & Feeder Breaker Overhaul",
            status="ASSIGNED",
            scheduled_time=(now + timedelta(hours=5)).isoformat(),
            estimated_duration_hours=5.0,
            reason="Thermal gradient elevated 15°C above baseline under peak industrial draw.",
            expected_risk_reduction_pct=45
        ),
        MaintenanceAction(
            id="MA-103",
            asset_id="TR-221",
            crew_id="CREW-03",
            priority=3,
            action="Equipment Standby & Bushing Leakage Current Scan",
            status="PREPARING",
            scheduled_time=(now + timedelta(hours=8)).isoformat(),
            estimated_duration_hours=3.5,
            reason="High vibration harmonics during load transfers with incoming storm front.",
            expected_risk_reduction_pct=40
        ),
        MaintenanceAction(
            id="MA-104",
            asset_id="CB-104",
            crew_id=None,
            priority=4,
            action="SF6 Moisture Verification & Contact Resistance Check",
            status="PENDING",
            scheduled_time=(now + timedelta(days=1)).isoformat(),
            estimated_duration_hours=3.0,
            reason="Pre-storm dielectric check for main 400kV intertie breaker.",
            expected_risk_reduction_pct=30
        ),
        MaintenanceAction(
            id="MA-105",
            asset_id="TR-055",
            crew_id=None,
            priority=5,
            action="Routine Radiator Cleanse & Oil Sampling",
            status="PENDING",
            scheduled_time=(now + timedelta(days=2)).isoformat(),
            estimated_duration_hours=2.5,
            reason="Scheduled bi-monthly thermal dissipation maintenance.",
            expected_risk_reduction_pct=25
        )
    ]
    db.bulk_save_objects(actions_data)

    # 6. Historical Incidents (15 realistic events)
    incidents_data = [
        Incident(
            id="INC-2026-089",
            asset_id="TR-104",
            timestamp="2026-08-12T14:20:00Z",
            failure_type="Transformer Winding Overheating",
            severity="HIGH",
            duration_minutes=342,
            customers_affected=16200,
            root_cause="Cooling fan bank circuit trip during high ambient heat (44°C) combined with 92% load.",
            weather_condition="Extreme Heatwave (44°C, Dry)",
            resolution="Forced air cooling auxiliary circuit breaker replaced; oil circulation pumps serviced.",
            location="Naroda Substation"
        ),
        Incident(
            id="INC-2026-045",
            asset_id="TR-104",
            timestamp="2026-04-18T09:15:00Z",
            failure_type="Partial Discharge Alarm & Dielectric Warning",
            severity="MEDIUM",
            duration_minutes=180,
            customers_affected=4200,
            root_cause="Moisture ingress through defective conservator silica gel breather seal.",
            weather_condition="Unseasonal Rain (22mm)",
            resolution="Breather assembly replaced; vacuum dehydration filter cycle performed on top-oil.",
            location="Naroda Substation"
        ),
        Incident(
            id="INC-2025-112",
            asset_id="TR-104",
            timestamp="2025-11-04T18:40:00Z",
            failure_type="Bushing Flashtip Partial Arc",
            severity="HIGH",
            duration_minutes=290,
            customers_affected=12800,
            root_cause="Industrial particulate dust deposition followed by high morning dew point.",
            weather_condition="Heavy Fog / Dew (98% Humidity)",
            resolution="High-pressure silicone insulator wash completed; hydrophobic RTV coating applied.",
            location="Naroda Substation"
        ),
        Incident(
            id="INC-2026-077",
            asset_id="TR-087",
            timestamp="2026-07-02T11:30:00Z",
            failure_type="Feeder Overload Trip",
            severity="HIGH",
            duration_minutes=210,
            customers_affected=14200,
            root_cause="Simultaneous industrial furnace startups in Vatva GIDC industrial estate.",
            weather_condition="Hot & Humid (39°C)",
            resolution="Dynamic load limiters configured; secondary transformer line sharing activated.",
            location="Vatva Substation"
        ),
        Incident(
            id="INC-2026-061",
            asset_id="TR-221",
            timestamp="2026-06-14T16:05:00Z",
            failure_type="Harmonic Resonance & High Vibration",
            severity="MEDIUM",
            duration_minutes=145,
            customers_affected=3800,
            root_cause="Loose clamping bolt on core laminations aggravated by external grid fault harmonic.",
            weather_condition="Thunderstorm Wind Gusts (45 km/h)",
            resolution="Core yoke clamps retorqued; acoustic vibration sensor installed.",
            location="Odhav Substation"
        ),
        Incident(
            id="INC-2026-031",
            asset_id="CB-104",
            timestamp="2026-03-29T21:10:00Z",
            failure_type="SF6 Gas Pressure Drop Warning",
            severity="MEDIUM",
            duration_minutes=120,
            customers_affected=0,
            root_cause="Micro-fissure on gas valve gasket seal.",
            weather_condition="Mild / Clear",
            resolution="Gasket replaced, gas topped up to 6.2 bar nominal pressure.",
            location="Naroda Substation"
        ),
        Incident(
            id="INC-2025-204",
            asset_id="TR-305",
            timestamp="2025-09-18T13:45:00Z",
            failure_type="Lightning Surge Arrester Operation",
            severity="HIGH",
            duration_minutes=195,
            customers_affected=8900,
            root_cause="Direct lightning stroke on incoming 400kV line tower 14.",
            weather_condition="Severe Lightning Storm",
            resolution="Surge arrester counter logged; insulator string resistance certified; line re-energized.",
            location="Gandhinagar Substation"
        ),
        Incident(
            id="INC-2025-188",
            asset_id="TR-118",
            timestamp="2025-08-09T08:20:00Z",
            failure_type="Buchholz Relay Gas Accumulation Alarm",
            severity="CRITICAL",
            duration_minutes=480,
            customers_affected=15400,
            root_cause="Internal minor inter-turn insulation puncture creating hydrogen gas bubbling.",
            weather_condition="Monsoon Downpour (65mm)",
            resolution="Internal inspection and repair of high-voltage winding lead connection.",
            location="Sabarmati Substation"
        ),
        Incident(
            id="INC-2026-012",
            asset_id="FD-042",
            timestamp="2026-01-22T06:10:00Z",
            failure_type="Underground Cable Fault",
            severity="MEDIUM",
            duration_minutes=260,
            customers_affected=4200,
            root_cause="Third-party pipeline excavator damaged 33kV distribution feeder duct.",
            weather_condition="Cold / Dry",
            resolution="Cable jointing bay excavated and heat-shrink repair splice completed.",
            location="Sanand Substation"
        ),
        Incident(
            id="INC-2025-142",
            asset_id="BB-201",
            timestamp="2025-07-15T19:30:00Z",
            failure_type="Busbar Zone Differential Trip",
            severity="CRITICAL",
            duration_minutes=310,
            customers_affected=21000,
            root_cause="Corroded aluminum connector terminal overheated and detached.",
            weather_condition="Heavy Wind & Monsoon Rain",
            resolution="Bi-metallic clamp replaced with copper-cladded heavy duty terminal.",
            location="Thaltej Substation"
        ),
        Incident(
            id="INC-2026-052",
            asset_id="TR-168",
            timestamp="2026-05-11T12:00:00Z",
            failure_type="Oil Temperature Indicator Drift",
            severity="LOW",
            duration_minutes=90,
            customers_affected=0,
            root_cause="RTD sensor calibration failure.",
            weather_condition="Hot (41°C)",
            resolution="Replaced PT100 sensor probe and recalibrated marshalling box indicator.",
            location="Nikol Substation"
        ),
        Incident(
            id="INC-2026-004",
            asset_id="TR-402",
            timestamp="2026-01-08T15:25:00Z",
            failure_type="Tap Changer Mechanism Jam",
            severity="MEDIUM",
            duration_minutes=175,
            customers_affected=2600,
            root_cause="Mechanical drive motor gear shear pin broke during tap adjustment.",
            weather_condition="Clear / Mild",
            resolution="Drive mechanism replaced; manual crank exercised; automated control verified.",
            location="Bopal Substation"
        ),
        Incident(
            id="INC-2025-095",
            asset_id="TR-092",
            timestamp="2025-06-28T17:40:00Z",
            failure_type="Cooling Radiator Pin-hole Oil Seepage",
            severity="LOW",
            duration_minutes=110,
            customers_affected=0,
            root_cause="Vibration-induced fatigue crack on bottom fin weld.",
            weather_condition="Cloudy / Warm",
            resolution="Epoxy seal applied as emergency measure followed by permanent weld repair.",
            location="Changodar Substation"
        ),
        Incident(
            id="INC-2025-055",
            asset_id="TR-087",
            timestamp="2025-04-19T22:15:00Z",
            failure_type="Neutral Grounding Resistor Over-temp",
            severity="MEDIUM",
            duration_minutes=130,
            customers_affected=3100,
            root_cause="Unbalanced phase draw from induction motor plant in feeder zone.",
            weather_condition="Dry / Windy",
            resolution="Feeder phase rebalancing conducted across substation bus ties.",
            location="Vatva Substation"
        ),
        Incident(
            id="INC-2026-081",
            asset_id="TR-105",
            timestamp="2026-08-01T10:30:00Z",
            failure_type="Auxiliary Transformer Fuse Blow",
            severity="LOW",
            duration_minutes=45,
            customers_affected=0,
            root_cause="Transient switching surge during 400kV bus re-configuration.",
            weather_condition="Light Drizzle",
            resolution="High-rupturing capacity (HRC) fuse replaced; surge arresters verified.",
            location="Naroda Substation"
        )
    ]
    db.bulk_save_objects(incidents_data)

    # 7. Demo Scenario State (default is 'critical' for high-impact demo, can be switched)
    demo_state = DemoScenarioState(id=1, current_stage="critical", last_updated=now.isoformat())
    db.add(demo_state)

    db.commit()
