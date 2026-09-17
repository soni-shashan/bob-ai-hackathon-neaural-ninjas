"""
IoT Device Authentication Dependency.
Validates API keys from the X-API-Key header for IoT device endpoints.
Lightweight alternative to JWT for constrained IoT devices.
"""
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.models import IoTDevice


def get_iot_device(
    x_api_key: str = Header(..., description="IoT device API key"),
    db: Session = Depends(get_db)
) -> IoTDevice:
    """
    Validates the X-API-Key header against registered IoT devices.
    Returns the authenticated IoTDevice or raises 401.
    """
    if not x_api_key or len(x_api_key) < 16:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key. Provide X-API-Key header."
        )

    device = db.query(IoTDevice).filter(
        IoTDevice.api_key == x_api_key,
        IoTDevice.is_active == True
    ).first()

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key or device deactivated."
        )

    return device
