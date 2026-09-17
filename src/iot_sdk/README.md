# GridGuard IoT SDK

Python client library for connecting IoT sensor devices to the **GridGuard AI** transformer monitoring platform.

## Features

- 📡 **Single & batch sensor data ingestion** with automatic ML prediction
- 🔄 **Auto-collector** — background thread reads sensors at configurable intervals
- 💾 **Offline buffering** — stores data locally when server is unreachable, auto-syncs when back online
- 🔁 **Retry with exponential backoff** — handles network flakiness gracefully
- 🔑 **API key authentication** — lightweight auth for constrained IoT devices
- 📦 **Zero external dependencies** — uses Python stdlib only (works on Raspberry Pi, MicroPython, etc.)

## Installation

```bash
# From the project root
cd src/iot_sdk
pip install -e .
```

## Quick Start

### 1. Register your IoT device (via dashboard or API)

```bash
# Using the GridGuard API (requires admin JWT token)
curl -X POST http://localhost:8000/api/iot/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_name": "Naroda Sensor Gateway",
    "asset_id": "TR-104",
    "device_type": "raspberry_pi"
  }'
```

Save the `api_key` from the response — it's shown only once!

### 2. Send sensor data

```python
from gridguard_iot import GridGuardIoTClient, SensorReading

# Initialize client
client = GridGuardIoTClient(
    server_url="http://localhost:8000",
    api_key="gg_iot_your_api_key_here"
)

# Send a single reading
result = client.send_reading(
    temperature=72.5,
    vibration=3.2,
    partial_discharge=18.0,
    oil_quality=82.0,
    load=45.0
)

print(f"Prediction: {result['latest_prediction']['prediction']}")
print(f"Failure probability: {result['latest_prediction']['failure_probability']:.0%}")
```

### 3. Auto-collect from sensors

```python
import random
from gridguard_iot import GridGuardIoTClient, SensorReading

client = GridGuardIoTClient(
    server_url="http://localhost:8000",
    api_key="gg_iot_your_api_key_here"
)

# Define your sensor reading function
def read_sensors():
    return SensorReading(
        temperature=65.0 + random.gauss(0, 3),
        vibration=2.5 + random.gauss(0, 0.5),
        partial_discharge=15.0 + random.gauss(0, 2),
        oil_quality=85.0 + random.gauss(0, 2),
        load=40.0 + random.gauss(0, 5)
    )

# Start auto-collection: reads every 30s, sends batch every 10 readings
client.start_auto_collector(
    sensor_fn=read_sensors,
    interval=30,     # Read every 30 seconds
    batch_size=10    # Send batch every 10 readings (= every 5 minutes)
)

# Keep running (Ctrl+C to stop)
try:
    import time
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    client.stop_auto_collector()
    print("Stopped.")
```

## API Reference

### `GridGuardIoTClient(server_url, api_key, timeout=10, max_retries=3)`

| Method | Description |
|--------|-------------|
| `send_reading(temperature, vibration, ...)` | Send a single sensor reading |
| `send_batch(readings)` | Send a list of `SensorReading` objects (max 500) |
| `heartbeat()` | Send a keep-alive signal |
| `start_auto_collector(sensor_fn, interval, batch_size)` | Start background auto-collection |
| `stop_auto_collector()` | Stop auto-collection gracefully |

### `SensorReading(temperature, vibration, partial_discharge, oil_quality, load, ...)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `temperature` | float | ✅ | Top oil temperature (°C) |
| `vibration` | float | ✅ | Acoustic vibration (mm/s) |
| `partial_discharge` | float | ✅ | Partial discharge (pC) |
| `oil_quality` | float | ✅ | Oil quality index (0-100) |
| `load` | float | ✅ | Active load (MW) |
| `ambient_temperature` | float | ❌ | Ambient temp (°C), default 32 |
| `oti`, `wti`, `ati`, `oli` | float | ❌ | IEEE C57.91 detailed telemetry |
| `vl1`, `vl2`, `vl3` | float | ❌ | Phase voltages (V) |
| `il1`, `il2`, `il3` | float | ❌ | Phase currents (A) |

## Response Format

```json
{
  "success": true,
  "device_id": "IOT-NARODA-ABC123",
  "asset_id": "TR-104",
  "readings_accepted": 10,
  "latest_prediction": {
    "prediction": "MODERATE_RISK",
    "failure_probability": 0.35,
    "health_score": 72.0,
    "is_anomaly": false,
    "risk_level": "Moderate",
    "recommended_action": "Increase monitoring frequency."
  },
  "alerts": []
}
```
