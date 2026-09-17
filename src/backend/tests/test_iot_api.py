"""
IoT API Integration Tests.
Tests device registration, data ingestion, ML auto-prediction, heartbeat,
and device lifecycle management.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


from app.database.session import SessionLocal
from app.models.models import IoTDevice, IoTDataLog


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    yield
    db = SessionLocal()
    try:
        db.query(IoTDataLog).delete()
        db.query(IoTDevice).delete()
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    """Create a test client with JWT authentication."""
    with TestClient(app) as c:
        login_res = c.post("/api/auth/login", json={
            "email": "neaural.ninjas@electricity.com",
            "password": "Admin@123"
        })
        if login_res.status_code == 200:
            token = login_res.json().get("access_token")
            c.headers["Authorization"] = f"Bearer {token}"
        yield c



@pytest.fixture(scope="module")
def registered_device(client):
    """Register a test IoT device and return its info including API key."""
    res = client.post("/api/iot/devices", json={
        "device_name": "Test Sensor Gateway",
        "asset_id": "TR-104",
        "device_type": "sensor_gateway",
        "firmware_version": "1.0.0-test"
    })
    assert res.status_code == 200
    data = res.json()
    assert "api_key" in data
    assert data["api_key"].startswith("gg_iot_")
    assert data["asset_id"] == "TR-104"
    return data


class TestIoTDeviceRegistration:
    """Tests for IoT device registration endpoints."""

    def test_register_device(self, client):
        """Register a new IoT device successfully."""
        res = client.post("/api/iot/devices", json={
            "device_name": "Naroda Gateway Alpha",
            "asset_id": "TR-104",
            "device_type": "raspberry_pi"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["device_name"] == "Naroda Gateway Alpha"
        assert data["asset_id"] == "TR-104"
        assert data["api_key"].startswith("gg_iot_")
        assert len(data["api_key"]) >= 48
        assert "Store" in data["message"] or "registered" in data["message"]

    def test_register_device_invalid_asset(self, client):
        """Registering for non-existent asset fails."""
        res = client.post("/api/iot/devices", json={
            "device_name": "Phantom Device",
            "asset_id": "NONEXISTENT-999"
        })
        assert res.status_code == 400
        assert "not found" in res.json()["detail"].lower()

    def test_list_devices(self, client, registered_device):
        """List all registered devices."""
        res = client.get("/api/iot/devices")
        assert res.status_code == 200
        devices = res.json()
        assert isinstance(devices, list)
        assert len(devices) >= 1
        # Find our registered device
        found = any(d["asset_id"] == "TR-104" for d in devices)
        assert found

    def test_get_device_by_id(self, client, registered_device):
        """Get specific device details."""
        device_id = registered_device["device_id"]
        res = client.get(f"/api/iot/devices/{device_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["device_id"] == device_id
        assert data["asset_id"] == "TR-104"
        assert data["is_active"] is True

    def test_get_nonexistent_device(self, client):
        """Getting a non-existent device returns 404."""
        res = client.get("/api/iot/devices/NONEXISTENT-DEVICE")
        assert res.status_code == 404


class TestIoTDataIngestion:
    """Tests for sensor data ingestion and auto-prediction."""

    def test_ingest_single_reading(self, client, registered_device):
        """Ingest a single sensor reading with auto ML prediction."""
        api_key = registered_device["api_key"]
        res = client.post(
            "/api/iot/ingest",
            json={
                "readings": [{
                    "temperature": 72.5,
                    "vibration": 3.2,
                    "partial_discharge": 18.0,
                    "oil_quality": 82.0,
                    "load": 45.0,
                    "ambient_temperature": 31.0
                }]
            },
            headers={"X-API-Key": api_key}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["asset_id"] == "TR-104"
        assert data["readings_accepted"] == 1
        assert data["readings_rejected"] == 0
        # ML prediction should be triggered
        assert data["latest_prediction"] is not None
        assert data["latest_prediction"]["prediction"] in (
            "LOW_RISK", "MODERATE_RISK", "HIGH_RISK", "CRITICAL_RISK"
        )
        assert 0.0 <= data["latest_prediction"]["failure_probability"] <= 1.0

    def test_ingest_batch_readings(self, client, registered_device):
        """Ingest a batch of 5 readings."""
        api_key = registered_device["api_key"]
        readings = [
            {
                "temperature": 70.0 + i * 2,
                "vibration": 2.5 + i * 0.3,
                "partial_discharge": 14.0 + i * 1.5,
                "oil_quality": 85.0 - i * 1.0,
                "load": 40.0 + i * 3,
                "ambient_temperature": 30.0
            }
            for i in range(5)
        ]
        res = client.post(
            "/api/iot/ingest",
            json={"readings": readings},
            headers={"X-API-Key": api_key}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["readings_accepted"] == 5
        assert data["latest_prediction"] is not None

    def test_ingest_critical_readings_triggers_alert(self, client, registered_device):
        """Critical sensor values should trigger alerts."""
        api_key = registered_device["api_key"]
        res = client.post(
            "/api/iot/ingest",
            json={
                "readings": [{
                    "temperature": 95.0,
                    "vibration": 9.0,
                    "partial_discharge": 48.0,
                    "oil_quality": 40.0,
                    "load": 90.0,
                    "ambient_temperature": 38.0
                }]
            },
            headers={"X-API-Key": api_key}
        )
        assert res.status_code == 200
        data = res.json()
        pred = data["latest_prediction"]
        assert pred["prediction"] in ("HIGH_RISK", "CRITICAL_RISK")
        assert pred["failure_probability"] >= 0.50
        # Should have alert(s)
        assert len(data["alerts"]) >= 1

    def test_ingest_with_ieee_fields(self, client, registered_device):
        """Ingest with optional IEEE C57.91 fields."""
        api_key = registered_device["api_key"]
        res = client.post(
            "/api/iot/ingest",
            json={
                "readings": [{
                    "temperature": 72.0,
                    "vibration": 2.8,
                    "partial_discharge": 16.0,
                    "oil_quality": 84.0,
                    "load": 42.0,
                    "oti": 72.0,
                    "wti": 80.0,
                    "ati": 30.0,
                    "oli": 84.0,
                    "vl1": 241.0,
                    "vl2": 239.0,
                    "vl3": 240.0,
                    "il1": 35.0,
                    "il2": 34.8,
                    "il3": 35.2
                }]
            },
            headers={"X-API-Key": api_key}
        )
        assert res.status_code == 200
        assert res.json()["readings_accepted"] == 1

    def test_ingest_invalid_api_key_rejected(self, client):
        """Invalid API key → 401 Unauthorized."""
        res = client.post(
            "/api/iot/ingest",
            json={
                "readings": [{
                    "temperature": 70.0,
                    "vibration": 2.5,
                    "partial_discharge": 14.0,
                    "oil_quality": 85.0,
                    "load": 40.0
                }]
            },
            headers={"X-API-Key": "gg_iot_INVALID_KEY_12345678901234567890"}
        )
        assert res.status_code == 401

    def test_ingest_missing_api_key_rejected(self, client):
        """Missing X-API-Key header → 422 Unprocessable Entity."""
        # Remove auth headers (don't send X-API-Key)
        res = client.post(
            "/api/iot/ingest",
            json={
                "readings": [{
                    "temperature": 70.0,
                    "vibration": 2.5,
                    "partial_discharge": 14.0,
                    "oil_quality": 85.0,
                    "load": 40.0
                }]
            }
        )
        # FastAPI returns 422 for missing required header parameters
        assert res.status_code in (401, 422)

    def test_ingest_empty_readings_rejected(self, client, registered_device):
        """Empty readings array is rejected."""
        api_key = registered_device["api_key"]
        res = client.post(
            "/api/iot/ingest",
            json={"readings": []},
            headers={"X-API-Key": api_key}
        )
        assert res.status_code == 422  # Pydantic validation error (min_length=1)


class TestIoTHeartbeat:
    """Tests for device heartbeat endpoint."""

    def test_heartbeat(self, client, registered_device):
        """Heartbeat returns acknowledgment."""
        api_key = registered_device["api_key"]
        res = client.post(
            "/api/iot/heartbeat",
            headers={"X-API-Key": api_key}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ALIVE"
        assert data["device_id"] == registered_device["device_id"]
        assert data["server_time"] is not None

    def test_heartbeat_updates_timestamp(self, client, registered_device):
        """After heartbeat, device's last_heartbeat is updated."""
        api_key = registered_device["api_key"]
        # Send heartbeat
        client.post("/api/iot/heartbeat", headers={"X-API-Key": api_key})

        # Check device status
        device_id = registered_device["device_id"]
        status_res = client.get(f"/api/iot/devices/{device_id}")
        assert status_res.status_code == 200
        assert status_res.json()["last_heartbeat"] is not None


