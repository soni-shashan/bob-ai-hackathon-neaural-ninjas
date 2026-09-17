"""
GridGuard IoT SDK — Auto Sensor Data Collector.
Runs a background thread that periodically reads sensor data and pushes to the server.
"""
import threading
import logging
import time
import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Callable, Optional, List

from gridguard_iot.sensor import SensorReading
from gridguard_iot.exceptions import GridGuardIoTError

logger = logging.getLogger("gridguard_iot.collector")


class AutoCollector:
    """
    Background sensor data collector with:
    - Configurable poll interval
    - Offline buffering to local SQLite
    - Auto-retry and sync when connection restored
    - Graceful shutdown
    """

    def __init__(
        self,
        client,  # GridGuardIoTClient instance
        sensor_fn: Callable[[], SensorReading],
        interval_seconds: float = 30.0,
        batch_size: int = 10,
        buffer_db_path: Optional[str] = None
    ):
        """
        Args:
            client: GridGuardIoTClient instance (must be initialized with server_url and api_key)
            sensor_fn: Callable that returns a SensorReading. Called every `interval_seconds`.
            interval_seconds: Seconds between sensor reads (default 30)
            batch_size: Number of readings to accumulate before sending a batch (default 10)
            buffer_db_path: Path for offline buffer SQLite DB (default: ./gridguard_buffer.db)
        """
        self.client = client
        self.sensor_fn = sensor_fn
        self.interval = interval_seconds
        self.batch_size = batch_size
        self.buffer_db_path = buffer_db_path or "./gridguard_buffer.db"

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._buffer: List[SensorReading] = []
        self._lock = threading.Lock()

        # Initialize offline buffer DB
        self._init_buffer_db()

    def _init_buffer_db(self):
        """Create offline buffer SQLite database if it doesn't exist."""
        try:
            conn = sqlite3.connect(self.buffer_db_path)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS buffered_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reading_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    synced INTEGER DEFAULT 0
                )
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to initialize buffer DB: {e}")

    def _save_to_buffer(self, readings: List[SensorReading]):
        """Save readings to offline buffer when server is unreachable."""
        try:
            conn = sqlite3.connect(self.buffer_db_path)
            now = datetime.now(timezone.utc).isoformat()
            for reading in readings:
                conn.execute(
                    "INSERT INTO buffered_readings (reading_json, created_at) VALUES (?, ?)",
                    (json.dumps(reading.to_dict()), now)
                )
            conn.commit()
            conn.close()
            logger.info(f"Buffered {len(readings)} readings offline.")
        except Exception as e:
            logger.error(f"Failed to buffer readings: {e}")

    def _sync_buffer(self):
        """Attempt to sync buffered readings to the server."""
        try:
            conn = sqlite3.connect(self.buffer_db_path)
            rows = conn.execute(
                "SELECT id, reading_json FROM buffered_readings WHERE synced = 0 ORDER BY id LIMIT 100"
            ).fetchall()

            if not rows:
                conn.close()
                return

            readings = []
            ids = []
            for row_id, reading_json in rows:
                data = json.loads(reading_json)
                readings.append(SensorReading(**{
                    k: data[k] for k in SensorReading.__dataclass_fields__
                    if k in data
                }))
                ids.append(row_id)

            # Try to send buffered readings
            response = self.client.send_batch(readings)
            if response and response.get("success"):
                # Mark as synced
                placeholders = ",".join("?" * len(ids))
                conn.execute(
                    f"UPDATE buffered_readings SET synced = 1 WHERE id IN ({placeholders})",
                    ids
                )
                conn.commit()
                logger.info(f"Synced {len(ids)} buffered readings.")

            conn.close()
        except Exception as e:
            logger.debug(f"Buffer sync failed (will retry): {e}")

    def _collect_loop(self):
        """Main collection loop running in background thread."""
        logger.info(
            f"AutoCollector started: interval={self.interval}s, batch_size={self.batch_size}"
        )

        while self._running:
            try:
                # 1. Read sensor data
                reading = self.sensor_fn()
                reading.validate()

                with self._lock:
                    self._buffer.append(reading)

                logger.debug(
                    f"Collected reading: temp={reading.temperature}°C, "
                    f"vib={reading.vibration}mm/s, buffer_size={len(self._buffer)}"
                )

                # 2. Send batch when buffer is full
                if len(self._buffer) >= self.batch_size:
                    with self._lock:
                        batch = self._buffer.copy()
                        self._buffer.clear()

                    try:
                        response = self.client.send_batch(batch)
                        if response:
                            logger.info(
                                f"Batch sent: {response.get('readings_accepted', 0)} accepted, "
                                f"prediction: {response.get('latest_prediction', {}).get('prediction', 'N/A')}"
                            )
                            # Try syncing any offline buffer
                            self._sync_buffer()
                    except Exception as e:
                        logger.warning(f"Batch send failed: {e}. Buffering offline.")
                        self._save_to_buffer(batch)

            except Exception as e:
                logger.error(f"Collection error: {e}")

            # Sleep in small increments for responsive shutdown
            for _ in range(int(self.interval * 10)):
                if not self._running:
                    break
                time.sleep(0.1)

    def start(self):
        """Start the auto-collector in a background daemon thread."""
        if self._running:
            logger.warning("AutoCollector is already running.")
            return

        self._running = True
        self._thread = threading.Thread(target=self._collect_loop, daemon=True, name="gridguard-collector")
        self._thread.start()
        logger.info("AutoCollector started.")

    def stop(self):
        """Stop the auto-collector gracefully."""
        if not self._running:
            return

        self._running = False
        if self._thread:
            self._thread.join(timeout=self.interval + 2)
            logger.info("AutoCollector stopped.")

        # Flush remaining buffer
        with self._lock:
            if self._buffer:
                try:
                    self.client.send_batch(self._buffer)
                except Exception:
                    self._save_to_buffer(self._buffer)
                self._buffer.clear()

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def buffer_size(self) -> int:
        with self._lock:
            return len(self._buffer)
