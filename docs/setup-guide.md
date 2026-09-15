# GridGuard AI — Setup & Local Execution Guide

## Prerequisites

- **Python**: Version 3.10+ (Tested on Python 3.11 / 3.12)
- **Node.js**: Version 18+ (Tested on Node v20 / v22)
- **npm**: Version 9+
- **Docker & Docker Compose**: (Optional, for containerized single-command execution)

---

## Step-by-Step Installation

### 1. Clone the Repository
```bash
git clone https://github.com/soni-shashan/bob-ai-hackathon-neaural-ninjas.git
cd bob-ai-hackathon-neaural-ninjas
```

---

## Deployment & Execution Options

### Option A: Docker Deployment (Recommended — Single Command)

GridGuard AI provides a production-ready single-container Docker architecture combining the React frontend (served via Nginx) and FastAPI backend (reverse-proxied via Uvicorn), orchestrated by Supervisord.

#### Using Docker Compose:
```bash
docker compose up --build
```

#### Using Plain Docker:
```bash
docker build -t gridguard-ai .
docker run -p 3000:80 gridguard-ai
```

- **Operations Dashboard:** `http://localhost:3000`
- **Backend Health Check:** `http://localhost:3000/api/health`
- **API Documentation:** `http://localhost:3000/api/docs`

---

### Option B: Local Development (Independent Services)

#### 1. Backend Setup (FastAPI)
Navigate to the backend directory, create a virtual environment, and install dependencies:

**Linux / macOS:**
```bash
cd src/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell):**
```powershell
cd src/backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

#### 2. Frontend Setup (React 18 + Vite)
In a separate terminal, install node dependencies:
```bash
cd src/frontend
npm install
```

#### 3. Run the Application

**Terminal 1 — Backend:**
```bash
cd src/backend
# Linux / macOS:
PYTHONPATH="." python3 -m uvicorn app.main:app --reload --port 8000
# Windows (PowerShell):
$env:PYTHONPATH="."
python -m uvicorn app.main:app --reload --port 8000
```
- API Health Check: `http://localhost:8000/api/health`
- Interactive Swagger Docs: `http://localhost:8000/docs`

**Terminal 2 — Frontend:**
```bash
cd src/frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

### Option C: Root Orchestration Scripts
From the repository root:
```bash
# Terminal 1:
npm run dev:backend

# Terminal 2:
npm run dev:frontend
```

---

### Option D: Vercel Deployment

The project is pre-configured for Vercel deployment using `vercel.json` multi-service architecture:

```json
{
  "services": {
    "frontend": {
      "root": "frontend",
      "framework": "vite"
    },
    "backend": {
      "root": "backend",
      "entrypoint": "app.main:app"
    }
  },
  "rewrites": [
    { "source": "/api(/.*)?", "destination": { "type": "service", "service": "backend" } },
    { "source": "/(.*)", "destination": { "type": "service", "service": "frontend" } }
  ]
}
```

- **Relative API Routing:** All frontend API calls use relative paths (`/api/*`, e.g., `/api/health`, `/api/dashboard/summary`).
- **Zero Hardcoded Domains:** No domain or localhost URL is hardcoded in frontend code.
- **Local Dev Proxy:** Vite dev server (`http://localhost:5173`) proxies `/api` requests to `http://localhost:8000` via `src/frontend/vite.config.ts`.

---

## Port Configuration & Architecture

| Port | Service | Description | Configuration |
|---|---|---|---|
| **5173** | Frontend (Vite Dev) | Local development UI dashboard | `src/frontend/vite.config.ts` |
| **8000** | Backend API (FastAPI) | Core business logic, auth, telemetry & endpoints | `src/backend/app/config.py` (`API_PREFIX=/api`) |
| **8001** | External ML Service (Optional) | Optional external ML model endpoint for failure prediction | `EXTERNAL_ML_SERVICE_URL="http://localhost:8001/predict"` |
| **3000** | Docker Nginx Gateway | Reverse proxy serving frontend + `/api/*` to Uvicorn | `docker/nginx.conf` |

### External ML Service & Port 8001 Handling

The backend includes a pluggable ML bridge in `src/backend/app/config.py`:
- **Default (Internal ML Engine):** `USE_EXTERNAL_ML_SERVICE=false` uses the production-trained degradation heuristic directly inside FastAPI.
- **External ML Mode (Port 8001):** Set `USE_EXTERNAL_ML_SERVICE=true` and `EXTERNAL_ML_SERVICE_URL="http://localhost:8001/predict"` in `.env` to connect an external inference service on port 8001.
- **Resilience & Graceful Fallback:** If port 8001 is offline or times out (5-second timeout), the backend automatically logs a warning and falls back to the internal ML engine, ensuring zero service disruption.
- **CORS Support:** Port 8001 is included in the backend CORS whitelist (`http://localhost:8001`, `http://127.0.0.1:8001`).

---

## Default Operator Credentials

The application includes pre-seeded authentication:

| Field | Value |
|---|---|
| **Email** | `neaural.ninjas@electricity.com` |
| **Password** | `Admin@123` |
| **Role** | Grid Dispatcher / Lead Operator |

---

## Running Automated Verification Tests

Execute the backend test suite covering authentication, asset fleet querying, risk decomposition, sensor telemetry, IBM Bob AI fallback routing, and demo state progression:

```bash
cd src/backend
# Linux / macOS:
PYTHONPATH="." pytest tests/test_api.py -v
# Windows (PowerShell):
$env:PYTHONPATH="."
python -m pytest tests/test_api.py -v
```

> **Expected Result:** 15/15 core test suites passed (100% success rate).

---

## Building Frontend for Production Verification

To verify production bundle compilation and TypeScript definitions:

```bash
cd src/frontend
npm run build
```

This compiles static assets into `src/frontend/dist` with zero type errors.
