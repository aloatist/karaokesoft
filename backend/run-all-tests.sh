#!/bin/bash
# Full automated test - setup + start server + test
# Usage: ./run-all-tests.sh

set -e

echo "🚀 KaraokeYT Backend Full Test"
echo "==============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

# Check if already running
if lsof -ti:3001 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Server already running on port 3001${NC}"
    echo "Killing existing server..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Step 1: Setup
echo "📦 Step 1: Setting up..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Use SQLite for quick test
if [ ! -f "prisma/schema.prisma" ] || ! grep -q "sqlite" prisma/schema.prisma 2>/dev/null; then
    echo "Setting up SQLite database..."
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
fi

if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
PORT=3001
NODE_ENV=development
LOG_LEVEL=error
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
JWT_ACCESS_SECRET=your_test_access_secret
JWT_REFRESH_SECRET=your_test_refresh_secret
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
EOF
fi

echo "Generating Prisma client..."
npx prisma generate >/dev/null 2>&1

if [ ! -f "prisma/dev.db" ]; then
    echo "Running migrations..."
    npx prisma migrate dev --name init --skip-generate --preview-feature >/dev/null 2>&1 || true
fi

echo -e "${GREEN}✓ Setup complete${NC}"
echo ""

# Step 2: Start server in background
echo "🖥️  Step 2: Starting server..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Server failed to start${NC}"
        echo "Check server.log for errors:"
        tail -20 server.log
        exit 1
    fi
done
echo ""

# Step 3: Run tests
echo "🧪 Step 3: Running API tests..."
echo ""

BASE_URL="http://localhost:3001"
EMAIL="test$(date +%s)@example.com"
PASSWORD="testpassword123"

PASS_COUNT=0
FAIL_COUNT=0

test_case() {
    local name=$1
    local result=$2
    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✓ $name${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ $name${NC}"
        ((FAIL_COUNT++))
    fi
}

# Test 1: Health
echo "Test 1: Health Check"
if curl -s http://localhost:3001/health | grep -q "ok"; then
    test_case "Health Check" 0
else
    test_case "Health Check" 1
fi

# Test 2: Register
echo ""
echo "Test 2: Register User ($EMAIL)"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"name\": \"Test User\"}")

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || true)
API_KEY=$(echo "$REGISTER_RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4 || true)

if [ ! -z "$ACCESS_TOKEN" ]; then
    test_case "Register" 0
    echo "  Access Token: ${ACCESS_TOKEN:0:30}..."
    echo "  API Key: ${API_KEY:0:30}..."
else
    test_case "Register" 1
    echo "  Response: $REGISTER_RESPONSE"
fi

# Test 3: Login
echo ""
echo "Test 3: Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    test_case "Login" 0
else
    test_case "Login" 1
fi

# Test 4: Get User
echo ""
echo "Test 4: Get User Info"
USER_RESPONSE=$(curl -s "$BASE_URL/api/user/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$USER_RESPONSE" | grep -q "$EMAIL"; then
    test_case "Get User" 0
else
    test_case "Get User" 1
fi

# Test 5: API Key Status
echo ""
echo "Test 5: API Key Status"
KEY_STATUS=$(curl -s "$BASE_URL/api/api-key/status" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$KEY_STATUS" | grep -q "quota"; then
    test_case "API Key Status" 0
    QUOTA=$(echo "$KEY_STATUS" | grep -o '"quota":[0-9]*' | cut -d':' -f2)
    echo "  Daily Quota: $QUOTA"
else
    test_case "API Key Status" 1
fi

# Test 6: Rotate API Key
echo ""
echo "Test 6: Rotate API Key"
ROTATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/api-key/rotate" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$ROTATE_RESPONSE" | grep -q "rotated successfully"; then
    test_case "Rotate API Key" 0
    NEW_KEY=$(echo "$ROTATE_RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
    echo "  New Key: ${NEW_KEY:0:30}..."
else
    test_case "Rotate API Key" 1
fi

# Test 7: Subscription Plans
echo ""
echo "Test 7: Subscription Plans"
PLANS=$(curl -s "$BASE_URL/api/subscription/plans")

if echo "$PLANS" | grep -q "premium"; then
    test_case "Get Plans" 0
    # Count plans
    PLAN_COUNT=$(echo "$PLANS" | grep -o '"id"' | wc -l | tr -d ' ')
    echo "  Available plans: $PLAN_COUNT"
else
    test_case "Get Plans" 1
fi

# Test 8: Logout
echo ""
echo "Test 8: Logout"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$LOGOUT_RESPONSE" | grep -q "success"; then
    test_case "Logout" 0
else
    test_case "Logout" 1
fi

# Test 9: Invalid Token
echo ""
echo "Test 9: Invalid Token Rejection"
INVALID_RESPONSE=$(curl -s "$BASE_URL/api/user/me" \
    -H "Authorization: Bearer invalid_token")

if echo "$INVALID_RESPONSE" | grep -qi "invalid\|unauthorized"; then
    test_case "Invalid Token Rejected" 0
else
    test_case "Invalid Token Rejected" 1
fi

# Summary
echo ""
echo "==============================="
echo "📊 TEST SUMMARY"
echo "==============================="
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
echo "✓ Server stopped"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "Test user: $EMAIL"
    echo "Database: prisma/dev.db"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy to Railway/Render: npm run deploy:staging"
    echo "  2. Connect frontend: Update VITE_COMMERCIAL_API_URL"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    echo "Check server.log for details"
    exit 1
fi
