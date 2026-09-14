# ============================================================
# GridGuard AI — Single-Container Production Dockerfile
# Builds frontend (React/Vite) + backend (FastAPI/Uvicorn)
# Serves via Nginx (static) + reverse-proxy (/api → Uvicorn)
# ============================================================

# ── Stage 1: Build Frontend ─────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies first (cache layer)
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci --silent

# Copy frontend source and build
COPY src/frontend/ ./
RUN npm run build


# ── Stage 2: Production Runtime ─────────────────────────────
FROM python:3.11-slim AS runtime

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Backend Setup ───────────────────────────────────────────
WORKDIR /app/backend

# Install Python dependencies (cache layer)
COPY src/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY src/backend/app/ ./app/

# Copy the database (seed data + ML artifacts are embedded)
COPY src/gridguard.db /app/gridguard.db

# ── Frontend Static Files ──────────────────────────────────
# Copy built frontend from Stage 1
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# ── Nginx Configuration ────────────────────────────────────
RUN rm /etc/nginx/sites-enabled/default
COPY docker/nginx.conf /etc/nginx/conf.d/gridguard.conf

# ── Supervisor Configuration ───────────────────────────────
COPY docker/supervisord.conf /etc/supervisor/conf.d/gridguard.conf

# ── Startup Script ──────────────────────────────────────────
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# ── Environment Variables ───────────────────────────────────
ENV DATABASE_URL="sqlite:////app/gridguard.db" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CORS_ORIGINS="*"

# ── Expose Ports ────────────────────────────────────────────
# Port 80  → Nginx (frontend + API reverse proxy)
# Port 8000 → Uvicorn (backend API — internal only)
EXPOSE 80

# ── Health Check ────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# ── Start ───────────────────────────────────────────────────
CMD ["/app/start.sh"]
