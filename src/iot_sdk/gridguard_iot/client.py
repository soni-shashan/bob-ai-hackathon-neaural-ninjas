"""
GridGuard IoT SDK — Main Client.
Provides the primary API for IoT devices to communicate with the GridGuard server.
"""
import logging
import time
import json
from typing import List, Optional, Dict, Any, Callable
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from gridguard_iot.sensor import SensorReading
from gridguard_iot.collector import AutoCollector
from gridguard_iot.exceptions import (
    AuthenticationError, ConnectionError, IngestError, ValidationError
)

logger = logging.getLogger("gridguard_iot")


class GridGuardIoTClient:
    """
    GridGuard IoT Client SDK.

    Connects IoT sensor devices to the GridGuard AI platform for automatic
    data ingestion and ML-powered predictive maintenance.

    Usage:
        from gridguard_iot import GridGuardIoTClient, SensorReading

        client = GridGuardIoTClient(
            server_url="http://localhost:8000",
            api_key="gg_iot_your_api_key_here"
        )

        # Send a single reading
        result = client.send_reading(
            temperature=72.5, vibration=3.2, partial_discharge=18.0,
            oil_quality=82.0, load=45.0
        )

        # Send a batch
        readings = [
            SensorReading(temperature=72.5, vibration=3.2, partial_discharge=18.0,
                         oil_quality=82.0, load=45.0),
            SensorReading(temperature=73.1, vibration=3.3, partial_discharge=18.5,
                         oil_quality=81.8, load=46.0),
        ]
        result = client.send_batch(readings)

        # Auto-collect with a sensor function
        def read_sensors():
            return SensorReading(
                temperature=read_temp_sensor(),
                vibration=read_vib_sensor(),
                partial_discharge=read_pd_sensor(),
                oil_quality=read_oil_sensor(),
                load=read_load_sensor()
            )

        client.start_auto_collector(interval=30, sensor_fn=read_sensors)
    """

    def __init__(
        self,
        server_url: str,
        api_key: str,
        timeout: float = 10.0,
        max_retries: int = 3,
        retry_delay: float = 2.0
    ):
        """
        Initialize the GridGuard IoT client.

        Args:
            server_url: Base URL of the GridGuard server (e.g., http://localhost:8000)
            api_key: IoT device API key (obtained from device registration)
            timeout: HTTP request timeout in seconds (default 10)
            max_retries: Maximum number of retry attempts on failure (default 3)
            retry_delay: Base delay between retries in seconds (exponential backoff)
        """
        self.server_url = server_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._collector: Optional[AutoCollector] = None

        logger.info(f"GridGuard IoT Client initialized: {self.server_url}")

    def _make_request(self, endpoint: str, data: Optional[dict] = None, method: str = "POST") -> dict:
        """
        Make an HTTP request to the GridGuard server with retry logic.
        Uses urllib (no external dependencies needed).
        """
        url = f"{self.server_url}/api/iot/{endpoint}"
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                body = json.dumps(data).encode("utf-8") if data else None
                req = Request(url, data=body, headers=headers, method=method)

                with urlopen(req, timeout=self.timeout) as response:
                    response_data = json.loads(response.read().decode("utf-8"))
                    return response_data

            except HTTPError as e:
                if e.code == 401:
                    raise AuthenticationError(
                        "Invalid API key or device deactivated. "
                        "Check your API key or re-register the device."
                    )
                elif e.code == 422:
                    error_body = e.read().decode("utf-8") if e.fp else "Validation error"
                    raise ValidationError(f"Data validation failed: {error_body}")
                else:
                    last_error = e
                    logger.warning(
                        f"HTTP error {e.code} on attempt {attempt}/{self.max_retries}: {e.reason}"
                    )

            except URLError as e:
                last_error = e
                logger.warning(
                    f"Connection error on attempt {attempt}/{self.max_retries}: {e.reason}"
                )

            except Exception as e:
                last_error = e
                logger.warning(
                    f"Request error on attempt {attempt}/{self.max_retries}: {e}"
                )

            # Exponential backoff
            if attempt < self.max_retries:
                delay = self.retry_delay * (2 ** (attempt - 1))
                logger.debug(f"Retrying in {delay:.1f}s...")
                time.sleep(delay)

        raise ConnectionError(
            f"Failed to reach GridGuard server after {self.max_retries} attempts: {last_error}"
        )

    def send_reading(
        self,
        temperature: float,
        vibration: float,
        partial_discharge: float,
        oil_quality: float,
        load: float,
        ambient_temperature: float = 32.0,
        **kwargs
    ) -> dict:
        """
        Send a single sensor reading to the GridGuard server.

        Args:
            temperature: Top oil temperature (°C)
            vibration: Acoustic vibration (mm/s)
            partial_discharge: Partial discharge activity (pC)
            oil_quality: Dielectric oil quality index (0-100)
            load: Active load (MW)
            ambient_temperature: Ambient temperature (°C)
            **kwargs: Optional IEEE C57.91 fields (oti, wti, ati, vl1, etc.)

        Returns:
            dict with ingestion result and ML prediction
        """
        reading = SensorReading(
            temperature=temperature,
            vibration=vibration,
            partial_discharge=partial_discharge,
            oil_quality=oil_quality,
            load=load,
            ambient_temperature=ambient_temperature,
            **kwargs
        )
        return self.send_batch([reading])

    def send_batch(self, readings: List[SensorReading]) -> dict:
        """
        Send a batch of sensor readings to the GridGuard server.

        Args:
            readings: List of SensorReading objects (max 500 per batch)

        Returns:
            dict with:
                - success: bool
                - readings_accepted: int
                - latest_prediction: dict with ML prediction results
                - alerts: list of triggered alerts
        """
        if not readings:
            raise ValidationError("Cannot send empty batch.")
        if len(readings) > 500:
            raise ValidationError("Maximum 500 readings per batch.")

        # Validate all readings
        for i, r in enumerate(readings):
            try:
                r.validate()
            except ValueError as e:
                raise ValidationError(f"Reading #{i}: {e}")

        payload = {
            "readings": [r.to_dict() for r in readings]
        }

        result = self._make_request("ingest", data=payload)

        # Log alerts
        for alert in result.get("alerts", []):
            logger.warning(f"🚨 ALERT: {alert}")

        return result

    def heartbeat(self) -> dict:
        """
        Send a heartbeat / keep-alive signal to the server.

        Returns:
            dict with server acknowledgment and timestamp
        """
        return self._make_request("heartbeat")

    def start_auto_collector(
        self,
        sensor_fn: Callable[[], SensorReading],
        interval: float = 30.0,
        batch_size: int = 10,
        buffer_db_path: Optional[str] = None
    ):
        """
        Start automatic sensor data collection in a background thread.

        Args:
            sensor_fn: Callable that returns a SensorReading when called.
                       Will be called every `interval` seconds.
            interval: Seconds between sensor reads (default 30)
            batch_size: Readings to accumulate before sending (default 10)
            buffer_db_path: Path for offline buffer SQLite DB

        Example:
            def read_sensors():
                return SensorReading(
                    temperature=read_temp(),
                    vibration=read_vib(),
                    partial_discharge=read_pd(),
                    oil_quality=read_oil(),
                    load=read_load()
                )
            client.start_auto_collector(sensor_fn=read_sensors, interval=30)
        """
        if self._collector and self._collector.is_running:
            logger.warning("Auto-collector already running. Stop first before restarting.")
            return

        self._collector = AutoCollector(
            client=self,
            sensor_fn=sensor_fn,
            interval_seconds=interval,
            batch_size=batch_size,
            buffer_db_path=buffer_db_path
        )
        self._collector.start()

    def stop_auto_collector(self):
        """Stop the auto-collector gracefully, flushing any buffered readings."""
        if self._collector:
            self._collector.stop()
            self._collector = None

    @property
    def collector_running(self) -> bool:
        """Check if the auto-collector is currently running."""
        return self._collector is not None and self._collector.is_running

    @property
    def collector_buffer_size(self) -> int:
        """Number of readings buffered in the auto-collector waiting to be sent."""
        return self._collector.buffer_size if self._collector else 0
