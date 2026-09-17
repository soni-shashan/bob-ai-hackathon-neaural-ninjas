#!/usr/bin/env python3
"""
GridGuard IoT SDK — Basic Usage Example
Demonstrates sending a single sensor reading and interpreting the response.
"""
from gridguard_iot import GridGuardIoTClient, SensorReading

# ── Configuration ──────────────────────────────────────────────────────
SERVER_URL = "http://localhost:8000"
API_KEY = "gg_iot_your_api_key_here"  # Replace with your actual API key


def main():
    # 1. Initialize client
    client = GridGuardIoTClient(
        server_url=SERVER_URL,
        api_key=API_KEY,
        timeout=10.0,
        max_retries=3
    )

    # 2. Send a single reading
    print("Sending sensor reading...")
    result = client.send_reading(
        temperature=72.5,
        vibration=3.2,
        partial_discharge=18.0,
        oil_quality=82.0,
        load=45.0,
        ambient_temperature=31.0
    )

    # 3. Process response
    print(f"\n✅ Data ingested successfully!")
    print(f"   Device: {result['device_id']}")
    print(f"   Asset:  {result['asset_id']}")
    print(f"   Readings accepted: {result['readings_accepted']}")

    prediction = result.get("latest_prediction")
    if prediction:
        print(f"\n🤖 ML Prediction:")
        print(f"   Risk Level:    {prediction['risk_level']}")
        print(f"   Prediction:    {prediction['prediction']}")
        print(f"   Failure Prob:  {prediction['failure_probability']:.0%}")
        print(f"   Health Score:  {prediction.get('health_score', 'N/A')}")
        print(f"   Is Anomaly:    {prediction.get('is_anomaly', 'N/A')}")
        print(f"   Action:        {prediction.get('recommended_action', 'N/A')}")

    alerts = result.get("alerts", [])
    if alerts:
        print(f"\n🚨 Alerts ({len(alerts)}):")
        for alert in alerts:
            print(f"   {alert}")

    # 4. Send heartbeat
    print("\n💓 Sending heartbeat...")
    hb = client.heartbeat()
    print(f"   Status: {hb['status']}")
    print(f"   Server time: {hb['server_time']}")


if __name__ == "__main__":
    main()
