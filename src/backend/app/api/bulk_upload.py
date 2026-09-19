"""
Bulk CSV Upload API — Download template & upload filled CSV to register transformers in bulk.
"""
import csv
import io
import math
import logging
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import Asset, SensorReading, MaintenanceAction
from app.services.ml_background_service import ml_background_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bulk", tags=["Bulk Operations"])

# ── CSV Template Definition ────────────────────────────────────────────
TEMPLATE_COLUMNS = [
    "id", "name", "type", "location", "grid_zone",
    "latitude", "longitude", "capacity_mva", "load_mw",
    "criticality_score", "customers_affected", "installed_date",
    "oti", "wti", "ati", "oli", "vibration", "partial_discharge",
    "vl1", "vl2", "vl3", "il1", "il2", "il3"
]

EXAMPLE_ROWS = [
    {
        "id": "TR-901",
        "name": "Maninagar 220kV Step-Down Transformer 901",
        "type": "Power Transformer",
        "location": "East Industrial Substation",
        "grid_zone": "East Grid",
        "latitude": "23.0225",
        "longitude": "72.5714",
        "capacity_mva": "50",
        "load_mw": "35",
        "criticality_score": "75",
        "customers_affected": "12000",
        "installed_date": "2020-06-15",
        "oti": "82.5",
        "wti": "95.0",
        "ati": "38.5",
        "oli": "35.0",
        "vibration": "7.2",
        "partial_discharge": "45.0",
        "vl1": "240.1", "vl2": "232.5", "vl3": "241.0",
        "il1": "85.0", "il2": "95.0", "il3": "86.0"
    },
    {
        "id": "TR-902",
        "name": "Naroda 132kV Distribution Transformer 902",
        "type": "Power Transformer",
        "location": "North Regional Substation",
        "grid_zone": "North Grid",
        "latitude": "23.0890",
        "longitude": "72.6460",
        "capacity_mva": "40",
        "load_mw": "28",
        "criticality_score": "60",
        "customers_affected": "8500",
        "installed_date": "2019-03-20",
        "oti": "65.0",
        "wti": "72.0",
        "ati": "32.0",
        "oli": "75.0",
        "vibration": "2.1",
        "partial_discharge": "12.0",
        "vl1": "240.0", "vl2": "239.5", "vl3": "240.2",
        "il1": "75.0", "il2": "74.0", "il3": "76.0"
    },
]

REQUIRED_FIELDS = {"id", "name", "location"}

# ── Defaults for optional fields ───────────────────────────────────────
DEFAULTS = {
    "type": "Power Transformer",
    "grid_zone": "East Grid",
    "latitude": 23.0225,
    "longitude": 72.5714,
    "capacity_mva": 50.0,
    "load_mw": 30.0,
    "criticality_score": 70,
    "customers_affected": 5000,
}


