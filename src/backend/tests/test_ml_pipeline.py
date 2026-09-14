import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ml.health_score import compute_health_score_single
from app.ml.anomaly_detector import anomaly_detector
from app.ml.mog_classifier import mog_classifier
from app.ml.equipment_risk import equipment_risk_engine
from app.ml.weather_engine import weather_risk_engine

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        login_res = c.post("/api/auth/login", json={
            "email": "neaural.ninjas@electricity.com",
            "password": "Admin@123"
        })
        if login_res.status_code == 200:
            token = login_res.json().get("access_token")
            c.headers["Authorization"] = f"Bearer {token}"
        yield c

def test_ml_info_endpoint(client):
    res = client.get("/api/ml/info")
    assert res.status_code == 200
    data = res.json()
    assert "GridGuard" in data["model_name"]
    assert "IsolationForest" in data["version"]
    assert len(data["features"]) >= 5
    assert data["weights"]["health_risk"] == 0.55
    assert data["status"].startswith("ONLINE")

def test_ml_predict_critical_scenario(client):
    payload = {
        "asset_id": "TR-104",
        "features": {
            "temperature": 92.5,
            "vibration": 8.4,
            "partial_discharge": 44.0,
            "oil_quality": 50.0,
            "load": 88.0,
            "ambient_temperature": 35.0
        }
    }
    res = client.post("/api/ml/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["asset_id"] == "TR-104"
    assert data["failure_probability"] >= 0.70
    assert data["prediction"] == "CRITICAL_RISK"
    assert data["is_anomaly"] is True
    assert data["health_score"] < 40.0
    assert data["dominant_risk_factor"] is not None
    assert "Immediate" in data["recommended_action"] or "prioritize" in data["recommended_action"]

def test_ml_predict_nominal_scenario(client):
    payload = {
        "asset_id": "TR-001",
        "features": {
            "temperature": 32.0,
            "vibration": 1.5,
            "partial_discharge": 12.0,
            "oil_quality": 85.0,
            "load": 40.0,
            "ambient_temperature": 28.0
        }
    }
    res = client.post("/api/ml/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["asset_id"] == "TR-001"
    assert data["health_score"] >= 80.0
    assert data["health_category"] == "Healthy"
    assert data["failure_probability"] <= 0.40

def test_physics_health_score_ieee_principles():
    # Healthy nominal
    h_nom = compute_health_score_single(oti=50.0, wti=60.0, ati=28.0, oli=65.0)
    assert h_nom["health_score"] == 100.0
    assert h_nom["health_category"] == "Healthy"

    # Extreme thermal breakdown with trip alarm
    h_crit = compute_health_score_single(oti=95.0, wti=115.0, ati=30.0, oli=25.0, oti_t=1.0)
    assert h_crit["health_score"] < 40.0
    assert h_crit["thermal_penalty"] == 35.0
    assert h_crit["health_category"] == "Critical"

def test_condition_aware_anomaly_detector():
    assert anomaly_detector.is_loaded is True
    # Severe thermal runaway should flag anomaly
    anom = anomaly_detector.predict_anomaly_single(oti=95.0, ati=30.0, oli=50.0)
    assert anom["is_anomaly"] is True
    assert anom["decision_score"] < 0.0

def test_mog_classifier():
    assert mog_classifier.is_loaded is True
    # Critical low oil
    pred_low = mog_classifier.predict_mog_alarm(oli=20.0)
    assert pred_low["mog_predicted"] == 1
    assert pred_low["mog_probability"] > 0.60

def test_weather_engine_bounded_interaction():
    w = weather_risk_engine.evaluate_weather_risk(
        temperature_c=38.0,
        humidity_pct=88.0,
        wind_speed_ms=16.0,
        precipitation_mm=12.0,
        equipment_risk_score=70.0
    )
    assert w["weather_risk_score"] > 60.0
    assert w["weather_boost"] <= 20.0
    assert w["weather_adjusted_risk_score"] > 70.0
