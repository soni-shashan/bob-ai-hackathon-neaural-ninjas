from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import Asset, SensorReading, MaintenanceAction, DemoScenarioState
from app.schemas.schemas import DemoStateResponse
from app.services.dataset_feed_service import dataset_feed_service

class DemoService:
    """
    Operational Scenario Controller.
    Manages the live simulated evolution of Transformer TR-104 (TX-DIST-01) at East Transmission Substation
    across three distinct operational stages:
      1. 'baseline'    -> Risk: 42, Status: Medium, Normal Operations
      2. 'degradation' -> Risk: 68, Status: High, Thermal & Vibration Warning
      3. 'critical'    -> Risk: 94, Status: Critical, Severe Storm & Immediate Failure Threat
    """

    @classmethod
    def get_state(cls, db: Session) -> DemoStateResponse:
        state_row = db.query(DemoScenarioState).filter(DemoScenarioState.id == 1).first()
        stage = state_row.current_stage if state_row else "critical"

        asset = db.query(Asset).filter(Asset.id == "TR-104").first()
        risk = asset.health_score if asset else 94
        
        # Determine metadata based on stage
        if stage == "baseline":
            risk_val = 42
            fail_prob = 0.28
            label = "MODERATE"
            desc = "Stage 1: Baseline nominal operations. Temperature 71.5°C, vibration 3.2 mm/s, partial discharge 18 pC. Standard grid monitoring."
        elif stage == "degradation":
            risk_val = 68
            fail_prob = 0.58
            label = "HIGH"
            desc = "Stage 2: Incipient thermal degradation. Winding temp +10°C, vibration harmonics rising, partial discharge climbing to 28.5 pC."
        else: # critical
            risk_val = 94
            fail_prob = 0.82
            label = "CRITICAL"
            desc = "Stage 3: Critical failure hazard. PD anomaly spike (42 pC), temp 91.2°C, combined with severe thunderstorm storm front. Priority #1 dispatch required."

        return DemoStateResponse(
            current_stage=stage,
            asset_id="TR-104",
            risk_score=risk_val,
            failure_probability=fail_prob,
            status_label=label,
            stage_description=desc,
            last_updated=state_row.last_updated if state_row else datetime.now(timezone.utc).isoformat()
        )

    @classmethod
    def set_stage(cls, db: Session, stage: str) -> DemoStateResponse:
        stage = stage.lower()
        if stage not in ["baseline", "degradation", "critical"]:
            stage = "critical"

        state_row = db.query(DemoScenarioState).filter(DemoScenarioState.id == 1).first()
        if not state_row:
            state_row = DemoScenarioState(id=1, current_stage=stage, last_updated=datetime.now(timezone.utc).isoformat())
            db.add(state_row)
        else:
            state_row.current_stage = stage
            state_row.last_updated = datetime.now(timezone.utc).isoformat()

        # Update TR-104 sensor readings directly from real dataset slice
        slice_df = dataset_feed_service.get_stage_slice(stage, count=100)
        readings = []
        if not slice_df.empty:
            db.query(SensorReading).filter(SensorReading.asset_id == "TR-104").delete()
            readings = dataset_feed_service.convert_slice_to_readings(slice_df, "TR-104")
            db.bulk_save_objects([SensorReading(**r) for r in readings])

        # Update TR-104 record in DB
        asset = db.query(Asset).filter(Asset.id == "TR-104").first()
        action = db.query(MaintenanceAction).filter(MaintenanceAction.asset_id == "TR-104").first()

        if asset:
            if stage == "baseline":
                asset.health_score = 78
                asset.status = "OPERATIONAL"
                if readings:
                    asset.load_mw = readings[-1]["load"]
                if action:
                    action.priority = 4
                    action.action = "Routine Oil Sampling & Diagnostic Scan"
                    action.status = "PENDING"
            elif stage == "degradation":
                asset.health_score = 55
                asset.status = "WARNING"
                if readings:
                    asset.load_mw = readings[-1]["load"]
                if action:
                    action.priority = 2
                    action.action = "Thermal & Vibration Inspection Overhaul"
                    action.status = "PREPARING"
            else: # critical
                asset.health_score = 30
                asset.status = "CRITICAL"
                if readings:
                    asset.load_mw = readings[-1]["load"]
                if action:
                    action.priority = 1
                    action.action = "Immediate Emergency Inspection & Crew Pre-positioning"
                    action.status = "ASSIGNED"

        db.commit()

        # Trigger background ML re-evaluation pass across assets
        try:
            from app.services.ml_background_service import ml_background_service
            ml_background_service.evaluate_all_assets_ml(db, stage=stage)
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(ml_background_service.notify_update(event_type="stage_changed"))
            except RuntimeError:
                pass
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Demo stage ML re-evaluation warning: {e}")

        return cls.get_state(db)

demo_service = DemoService()