# ── 1. Download CSV Template ──────────────────────────────────────────
@router.get("/template")
def download_csv_template():
    """Returns a downloadable CSV template with headers and 2 example rows."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=TEMPLATE_COLUMNS)
    writer.writeheader()
    for row in EXAMPLE_ROWS:
        writer.writerow(row)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=gridguard_bulk_template.csv"
        }
    )


# ── 2. Upload & Process CSV ──────────────────────────────────────────
@router.post("/upload")
async def upload_bulk_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accepts a CSV file, validates each row, and creates assets in bulk.
    Returns a detailed summary with created, skipped, and error counts.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    try:
        raw_bytes = await file.read()
        content = raw_bytes.decode("utf-8-sig")  # Handle BOM from Excel
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read file. Ensure it is a valid UTF-8 CSV.")

    reader = csv.DictReader(io.StringIO(content))

    # Validate headers
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty.")

    clean_headers = [h.strip().lower() for h in reader.fieldnames]
    missing_required = REQUIRED_FIELDS - set(clean_headers)
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing_required))}. "
                   f"Required columns: id, name, location"
        )

    # Process each row
    results = {
        "total_rows": 0,
        "created": 0,
        "skipped": 0,
        "errors": []
    }

    now = datetime.now(timezone.utc)

    for row_num, raw_row in enumerate(reader, start=2):  # Row 1 is header
        results["total_rows"] += 1

        # Normalize keys
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        # ── Validate required fields ──
        row_errors = []
        for field in REQUIRED_FIELDS:
            if not row.get(field):
                row_errors.append(f"Missing required field '{field}'")

        if row_errors:
            results["skipped"] += 1
            results["errors"].append({
                "row": row_num,
                "id": row.get("id", "—"),
                "errors": row_errors
            })
            continue

        asset_id = row["id"].strip().upper()

        # ── Check for duplicate in database ──
        existing = db.query(Asset).filter(Asset.id == asset_id).first()
        if existing:
            results["skipped"] += 1
            results["errors"].append({
                "row": row_num,
                "id": asset_id,
                "errors": [f"Asset '{asset_id}' already exists in database"]
            })
            continue

        # ── Parse optional numeric fields with safe defaults ──
        try:
            latitude = float(row.get("latitude") or DEFAULTS["latitude"])
            longitude = float(row.get("longitude") or DEFAULTS["longitude"])
            capacity_mva = float(row.get("capacity_mva") or DEFAULTS["capacity_mva"])
            load_mw = float(row.get("load_mw") or DEFAULTS["load_mw"])
            criticality_score = int(float(row.get("criticality_score") or DEFAULTS["criticality_score"]))
            customers_affected = int(float(row.get("customers_affected") or DEFAULTS["customers_affected"]))
        except (ValueError, TypeError) as e:
            results["skipped"] += 1
            results["errors"].append({
                "row": row_num,
                "id": asset_id,
                "errors": [f"Invalid numeric value: {str(e)}"]
            })
            continue

        asset_type = row.get("type") or DEFAULTS["type"]
        grid_zone = row.get("grid_zone") or DEFAULTS["grid_zone"]
        installed_date = row.get("installed_date") or now.strftime("%Y-%m-%d")

        # ── Parse Optional ML Features ──
        def _parse_float(key, default):
            try:
                return float(row.get(key)) if row.get(key) else default
            except (ValueError, TypeError):
                return default

        # If explicit ML features are provided, use them. Otherwise fallback to nominal defaults.
        nom_curr = max(15.0, (load_mw / 100.0) * 85.0)
        c_oti = _parse_float("oti", 66.0)
        c_wti = _parse_float("wti", c_oti + 10.0)
        c_ati = _parse_float("ati", 31.0)
        c_oli = _parse_float("oli", 86.0)
        c_vib = _parse_float("vibration", 2.4)
        c_pd = _parse_float("partial_discharge", 14.0)
        c_vl1 = _parse_float("vl1", 240.0)
        c_vl2 = _parse_float("vl2", 239.5)
        c_vl3 = _parse_float("vl3", 240.2)
        c_il1 = _parse_float("il1", nom_curr)
        c_il2 = _parse_float("il2", nom_curr * 0.99)
        c_il3 = _parse_float("il3", nom_curr * 1.01)

        # ── Create Asset ──
        new_asset = Asset(
            id=asset_id,
            name=row["name"].strip(),
            asset_type=asset_type,
            substation=row["location"].strip(),
            grid_zone=grid_zone,
            latitude=latitude,
            longitude=longitude,
            capacity_mva=capacity_mva,
            load_mw=load_mw,
            health_score=82, # Will be overwritten by ML background worker
            criticality_score=criticality_score,
            customers_affected=customers_affected,
            status="OPERATIONAL",
            installed_date=installed_date,
            last_maintenance=now.strftime("%Y-%m-%d")
        )
        db.add(new_asset)
        db.flush()

        # ── Generate 100 historical sensor readings (using provided ML features + minor jitter) ──
        sensor_points = []
        for step in range(100):
            hours_ago = 24.0 * (1.0 - (step / 99.0))
            ts = (now - timedelta(hours=hours_ago)).isoformat()
            
            # Add a small sine wave jitter to make charts look alive, centered around the provided values
            temp = c_oti + math.sin(step * 0.25) * 2.0
            vib = c_vib + math.cos(step * 0.3) * 0.2
            pd_val = c_pd + math.sin(step * 0.2) * 1.5
            oil = c_oli - math.sin(step * 0.1) * 1.0
            load_val = load_mw + math.sin(step * 0.15) * 2.0

            sensor_points.append(SensorReading(
                asset_id=asset_id,
                timestamp=ts,
                temperature=round(temp, 2),
                vibration=round(vib, 2),
                partial_discharge=round(pd_val, 2),
                oil_quality=round(oil, 2),
                load=round(load_val, 2),
                ambient_temperature=round(c_ati + math.sin(step * 0.15) * 1.5, 1)
            ))
        db.bulk_save_objects(sensor_points)

        # ── Initial maintenance action ──
        db.add(MaintenanceAction(
            id=f"MA-{asset_id}-INIT",
            asset_id=asset_id,
            crew_id=None,
            priority=4,
            action="Initial Baseline Commissioning & Diagnostic Scan",
            status="PENDING",
            scheduled_time=(now + timedelta(days=7)).isoformat(),
            estimated_duration_hours=2.0,
            reason="New transformer onboarded to GridGuard AI active monitoring via bulk upload.",
            expected_risk_reduction_pct=15
        ))

        results["created"] += 1

    # Commit all at once for atomicity
    try:
        db.commit()
        # Trigger background ML evaluation for all assets so the new ones get their correct risk scores immediately
        if results["created"] > 0:
            background_tasks.add_task(ml_background_service.run_background_reevaluation)
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk upload commit failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

    results["message"] = (
        f"Bulk upload complete. {results['created']} transformer(s) registered successfully."
        + (f" {results['skipped']} row(s) skipped." if results["skipped"] > 0 else "")
    )

    return results
