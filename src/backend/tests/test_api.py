import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "gridguard-api"
    assert "version" in data

def test_dashboard_summary(client):
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_assets"] >= 20
    assert data["critical_assets"] >= 1
    assert data["customers_at_risk"] > 0
    assert data["grid_health_score"] > 0

def test_get_assets(client):
    response = client.get("/api/assets")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) >= 20
    assert data["total"] >= 20

def test_get_single_asset_tr104(client):
    response = client.get("/api/assets/TR-104")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "TR-104"
    assert "Naroda" in data["location"]
    assert "risk_score" in data
    assert "failure_probability" in data

def test_get_asset_sensors(client):
    response = client.get("/api/assets/TR-104/sensors")
    assert response.status_code == 200
    data = response.json()
    assert data["asset_id"] == "TR-104"
    assert len(data["temperature"]) > 0
    assert len(data["vibration"]) > 0
    assert len(data["partial_discharge"]) > 0
    assert len(data["oil_quality"]) > 0
    assert len(data["load"]) > 0

def test_get_asset_risk(client):
    response = client.get("/api/assets/TR-104/risk")
    assert response.status_code == 200
    data = response.json()
    assert data["asset_id"] == "TR-104"
    assert data["risk_score"] > 0
    assert len(data["contributing_factors"]) > 0
    assert "weather_stress_delta" in data

def test_maintenance_plan(client):
    # Ensure critical stage for priority 1
    client.post("/api/demo/set-stage", json={"stage": "critical"})
    response = client.get("/api/maintenance/plan")
    assert response.status_code == 200
    data = response.json()
    assert data["total_actions"] > 0
    assert len(data["actions"]) > 0
    assert data["actions"][0]["priority"] == 1

def test_crew_assignment(client):
    response = client.post("/api/maintenance/assign", json={
        "asset_id": "TR-104",
        "crew_id": "CREW-02"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["crew_id"] == "CREW-02"
    assert data["status"] == "ASSIGNED"

def test_ml_predict(client):
    payload = {
        "asset_id": "TR-104",
        "features": {
            "temperature": 91.2,
            "vibration": 7.8,
            "partial_discharge": 42.0,
            "oil_quality": 52.0,
            "load": 84.0,
            "ambient_temperature": 34.0
        }
    }
    response = client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["asset_id"] == "TR-104"
    assert data["failure_probability"] > 0.70
    assert data["prediction"] in ["HIGH_RISK", "CRITICAL_RISK"]
    assert "model_version" in data

def test_ai_advisor_query(client):
    response = client.post("/api/advisor/query", json={
        "question": "Which asset requires immediate attention?"
    })
    assert response.status_code == 200
    data = response.json()
    assert "TR-104" in data["answer"]
    assert data["priority"] == "CRITICAL"
    assert len(data["evidence"]) > 0
    assert len(data["recommended_actions"]) > 0

def test_demo_stage_transition(client):
    # Set to baseline
    res_base = client.post("/api/demo/set-stage", json={"stage": "baseline"})
    assert res_base.status_code == 200
    assert res_base.json()["current_stage"] == "baseline"
    assert res_base.json()["risk_score"] == 42

    # Verify TR-104 reflects baseline
    res_asset = client.get("/api/assets/TR-104")
    assert res_asset.json()["risk_score"] == 42
    assert res_asset.json()["status"] == "OPERATIONAL"

    # Set to critical
    res_crit = client.post("/api/demo/set-stage", json={"stage": "critical"})
    assert res_crit.status_code == 200
    assert res_crit.json()["current_stage"] == "critical"
    assert res_crit.json()["risk_score"] == 94

    # Verify TR-104 reflects critical
    res_asset_crit = client.get("/api/assets/TR-104")
    assert res_asset_crit.json()["risk_score"] == 94
    assert res_asset_crit.json()["status"] == "CRITICAL"

def test_create_and_track_new_transformer(client):
    import time
    test_id = f"TR-TEST-{int(time.time())}"
    payload = {
        "id": test_id,
        "name": "Maninagar East Step-Down Transformer",
        "type": "Power Transformer",
        "location": "Maninagar Substation",
        "grid_zone": "Central Grid",
        "capacity_mva": 60.0,
        "load_mw": 25.0,
        "criticality_score": 75,
        "customers_affected": 9500
    }
    response = client.post("/api/assets", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_id
    assert data["location"] == "Maninagar Substation"
    assert data["status"] == "OPERATIONAL"

    # Verify that sensors were automatically initialized
    sensors_res = client.get(f"/api/assets/{test_id}/sensors")
    assert sensors_res.status_code == 200
    assert len(sensors_res.json()["temperature"]) == 100

