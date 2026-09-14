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

> **Expected Result:** 22/22 tests passed (100% success rate).

---

## Building Frontend for Production Verification

To verify production bundle compilation and TypeScript definitions:

```bash
cd src/frontend
npm run build
```

This compiles static assets into `src/frontend/dist` with zero type errors.
