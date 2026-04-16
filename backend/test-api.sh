#!/bin/bash
# KaraokeYT Backend API Test Script
# Usage: ./test-api.sh

set -e

BASE_URL="http://localhost:3001"
EMAIL="test$(date +%s)@example.com"
PASSWORD="testpassword123"

echo "=========================================="
echo "KaraokeYT Backend API Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if server is running
check_server() {
  echo "1. Checking server..."
  if curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}"
    return 0
  else
    echo -e "${RED}✗ Server is not running${NC}"
    echo "Start server with: npm run dev"
    exit 1
  fi
}

# Test health endpoint
test_health() {
  echo ""
  echo "2. Testing /health..."
  RESPONSE=$(curl -s "$BASE_URL/health")
  echo "Response: $RESPONSE"
  if echo "$RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
  else
    echo -e "${RED}✗ Health check failed${NC}"
  fi
}

# Test register
test_register() {
  echo ""
  echo "3. Testing /api/auth/register..."
  echo "Email: $EMAIL"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\n      \"email\": \"$EMAIL\",\n      \"password\": \"$PASSWORD\",\n      \"name\": \"Test User\"\n    }")
  
  echo "Response: $RESPONSE"
  
  # Extract tokens
  ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  API_KEY=$(echo "$RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
  
  if [ ! -z "$ACCESS_TOKEN" ]; then
    echo -e "${GREEN}✓ Register successful${NC}"
    echo "Access Token: ${ACCESS_TOKEN:0:20}..."
    echo "API Key: ${API_KEY:0:20}..."
    export ACCESS_TOKEN
    export API_KEY
  else
    echo -e "${RED}✗ Register failed${NC}"
    exit 1
  fi
}

# Test login
test_login() {
  echo ""
  echo "4. Testing /api/auth/login..."
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\n      \"email\": \"$EMAIL\",\n      \"password\": \"$PASSWORD\"\n    }")
  
  echo "Response: $RESPONSE"
  
  if echo "$RESPONSE" | grep -q "accessToken"; then
    echo -e "${GREEN}✓ Login successful${NC}"
  else
    echo -e "${RED}✗ Login failed${NC}"
  fi
}

# Test get user
test_get_user() {
  echo ""
  echo "5. Testing /api/user/me..."
  
  RESPONSE=$(curl -s "$BASE_URL/api/user/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  echo "Response: $RESPONSE"
  
  if echo "$RESPONSE" | grep -q "$EMAIL"; then
    echo -e "${GREEN}✓ Get user successful${NC}"
  else
    echo -e "${RED}✗ Get user failed${NC}"
  fi
}

# Test API key status
test_api_key_status() {
  echo ""
  echo "6. Testing /api/api-key/status..."
  
  RESPONSE=$(curl -s "$BASE_URL/api/api-key/status" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  echo "Response: $RESPONSE"
  
  if echo "$RESPONSE" | grep -q "quota"; then
    echo -e "${GREEN}✓ API key status retrieved${NC}"
  else
    echo -e "${RED}✗ API key status failed${NC}"
  fi
}

# Test subscription plans
test_plans() {
  echo ""
  echo "7. Testing /api/subscription/plans..."
  
  RESPONSE=$(curl -s "$BASE_URL/api/subscription/plans")
  
  echo "Response: $RESPONSE"
  
  if echo "$RESPONSE" | grep -q "premium"; then
    echo -e "${GREEN}✓ Plans retrieved${NC}"
  else
    echo -e "${RED}✗ Plans failed${NC}"
  fi
}

# Test logout
test_logout() {
  echo ""
  echo "8. Testing /api/auth/logout..."
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  echo "Response: $RESPONSE"
  
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Logout successful${NC}"
  else
    echo -e "${RED}✗ Logout failed${NC}"
  fi
}

# Test invalid token
test_invalid_token() {
  echo ""
  echo "9. Testing invalid token..."
  
  RESPONSE=$(curl -s "$BASE_URL/api/user/me" \
    -H "Authorization: Bearer invalid_token")
  
  echo "Response: $RESPONSE"
  
  if echo "$RESPONSE" | grep -q "Invalid"; then
    echo -e "${GREEN}✓ Invalid token rejected${NC}"
  else
    echo -e "${RED}✗ Should have rejected invalid token${NC}"
  fi
}

# Run all tests
main() {
  check_server
  test_health
  test_register
  test_login
  test_get_user
  test_api_key_status
  test_plans
  test_logout
  test_invalid_token
  
  echo ""
  echo "=========================================="
  echo -e "${GREEN}All tests completed!${NC}"
  echo "=========================================="
  echo ""
  echo "Test user: $EMAIL"
  echo "API Key: ${API_KEY:0:30}..."
}

main
