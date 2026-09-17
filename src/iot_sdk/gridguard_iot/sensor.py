"""
GridGuard IoT SDK — Sensor Reading Data Model.
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional


@dataclass
class SensorReading:
    """
    Represents a single transformer sensor reading.

    Required fields:
        temperature: Top oil temperature (°C)
        vibration: Acoustic vibration (mm/s)
        partial_discharge: Partial discharge activity (pC)
        oil_quality: Dielectric oil quality index (0-100)
        load: Active load (MW)

    Optional fields:
        ambient_temperature: Ambient temperature (°C), default 32.0
        timestamp: ISO 8601 timestamp. Auto-generated if omitted.
        oti, wti, ati, oli: IEEE C57.91 detailed telemetry
        vl1, vl2, vl3, il1, il2, il3, inut: Electrical measurements
    """
    temperature: float
    vibration: float
    partial_discharge: float
    oil_quality: float
    load: float
    ambient_temperature: float = 32.0
    timestamp: Optional[str] = None

    # IEEE C57.91 extended telemetry (optional)
    oti: Optional[float] = None
    wti: Optional[float] = None
    ati: Optional[float] = None
    oli: Optional[float] = None
    oti_a: Optional[float] = 0.0
    oti_t: Optional[float] = 0.0
    vl1: Optional[float] = 240.0
    vl2: Optional[float] = 240.0
    vl3: Optional[float] = 240.0
    il1: Optional[float] = None
    il2: Optional[float] = None
    il3: Optional[float] = None
    inut: Optional[float] = 0.0

    def to_dict(self) -> dict:
        """Convert to dictionary for API payload, auto-generating timestamp if missing."""
        d = asdict(self)
        if d["timestamp"] is None:
            d["timestamp"] = datetime.now(timezone.utc).isoformat()
        # Remove None values to keep payload compact
        return {k: v for k, v in d.items() if v is not None}

    def validate(self) -> bool:
        """Basic validation of sensor readings."""
        if not (-50.0 <= self.temperature <= 200.0):
            raise ValueError(f"Temperature {self.temperature}°C out of range [-50, 200]")
        if not (0.0 <= self.vibration <= 50.0):
            raise ValueError(f"Vibration {self.vibration} mm/s out of range [0, 50]")
        if not (0.0 <= self.partial_discharge <= 200.0):
            raise ValueError(f"Partial discharge {self.partial_discharge} pC out of range [0, 200]")
        if not (0.0 <= self.oil_quality <= 100.0):
            raise ValueError(f"Oil quality {self.oil_quality} out of range [0, 100]")
        if not (0.0 <= self.load <= 500.0):
            raise ValueError(f"Load {self.load} MW out of range [0, 500]")
        return True
