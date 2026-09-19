"""
IoT Data Service.
Handles device registration, batch sensor data ingestion,
automatic ML prediction triggering, and asset health updates.
"""
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy.orm import Session

from app.models.models import IoTDevice, IoTDataLog, SensorReading, Asset
from app.schemas.schemas import (
    IoTSensorPayload, IoTBatchIngestResponse, IoTPredictionResult,
    IoTDeviceRegisterRequest, IoTDeviceRegisterResponse,
    IoTDeviceStatusResponse, IoTHeartbeatResponse,
    MLPredictFeatures
)
from app.services.ml_service import ml_service

logger = logging.getLogger(__name__)


class IoTService:
    """
    Service layer for IoT device management and live sensor data ingestion.
    Handles the full pipeline: receive → store → predict → update asset → respond.
    """

    @staticmethod
    def generate_api_key() -> str:
        """Generate a secure 48-character API key for IoT devices."""
        return f"gg_iot_{secrets.token_urlsafe(36)}"

    @staticmethod
    def generate_device_id(device_name: str) -> str:
        """Generate a unique device ID from the device name."""
        slug = device_name.strip().upper().replace(" ", "-")[:20]
        suffix = uuid.uuid4().hex[:6].upper()
        return f"IOT-{slug}-{suffix}"

    @classmethod
    def register_device(
        cls,
        req: IoTDeviceRegisterRequest,
        db: Session
    ) -> IoTDeviceRegisterResponse:
        """Register a new IoT device and generate its API key."""
        # Verify asset exists
        asset = db.query(Asset).filter(Asset.id == req.asset_id).first()
        if not asset:
            raise ValueError(f"Asset '{req.asset_id}' not found. Register the asset first.")

        device_id = cls.generate_device_id(req.device_name)
        api_key = cls.generate_api_key()

        device = IoTDevice(
            id=device_id,
            api_key=api_key,
            device_name=req.device_name.strip(),
            asset_id=req.asset_id,
            device_type=req.device_type or "sensor_gateway",
            firmware_version=req.firmware_version or "1.0.0",
            is_active=True,
            is_simulated=req.is_simulated if req.is_simulated is not None else False,
            created_at=datetime.now(timezone.utc).isoformat()
        )

        db.add(device)
        db.commit()
        db.refresh(device)

        logger.info(f"IoT device registered: {device_id} → asset {req.asset_id}")

        return IoTDeviceRegisterResponse(
            device_id=device_id,
            device_name=device.device_name,
            asset_id=device.asset_id,
            api_key=api_key,
            message=f"Device '{device.device_name}' registered successfully. Store your API key securely — it won't be shown again."
        )

    @classmethod
    async def ingest_batch(
        cls,
        device: IoTDevice,
        readings: List[IoTSensorPayload],
        db: Session
    ) -> IoTBatchIngestResponse:
        """
        Ingest a batch of sensor readings from an IoT device.
        For each reading:
          1. Store in sensor_readings table
          2. Run ML prediction (full 6-stage pipeline)
          3. Update asset health_score and status
          4. Log to iot_data_logs
        """
        asset_id = device.asset_id
        accepted = 0
        rejected = 0
        alerts: List[str] = []
        latest_prediction: Optional[IoTPredictionResult] = None

        for reading in readings:
            try:
                # 1. Generate timestamp if not provided
                ts = reading.timestamp or datetime.now(timezone.utc).isoformat()

                # 2. Store sensor reading in database
                sensor_record = SensorReading(
                    asset_id=asset_id,
                    timestamp=ts,
                    temperature=reading.temperature,
                    vibration=reading.vibration,
                    partial_discharge=reading.partial_discharge,
                    oil_quality=reading.oil_quality,
                    load=reading.load,
                    ambient_temperature=reading.ambient_temperature or 32.0
                )
                db.add(sensor_record)
                accepted += 1

            except Exception as e:
                logger.warning(f"Failed to store reading for {asset_id}: {e}")
                rejected += 1

        # Flush to persist sensor readings before prediction
        db.flush()

        # 3. Run ML prediction on the latest reading (most recent in batch)
        last_reading = readings[-1]
        try:
            features = MLPredictFeatures(
                temperature=last_reading.temperature,
                vibration=last_reading.vibration,
                partial_discharge=last_reading.partial_discharge,
                oil_quality=last_reading.oil_quality,
                load=last_reading.load,
                ambient_temperature=last_reading.ambient_temperature or 32.0,
                oti=last_reading.oti,
                wti=last_reading.wti,
                ati=last_reading.ati,
                oli=last_reading.oli,
                oti_a=last_reading.oti_a,
                oti_t=last_reading.oti_t,
                vl1=last_reading.vl1,
                vl2=last_reading.vl2,
                vl3=last_reading.vl3,
                il1=last_reading.il1,
                il2=last_reading.il2,
                il3=last_reading.il3,
                inut=last_reading.inut
            )

            prediction = await ml_service.predict_failure(asset_id, features)

            latest_prediction = IoTPredictionResult(
                prediction=prediction.prediction,
                failure_probability=prediction.failure_probability,
                health_score=prediction.health_score,
                is_anomaly=prediction.is_anomaly,
                risk_level=prediction.prediction.replace("_RISK", "").replace("_", " ").title(),
                dominant_risk_factor=prediction.dominant_risk_factor,
                recommended_action=prediction.recommended_action
            )

            # 4. Update asset health_score and status based on prediction
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset and prediction.health_score is not None:
                asset.health_score = int(round(prediction.health_score))
                if prediction.prediction == "CRITICAL_RISK":
                    asset.status = "CRITICAL"
                elif prediction.prediction == "HIGH_RISK":
                    asset.status = "WARNING"
                elif prediction.prediction == "MODERATE_RISK":
                    asset.status = "WARNING"
                else:
                    asset.status = "OPERATIONAL"

            # Generate alerts for high-risk predictions
            if prediction.prediction in ("CRITICAL_RISK", "HIGH_RISK"):
                alerts.append(
                    f"⚠️ {prediction.prediction}: {asset_id} failure probability "
                    f"{prediction.failure_probability:.0%}. {prediction.recommended_action}"
                )

            prediction_triggered = True

        except Exception as e:
            logger.error(f"ML prediction failed for {asset_id}: {e}")
            prediction_triggered = False
            latest_prediction = None

        # 5. Log ingestion event
        log_entry = IoTDataLog(
            device_id=device.id,
            asset_id=asset_id,
            readings_count=accepted,
            timestamp=datetime.now(timezone.utc).isoformat(),
            prediction_triggered=prediction_triggered,
            prediction_result=latest_prediction.prediction if latest_prediction else None,
            failure_probability=latest_prediction.failure_probability if latest_prediction else None,
            health_score=latest_prediction.health_score if latest_prediction else None,
            is_anomaly=latest_prediction.is_anomaly if latest_prediction else None,
            is_simulated=device.is_simulated or False
        )
        db.add(log_entry)


        # 6. Update device stats
        device.total_readings_sent = (device.total_readings_sent or 0) + accepted
        device.last_heartbeat = datetime.now(timezone.utc).isoformat()

        db.commit()

        # Trigger background ML re-evaluation & live dashboard push update
        try:
            from app.services.ml_background_service import ml_background_service
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(ml_background_service.run_background_reevaluation(asset_id=asset_id))
            except RuntimeError:
                pass
        except Exception as e:
            logger.warning(f"IoT ingest background ML trigger warning: {e}")

        return IoTBatchIngestResponse(
            success=True,
            device_id=device.id,
            asset_id=asset_id,
            readings_accepted=accepted,
            readings_rejected=rejected,
            latest_prediction=latest_prediction,
            alerts=alerts,
            message=f"Ingested {accepted} readings. ML prediction: {latest_prediction.prediction if latest_prediction else 'skipped'}."
        )

    @staticmethod
    def process_heartbeat(device: IoTDevice, db: Session) -> IoTHeartbeatResponse:
        """Update device heartbeat timestamp."""
        now = datetime.now(timezone.utc).isoformat()
        device.last_heartbeat = now
        db.commit()

        return IoTHeartbeatResponse(
            device_id=device.id,
            status="ALIVE",
            server_time=now,
            message=f"Heartbeat acknowledged for device '{device.device_name}'."
        )

    @staticmethod
    def list_devices(db: Session, real_only: bool = False) -> List[IoTDeviceStatusResponse]:
        """List all registered IoT devices."""
        query = db.query(IoTDevice)
        if real_only:
            query = query.filter(IoTDevice.is_simulated == False)
        devices = query.order_by(IoTDevice.created_at.desc()).all()
        return [
            IoTDeviceStatusResponse(
                device_id=d.id,
                device_name=d.device_name,
                asset_id=d.asset_id,
                device_type=d.device_type,
                firmware_version=d.firmware_version,
                is_active=d.is_active,
                is_simulated=d.is_simulated or False,
                last_heartbeat=d.last_heartbeat,
                total_readings_sent=d.total_readings_sent or 0,
                created_at=d.created_at
            )
            for d in devices
        ]

    @staticmethod
    def get_device(device_id: str, db: Session) -> Optional[IoTDeviceStatusResponse]:
        """Get a specific device's status."""
        d = db.query(IoTDevice).filter(IoTDevice.id == device_id).first()
        if not d:
            return None
        return IoTDeviceStatusResponse(
            device_id=d.id,
            device_name=d.device_name,
            asset_id=d.asset_id,
            device_type=d.device_type,
            firmware_version=d.firmware_version,
            is_active=d.is_active,
            is_simulated=d.is_simulated or False,
            last_heartbeat=d.last_heartbeat,
            total_readings_sent=d.total_readings_sent or 0,
            created_at=d.created_at
        )

    @staticmethod
    def deactivate_device(device_id: str, db: Session) -> bool:
        """Deactivate (soft-delete) an IoT device."""
        device = db.query(IoTDevice).filter(IoTDevice.id == device_id).first()
        if not device:
            return False
        device.is_active = False
        db.commit()
        logger.info(f"IoT device deactivated: {device_id}")
        return True

    @staticmethod
    def get_logs(db: Session, asset_id: Optional[str] = None, real_only: bool = False, limit: int = 50) -> List[IoTDataLog]:
        """Fetch recent IoT telemetry logs with ML prediction results."""
        query = db.query(IoTDataLog)
        if asset_id:
            query = query.filter(IoTDataLog.asset_id == asset_id)
        if real_only:
            query = query.filter(IoTDataLog.is_simulated == False)
        return query.order_by(IoTDataLog.id.desc()).limit(limit).all()

    @staticmethod
    def purge_logs(db: Session, simulated_only: bool = True) -> int:
        """Purge IoT telemetry logs (simulated only or all)."""
        query = db.query(IoTDataLog)
        if simulated_only:
            query = query.filter(IoTDataLog.is_simulated == True)
        count = query.delete(synchronize_session=False)
        db.commit()
        logger.info(f"Purged {count} IoT logs (simulated_only={simulated_only})")
        return count

    @staticmethod
    def reset_all_iot_data(db: Session) -> Tuple[int, int]:
        """Completely reset all IoT devices and data logs to an empty state."""
        log_cnt = db.query(IoTDataLog).delete(synchronize_session=False)
        dev_cnt = db.query(IoTDevice).delete(synchronize_session=False)
        db.commit()
        logger.info(f"Reset all IoT data: deleted {dev_cnt} devices and {log_cnt} logs.")
        return dev_cnt, log_cnt


iot_service = IoTService()



