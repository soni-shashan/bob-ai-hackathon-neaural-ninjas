# Contributing to GridGuard AI

Thank you for contributing to **GridGuard AI**! This project is built for the **IBM Bob Hackathon**.

## Architecture Guidelines

- **Frontend-Backend Separation**: All API requests from the frontend must route through `/api/*` on the FastAPI backend.
- **ML Integration Boundary**: Do NOT call external ML models or inference endpoints directly from the frontend. Route all ML predictions through `src/backend/app/services/ml_service.py` via `POST /api/ml/predict`.
- **Deterministic Datasets**: Always ensure mock seed data remains deterministic so demo scenarios (such as TR-104 at Naroda Substation) run consistently across environments.
- **Dark Industrial Aesthetic**: Maintain high information density, clear contrast, accessible risk badges (Green, Amber, Orange, Red), and operational grid control center styling.

## Local Development

```powershell
# 1. Backend Setup
cd src/backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 2. Frontend Setup (in a separate terminal)
cd src/frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to access the Grid Operations Center dashboard.
Backend API documentation is available at `http://localhost:8000/docs`.