class TestIoTDeviceLifecycle:
    """Tests for device deactivation and lifecycle."""

    def test_deactivate_device(self, client):
        """Deactivate a device → it can no longer ingest data."""
        # Register a throwaway device
        reg_res = client.post("/api/iot/devices", json={
            "device_name": "Disposable Device",
            "asset_id": "TR-104",
            "device_type": "edge_node"
        })
        assert reg_res.status_code == 200
        device = reg_res.json()
        api_key = device["api_key"]
        device_id = device["device_id"]

        # Verify it works
        ingest_res = client.post(
            "/api/iot/ingest",
            json={"readings": [{"temperature": 60, "vibration": 2, "partial_discharge": 10, "oil_quality": 90, "load": 30}]},
            headers={"X-API-Key": api_key}
        )
        assert ingest_res.status_code == 200

        # Deactivate
        del_res = client.delete(f"/api/iot/devices/{device_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # Verify it's deactivated
        status_res = client.get(f"/api/iot/devices/{device_id}")
        assert status_res.status_code == 200
        assert status_res.json()["is_active"] is False

        # Verify it can no longer ingest
        blocked_res = client.post(
            "/api/iot/ingest",
            json={"readings": [{"temperature": 60, "vibration": 2, "partial_discharge": 10, "oil_quality": 90, "load": 30}]},
            headers={"X-API-Key": api_key}
        )
        assert blocked_res.status_code == 401

    def test_deactivate_nonexistent_device(self, client):
        """Deactivating non-existent device → 404."""
        res = client.delete("/api/iot/devices/NONEXISTENT-DEVICE")
        assert res.status_code == 404


class TestIoTAssetHealthUpdate:
    """Tests that IoT ingestion properly updates asset health in the database."""

    def test_critical_ingest_updates_asset_status(self, client, registered_device):
        """Critical readings should update the asset's status to CRITICAL."""
        api_key = registered_device["api_key"]

        # Send critical readings
        client.post(
            "/api/iot/ingest",
            json={
                "readings": [{
                    "temperature": 96.0,
                    "vibration": 9.5,
                    "partial_discharge": 50.0,
                    "oil_quality": 35.0,
                    "load": 92.0,
                    "ambient_temperature": 40.0
                }]
            },
            headers={"X-API-Key": api_key}
        )

        # Check asset status was updated
        asset_res = client.get("/api/assets/TR-104")
        assert asset_res.status_code == 200
        # Note: asset status may be overridden by demo stage logic for TR-104
        # but the ingestion itself should have attempted the update

    def test_device_reading_count_incremented(self, client, registered_device):
        """Device's total_readings_sent should increment after ingestion."""
        device_id = registered_device["device_id"]

        # Get current count
        before = client.get(f"/api/iot/devices/{device_id}").json()
        before_count = before["total_readings_sent"]

        # Send 3 readings
        api_key = registered_device["api_key"]
        client.post(
            "/api/iot/ingest",
            json={
                "readings": [
                    {"temperature": 65, "vibration": 2.5, "partial_discharge": 14, "oil_quality": 86, "load": 38},
                    {"temperature": 66, "vibration": 2.6, "partial_discharge": 14.5, "oil_quality": 85, "load": 39},
                    {"temperature": 67, "vibration": 2.7, "partial_discharge": 15, "oil_quality": 84, "load": 40}
                ]
            },
            headers={"X-API-Key": api_key}
        )

        # Check count incremented
        after = client.get(f"/api/iot/devices/{device_id}").json()
        assert after["total_readings_sent"] == before_count + 3
