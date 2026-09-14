# GridGuard AI — Setup & Local Execution Guide

## Prerequisites

- **Python**: Version 3.10+ (Tested on Python 3.12)
- **Node.js**: Version 18+ (Tested on Node v22.12.0)
- **npm**: Version 9+

---

## Step-by-Step Installation

### 1. Clone the Repository
```powershell
git clone <repository-url>
cd bob-ai-hackathon-neaural-ninjas
```

### 2. Backend Setup
In your terminal, navigate to the backend directory and install Python dependencies:
```powershell
cd src/backend
python -m pip install -r requirements.txt
```

### 3. Frontend Setup
In a separate terminal, navigate to the frontend directory and install npm packages:
```powershell
cd src/frontend
npm install
```

---

## Running the Application Locally

### Option A: Running Services Independently

**Terminal 1 — Backend (FastAPI):**
```powershell
cd src/backend
$env:PYTHONPATH="."
python -m uvicorn app.main:app --reload --port 8000
```
- API Health Check: `http://localhost:8000/api/health`
- Interactive Swagger Docs: `http://localhost:8000/docs`

**Terminal 2 — Frontend (Vite + React):**
```powershell
cd src/frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

### Option B: Root Orchestration
From the root workspace directory:
```powershell
npm run dev:backend
# In another terminal:
npm run dev:frontend
```

---

## Running Automated Backend Tests

To execute the backend verification test suite covering all API contracts and demo stage transitions:
```powershell
cd src/backend
$env:PYTHONPATH="."
python -m pytest tests/test_api.py -v
```

---

## Building Frontend for Production Verification

```powershell
cd src/frontend
npm run build
```

This compiles TypeScript definitions and creates an optimized static production bundle in `src/frontend/dist`.
