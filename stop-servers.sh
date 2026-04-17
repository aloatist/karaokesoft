#!/bin/bash
# Stop all KaraokeYT servers

echo "🛑 Stopping KaraokeYT servers..."

# Kill relay server (port 8787)
if lsof -ti:8787 >/dev/null 2>&1; then
    echo "  Stopping Relay Server (port 8787)..."
    lsof -ti:8787 | xargs kill -9 2>/dev/null || true
fi

# Kill auth service (port 8788)
if lsof -ti:8788 >/dev/null 2>&1; then
    echo "  Stopping Auth Service (port 8788)..."
    lsof -ti:8788 | xargs kill -9 2>/dev/null || true
fi

# Kill backend API (port 3001)
if lsof -ti:3001 >/dev/null 2>&1; then
    echo "  Stopping Backend API (port 3001)..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
fi

# Kill by process name
pkill -f "remoteRelay.mjs" 2>/dev/null || true
pkill -f "authService.mjs" 2>/dev/null || true

echo "✅ All servers stopped"
