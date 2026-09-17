"""
IoT Device Management & Live Sensor Data Ingestion API.
Endpoints for registering IoT devices, ingesting real-time sensor data,
triggering automatic ML predictions, and managing device lifecycle.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.session import get_db
from app.models.models import IoTDevice
from app.api.iot_auth import get_iot_device
from app.schemas.schemas import (
    IoTBatchIngestRequest, IoTBatchIngestResponse,
    IoTDeviceRegisterRequest, IoTDeviceRegisterResponse,
    IoTDeviceStatusResponse, IoTHeartbeatResponse,
    IoTLogResponse
)
from app.services.iot_service import iot_service

router = APIRouter(prefix="/iot", tags=["IoT Devices"])



# ── IoT Device-Authenticated Endpoints (API Key) ──────────────────────────

@router.post("/ingest", response_model=IoTBatchIngestResponse)
async def ingest_sensor_data(
    req: IoTBatchIngestRequest,
    device: IoTDevice = Depends(get_iot_device),
    db: Session = Depends(get_db)
):
    """
    Ingest a batch of sensor readings from an IoT device.

    Authentication: X-API-Key header (IoT device API key).

    For each reading:
    1. Stores sensor data in the database
    2. Automatically runs the full 6-stage ML prediction pipeline
    3. Updates asset health_score and status based on prediction
    4. Returns prediction results and any alerts triggered

    Max 500 readings per batch.
    """
    return await iot_service.ingest_batch(device, req.readings, db)


@router.post("/heartbeat", response_model=IoTHeartbeatResponse)
def device_heartbeat(
    device: IoTDevice = Depends(get_iot_device),
    db: Session = Depends(get_db)
):
    """
    IoT device heartbeat / keep-alive.

    Authentication: X-API-Key header.
    Updates the device's last_heartbeat timestamp.
    """
    return iot_service.process_heartbeat(device, db)


# ── Admin-Authenticated Endpoints (JWT — added via main.py dependencies) ──

@router.post("/devices", response_model=IoTDeviceRegisterResponse)
def register_device(
    req: IoTDeviceRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new IoT device for a specific transformer asset.

    Authentication: JWT Bearer token (admin only).

    Returns the generated API key — store it securely, it's shown only once.
    """
    try:
        return iot_service.register_device(req, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/devices", response_model=List[IoTDeviceStatusResponse])
def list_devices(
    real_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    List registered IoT devices.
    If real_only=True, excludes simulated/test devices.
    """
    return iot_service.list_devices(db, real_only=real_only)


@router.get("/devices/{device_id}", response_model=IoTDeviceStatusResponse)
def get_device(device_id: str, db: Session = Depends(get_db)):
    """
    Get detailed status of a specific IoT device.

    Authentication: JWT Bearer token (admin only).
    """
    device = iot_service.get_device(device_id, db)
    if not device:
        raise HTTPException(status_code=404, detail=f"IoT device '{device_id}' not found.")
    return device


@router.delete("/devices/{device_id}")
def deactivate_device(device_id: str, db: Session = Depends(get_db)):
    """
    Deactivate (soft-delete) an IoT device.

    Authentication: JWT Bearer token (admin only).
    """
    success = iot_service.deactivate_device(device_id, db)
    if not success:
        raise HTTPException(status_code=404, detail=f"IoT device '{device_id}' not found.")
    return {"success": True, "device_id": device_id, "message": "Device deactivated."}


@router.get("/logs", response_model=List[IoTLogResponse])
def get_iot_logs(
    asset_id: Optional[str] = None,
    real_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Fetch recent IoT telemetry logs and their ML prediction results.

    Authentication: JWT Bearer token.
    Filterable by asset_id and real_only.
    """
    return iot_service.get_logs(db, asset_id=asset_id, real_only=real_only, limit=limit)


@router.delete("/logs")
def purge_iot_logs(
    simulated_only: bool = True,
    db: Session = Depends(get_db)
):
    """
    Purge IoT telemetry logs.
    By default purges simulated_only=True logs.
    """
    count = iot_service.purge_logs(db, simulated_only=simulated_only)
    return {"success": True, "purged_count": count, "simulated_only": simulated_only}


@router.post("/reset")
def reset_iot_system(db: Session = Depends(get_db)):
    """
    Completely reset IoT system to empty state (0 devices, 0 logs).
    Use when starting a fresh live stream demonstration.
    """
    dev_cnt, log_cnt = iot_service.reset_all_iot_data(db)
    return {
        "success": True,
        "deleted_devices": dev_cnt,
        "deleted_logs": log_cnt,
        "message": "IoT system reset to empty state. Ready for live hardware connection."
    }



