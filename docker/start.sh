#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════╗"
echo "║         GridGuard AI — Starting Services             ║"
echo "╚══════════════════════════════════════════════════════╝"

# Ensure database file has correct permissions
if [ -f /app/gridguard.db ]; then
    chmod 666 /app/gridguard.db
    echo "✓ Database ready at /app/gridguard.db"
else
    echo "⚠ No database file found — backend will create one on startup"
fi

echo "✓ Starting Nginx (port 80) + Uvicorn (port 8000)..."
echo "  → Frontend: http://localhost"
echo "  → API:      http://localhost/api"
echo "  → Health:   http://localhost/api/health"

# Launch supervisord (runs both nginx + uvicorn)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/gridguard.conf
