#!/bin/bash
# Start all KaraokeYT servers

echo "🎤 KaraokeYT Server Starter"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

# Function to check if port is in use
check_port() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Kill existing processes
echo "🧹 Cleaning up old processes..."
if check_port 8787; then
    echo "  Killing process on port 8787..."
    lsof -ti:8787 | xargs kill -9 2>/dev/null || true
fi
if check_port 8788; then
    echo "  Killing process on port 8788..."
    lsof -ti:8788 | xargs kill -9 2>/dev/null || true
fi
if check_port 3001; then
    echo "  Killing process on port 3001..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
fi
sleep 1

echo ""
echo "🚀 Starting servers..."
echo ""

# Check .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env 2>/dev/null || echo "No .env.example found"
fi

# Start Relay Server (port 8787)
echo "1️⃣  Starting Relay Server (port 8787)..."
node server/remoteRelay.mjs > relay.log 2>&1 &
RELAY_PID=$!
sleep 2

if check_port 8787; then
    echo -e "${GREEN}   ✅ Relay Server running (PID: $RELAY_PID)${NC}"
else
    echo -e "${YELLOW}   ⚠️  Relay Server may have failed to start${NC}"
    echo "   Check relay.log for errors"
fi

# Start Auth Service (port 8788)
echo ""
echo "2️⃣  Starting Auth Service (port 8788)..."
node server/authService.mjs > auth.log 2>&1 &
AUTH_PID=$!
sleep 2

if check_port 8788; then
    echo -e "${GREEN}   ✅ Auth Service running (PID: $AUTH_PID)${NC}"
else
    echo -e "${YELLOW}   ⚠️  Auth Service may have failed to start${NC}"
    echo "   Check auth.log for errors"
fi

# Check Backend API (port 3001)
echo ""
echo "3️⃣  Checking Backend API (port 3001)..."
if check_port 3001; then
    echo -e "${GREEN}   ✅ Backend API already running${NC}"
else
    echo -e "${YELLOW}   ℹ️  Backend API not running${NC}"
    echo "   To start: cd backend && npm run dev"
fi

echo ""
echo "============================"
echo -e "${GREEN}✅ Servers started!${NC}"
echo "============================"
echo ""
echo "📋 Server Status:"
echo "   • Relay Server:  http://localhost:8787"
echo "   • Auth Service:  http://localhost:8788"
echo "   • Backend API:   http://localhost:3001 (if running)"
echo ""
echo "🎤 You can now start the frontend:"
echo "   npm run dev"
echo ""
echo "📝 Logs:"
echo "   • relay.log - Relay server logs"
echo "   • auth.log  - Auth service logs"
echo ""
echo "🛑 To stop all servers:"
echo "   ./stop-servers.sh"
