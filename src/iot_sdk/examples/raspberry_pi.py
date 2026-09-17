#!/usr/bin/env python3
"""
GridGuard IoT SDK — Raspberry Pi GPIO Sensor Example
Demonstrates reading real sensors via GPIO/I2C and pushing data to GridGuard.

Hardware:
- Raspberry Pi 3/4/5
- DS18B20 temperature sensor (1-Wire GPIO)
- ADXL345 accelerometer (I2C vibration)
- ADS1115 ADC for analog sensors (partial discharge, oil quality, load)

NOTE: This example requires RPi.GPIO and smbus2 libraries.
      Install: pip install RPi.GPIO smbus2 adafruit-circuitpython-ads1x15
"""
from gridguard_iot import GridGuardIoTClient, SensorReading

# ── Configuration ──────────────────────────────────────────────────────
SERVER_URL = "http://your-gridguard-server:8000"
API_KEY = "gg_iot_your_api_key_here"

# Sensor pin/address configuration
TEMP_SENSOR_ID = "28-0000075f3a29"  # DS18B20 1-Wire device ID
I2C_BUS = 1


def read_ds18b20_temperature(sensor_id: str) -> float:
    """Read temperature from DS18B20 via 1-Wire."""
    try:
        with open(f"/sys/bus/w1/devices/{sensor_id}/w1_slave", "r") as f:
            lines = f.readlines()
        if "YES" in lines[0]:
            temp_pos = lines[1].find("t=")
            if temp_pos != -1:
                return float(lines[1][temp_pos + 2:]) / 1000.0
    except (FileNotFoundError, IndexError):
        pass
    return 65.0  # fallback


def read_vibration_i2c() -> float:
    """Read vibration from ADXL345 accelerometer via I2C."""
    try:
        import smbus2
        bus = smbus2.SMBus(I2C_BUS)
        # ADXL345 address 0x53, read XYZ acceleration
        data = bus.read_i2c_block_data(0x53, 0x32, 6)
        x = data[0] | (data[1] << 8)
        y = data[2] | (data[3] << 8)
        z = data[4] | (data[5] << 8)
        # Convert to mm/s RMS vibration estimate
        import math
        rms = math.sqrt(x**2 + y**2 + z**2) / 256.0
        return round(rms, 2)
    except Exception:
        return 2.5  # fallback


def read_analog_sensors() -> dict:
    """Read PD, oil quality, and load from ADS1115 ADC."""
    try:
        import board
        import busio
        import adafruit_ads1x15.ads1115 as ADS
        from adafruit_ads1x15.analog_in import AnalogIn

        i2c = busio.I2C(board.SCL, board.SDA)
        ads = ADS.ADS1115(i2c)

        pd_chan = AnalogIn(ads, ADS.P0)      # Channel 0: Partial discharge
        oil_chan = AnalogIn(ads, ADS.P1)     # Channel 1: Oil quality
        load_chan = AnalogIn(ads, ADS.P2)    # Channel 2: Load

        return {
            "partial_discharge": round(pd_chan.voltage * 20.0, 1),  # Scale to pC
            "oil_quality": round(oil_chan.voltage * 25.0, 1),       # Scale to 0-100
            "load": round(load_chan.voltage * 20.0, 1)              # Scale to MW
        }
    except Exception:
        return {"partial_discharge": 15.0, "oil_quality": 85.0, "load": 40.0}


def read_all_sensors() -> SensorReading:
    """Read all transformer sensors and return a SensorReading."""
    analog = read_analog_sensors()
    return SensorReading(
        temperature=read_ds18b20_temperature(TEMP_SENSOR_ID),
        vibration=read_vibration_i2c(),
        partial_discharge=analog["partial_discharge"],
        oil_quality=analog["oil_quality"],
        load=analog["load"],
        ambient_temperature=32.0  # Or read from a second DS18B20
    )


def main():
    client = GridGuardIoTClient(
        server_url=SERVER_URL,
        api_key=API_KEY,
        max_retries=5,
        retry_delay=5.0
    )

    print("🍓 GridGuard IoT — Raspberry Pi Sensor Gateway")
    print(f"   Target: {SERVER_URL}")
    print("   Starting auto-collection every 30 seconds...")

    client.start_auto_collector(
        sensor_fn=read_all_sensors,
        interval=30,
        batch_size=10,
        buffer_db_path="/home/pi/gridguard_buffer.db"
    )

    try:
        import time
        while True:
            time.sleep(60)
            client.heartbeat()
    except KeyboardInterrupt:
        client.stop_auto_collector()
        print("Stopped.")


if __name__ == "__main__":
    main()
