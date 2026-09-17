"""
GridGuard IoT SDK
=================
Python client library for connecting IoT sensor devices to the GridGuard AI platform.

Features:
- Single reading & batch data ingestion
- Automatic ML prediction on every ingest
- Auto-collector with configurable interval
- Offline buffering with auto-sync
- Retry with exponential backoff
- Zero external dependencies (uses stdlib urllib)

Quick Start:
    from gridguard_iot import GridGuardIoTClient, SensorReading

    client = GridGuardIoTClient(
        server_url="http://localhost:8000",
        api_key="gg_iot_your_api_key_here"
    )

    result = client.send_reading(
        temperature=72.5,
        vibration=3.2,
        partial_discharge=18.0,
        oil_quality=82.0,
        load=45.0
    )
    print(result)
"""

from gridguard_iot.client import GridGuardIoTClient
from gridguard_iot.sensor import SensorReading
from gridguard_iot.collector import AutoCollector
from gridguard_iot.exceptions import (
    GridGuardIoTError,
    AuthenticationError,
    ConnectionError,
    IngestError,
    ValidationError
)

__version__ = "1.0.0"
__all__ = [
    "GridGuardIoTClient",
    "SensorReading",
    "AutoCollector",
    "GridGuardIoTError",
    "AuthenticationError",
    "ConnectionError",
    "IngestError",
    "ValidationError",
]
