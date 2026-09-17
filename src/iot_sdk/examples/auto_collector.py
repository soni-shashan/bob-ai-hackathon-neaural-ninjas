#!/usr/bin/env python3
"""
GridGuard IoT SDK — Auto-Collector Example
Demonstrates automatic sensor polling and batch data push with offline buffering.
"""
import random
import time
import logging
from gridguard_iot import GridGuardIoTClient, SensorReading

# ── Configuration ──────────────────────────────────────────────────────
SERVER_URL = "http://localhost:8000"
API_KEY = "gg_iot_your_api_key_here"  # Replace with your actual API key

# Enable logging to see collector activity
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)


def simulate_transformer_sensors() -> SensorReading:
    """
    Simulates reading sensors from a power transformer.
    Replace this with actual hardware sensor reads (GPIO, Modbus, I2C, etc.)
    """
    return SensorReading(
        temperature=65.0 + random.gauss(0, 5),       # Normal: 60-75°C
        vibration=2.5 + random.gauss(0, 0.5),         # Normal: 1.5-3.5 mm/s
        partial_discharge=15.0 + random.gauss(0, 3),   # Normal: 8-22 pC
        oil_quality=85.0 + random.gauss(0, 3),         # Normal: 78-92
        load=40.0 + random.gauss(0, 8),                # Normal: 25-55 MW
        ambient_temperature=30.0 + random.gauss(0, 2)  # Normal: 26-34°C
    )


def main():
    # Initialize client
    client = GridGuardIoTClient(
        server_url=SERVER_URL,
        api_key=API_KEY,
        max_retries=5
    )

    print("🔌 Starting GridGuard IoT Auto-Collector")
    print(f"   Server: {SERVER_URL}")
    print(f"   Interval: 5 seconds (demo), Batch size: 3")
    print(f"   Press Ctrl+C to stop\n")

    # Start auto-collection
    # In production, use interval=30 (seconds) and batch_size=10
    client.start_auto_collector(
        sensor_fn=simulate_transformer_sensors,
        interval=5,        # Read every 5 seconds (demo speed)
        batch_size=3,       # Send batch every 3 readings
        buffer_db_path="./demo_buffer.db"
    )

    # Keep running
    try:
        while True:
            print(f"  📊 Buffer: {client.collector_buffer_size} readings queued")
            time.sleep(10)
    except KeyboardInterrupt:
        print("\n🛑 Stopping collector...")
        client.stop_auto_collector()
        print("✅ Stopped. Buffered data has been flushed.")


if __name__ == "__main__":
    main()
