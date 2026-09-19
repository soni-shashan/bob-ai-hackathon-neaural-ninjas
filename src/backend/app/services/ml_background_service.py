"""
ML Background Service.
Handles asynchronous background execution of machine learning models when data changes,
persists pre-computed predictions to the database, and streams real-time SSE notifications
to live dashboard subscribers.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, AsyncGenerator
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.models import Asset, SensorReading, DemoScenarioState
from app.services.dataset_feed_service import dataset_feed_service
from app.ml.health_score import compute_health_score_single
from app.ml.anomaly_detector import anomaly_detector
from app.ml.mog_classifier import mog_classifier
from app.ml.equipment_risk import equipment_risk_engine
from app.ml.weather_engine import weather_risk_engine
from app.services.risk_engine import risk_engine

logger = logging.getLogger(__name__)


class MLBackgroundService:
    """
    Background worker service that executes multi-stage ML model evaluation 
    in background async tasks upon data changes and broadcasts live updates via SSE.
    """

    def __init__(self):
        self._subscribers: List[asyncio.Queue] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """Subscribe to live SSE ML update events."""
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subscribers.append(queue)
            logger.info(f"New dashboard SSE subscriber connected. Total subscribers: {len(self._subscribers)}")

        try:
            # Yield initial connection heartbeat
            yield f"data: {{\"event\": \"connected\", \"timestamp\": \"{datetime.now(timezone.utc).isoformat()}\"}}\n\n"
            while True:
                msg = await queue.get()
                yield f"data: {msg}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            async with self._lock:
                if queue in self._subscribers:
                    self._subscribers.remove(queue)
                    logger.info(f"Dashboard SSE subscriber disconnected. Remaining: {len(self._subscribers)}")

    async def notify_update(self, asset_id: Optional[str] = None, event_type: str = "ml_updated"):
        """Broadcast ML update notification to all active SSE subscribers."""
        import json
        payload = json.dumps({
            "event": event_type,
            "asset_id": asset_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        async with self._lock:
            for q in self._subscribers:
                await q.put(payload)

    @classmethod
    def evaluate_asset_ml(cls, db: Session, asset_id: str, stage: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Executes the full 5-stage ML pipeline for a single asset and persists
        the resulting metrics into the database Asset record.
        """
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return None

        if not stage:
            demo_row = db.query(DemoScenarioState).filter(DemoScenarioState.id == 1).first()
            stage = demo_row.current_stage if demo_row else "critical"

        # Check latest sensor reading from DB
        latest_reading = (
            db.query(SensorReading)
            .filter(SensorReading.asset_id == asset_id)
            .order_by(SensorReading.timestamp.desc())
            .first()
        )

        # 1. Gather Telemetry (DB reading or Dataset CSV slice)
        if latest_reading:
            oti = latest_reading.temperature
            wti = oti + max(3.0, (latest_reading.load / 100.0) * 14.0)
            ati = latest_reading.ambient_temperature or 32.0
            oli = latest_reading.oil_quality
            vl1, vl2, vl3 = 240.0, 239.5, 240.2
            nominal_curr = max(15.0, (latest_reading.load / 100.0) * 85.0)
            il1, il2, il3 = nominal_curr, nominal_curr * 0.99, nominal_curr * 1.01
            inut = 1.2
            oti_a, oti_t = 0.0, 0.0
            partial_discharge = latest_reading.partial_discharge
            vibration = latest_reading.vibration
        else:
            if asset_id == "TR-104" and stage:
                slice_df = dataset_feed_service.get_stage_slice(stage)
            else:
                slice_df = dataset_feed_service.get_asset_slice(asset_id)

            if not slice_df.empty:
                row = slice_df.iloc[-1]
                oti = float(row.get("OTI", 70.0))
                wti = float(row.get("WTI", oti + 10.0))
                ati = float(row.get("ATI", 32.0))
                oli = float(row.get("OLI", 75.0))
                vl1, vl2, vl3 = float(row.get("VL1", 240.0)), float(row.get("VL2", 239.5)), float(row.get("VL3", 240.2))
                il1, il2, il3 = float(row.get("IL1", 75.0)), float(row.get("IL2", 74.0)), float(row.get("IL3", 76.0))
                inut = float(row.get("INUT", 1.5))
                oti_a = float(row.get("OTI_A", 0.0))
                oti_t = float(row.get("OTI_T", 0.0))
                partial_discharge = 15.0
                vibration = 2.0
            else:
                oti, wti, ati, oli = 70.0, 80.0, 32.0, 75.0
                vl1, vl2, vl3 = 240.0, 239.5, 240.2
                il1, il2, il3 = 75.0, 74.0, 76.0
                inut, oti_a, oti_t = 1.5, 0.0, 0.0
                partial_discharge = 15.0
                vibration = 2.0

        # 2. Stage 3: IEEE C57.91 Physics Health Score ML Model
        h_res = compute_health_score_single(
            oti=oti, wti=wti, ati=ati, oli=oli, oti_a=oti_a, oti_t=oti_t,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3, inut=inut
        )
        health = int(round(h_res["health_score"]))

        # Penalties for partial discharge & vibration
        pd_penalty = max(0.0, (partial_discharge - 25.0) * 1.5) if partial_discharge > 25.0 else 0.0
        vib_penalty = max(0.0, (vibration - 4.5) * 2.5) if vibration > 4.5 else 0.0
        effective_health = max(5.0, health - pd_penalty - vib_penalty)

        # 3. Stage 4: Condition-Aware Isolation Forest Anomaly Detection ML Model
        a_res = anomaly_detector.predict_anomaly_single(
            oti=oti, ati=ati, oli=oli,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3
        )

        # 4. Stage 2: XGBoost MOG Alarm Classifier ML Model
        m_res = mog_classifier.predict_mog_alarm(
            oti=oti, wti=wti, ati=ati, oli=oli, oti_a=oti_a, oti_t=oti_t,
            vl1=vl1, vl2=vl2, vl3=vl3, il1=il1, il2=il2, il3=il3, inut=inut
        )

        # 5. Stage 5: Non-Linear Equipment Risk Fusion ML Engine
        r_res = equipment_risk_engine.evaluate_risk(
            health_score=effective_health,
            normalized_anomaly_risk=a_res["normalized_anomaly_risk"],
            is_anomaly=a_res["is_anomaly"],
            mog_probability=m_res["mog_probability"]
        )
        eq_risk = int(round(r_res["equipment_risk_score"]))
        prob = round(float(r_res["failure_probability"]), 2)

        # 6. Stage 6: NASA POWER Sigmoidal Weather Risk Model
        w_res = weather_risk_engine.evaluate_weather_risk(
            temperature_c=ati,
            humidity_pct=85.0 if asset.grid_zone == "East Grid" else 55.0,
            wind_speed_ms=14.0 if asset.grid_zone == "East Grid" else 6.0,
            precipitation_mm=4.8 if asset.grid_zone == "East Grid" else 0.5,
            equipment_risk_score=r_res["equipment_risk_score"]
        )
        w_risk = w_res["weather_risk_level"]
        status = "CRITICAL" if eq_risk >= 75 else ("WARNING" if eq_risk >= 50 else "OPERATIONAL")

        # Composite risk calculation
        impact = risk_engine.calculate_impact_score(asset.customers_affected, asset.load_mw)
        crit = asset.criticality_score
        w_score = int(round(w_res["weather_risk_score"]))
        composite_risk, _, _, _ = risk_engine.compute_composite_risk(prob, w_score, impact, crit)

        # 7. Persist pre-computed ML predictions to Asset DB record
        asset.health_score = int(round(effective_health))
        asset.risk_score = composite_risk
        asset.failure_probability = prob
        asset.equipment_risk = eq_risk
        asset.weather_risk = w_risk
        asset.is_anomaly = bool(a_res["is_anomaly"])
        asset.status = status
        asset.last_ml_run_at = datetime.now(timezone.utc).isoformat()

        db.commit()
        db.refresh(asset)

        return {
            "asset_id": asset.id,
            "health_score": asset.health_score,
            "risk_score": asset.risk_score,
            "failure_probability": asset.failure_probability,
            "equipment_risk": asset.equipment_risk,
            "weather_risk": asset.weather_risk,
            "is_anomaly": asset.is_anomaly,
            "status": asset.status,
            "last_ml_run_at": asset.last_ml_run_at
        }

    @classmethod
    def evaluate_all_assets_ml(cls, db: Session, stage: Optional[str] = None) -> List[Dict[str, Any]]:
        """Executes ML pipeline re-evaluation across all assets in the database."""
        assets = db.query(Asset).filter(~Asset.id.like("TR-TEST-%")).all()
        if not assets:
            assets = db.query(Asset).all()

        results = []
        for a in assets:
            res = cls.evaluate_asset_ml(db, a.id, stage=stage)
            if res:
                results.append(res)
        
        logger.info(f"Background ML Worker: Re-evaluated {len(results)} assets successfully.")
        return results

    async def run_background_reevaluation(self, asset_id: Optional[str] = None, stage: Optional[str] = None):
        """Async worker task for background ML re-evaluation without blocking HTTP responses."""
        db = SessionLocal()
        try:
            loop = asyncio.get_event_loop()
            if asset_id:
                await loop.run_in_executor(None, self.evaluate_asset_ml, db, asset_id, stage)
            else:
                await loop.run_in_executor(None, self.evaluate_all_assets_ml, db, stage)
            
            # Notify connected live dashboard subscribers
            await self.notify_update(asset_id=asset_id)
        except Exception as e:
            logger.error(f"Error during background ML re-evaluation: {e}")
        finally:
            db.close()


ml_background_service = MLBackgroundService()
