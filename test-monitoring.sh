#!/bin/bash

# Test script for proactive monitoring system
# This script helps you test the monitoring service step by step

set -e

BACKEND_URL=${BACKEND_URL:-http://localhost:5002}
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Proactive Monitoring System Test ===${NC}"
echo ""

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "GET $BACKEND_URL$endpoint"

    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BACKEND_URL$endpoint")
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')

    if [ "$http_status" = "200" ]; then
        echo -e "${GREEN}✓ Success (HTTP $http_status)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Failed (HTTP $http_status)${NC}"
        echo "$body"
    fi
    echo ""
}

# Test 1: Check if backend is running
echo -e "${YELLOW}Step 1: Checking if backend is running...${NC}"
if curl -s -f "$BACKEND_URL/api/alerts/stats" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running!${NC}"
else
    echo -e "${RED}✗ Backend is not running or alerts API not available${NC}"
    echo "Please start the backend first:"
    echo "  cd backend && node debezium-backend.js"
    exit 1
fi
echo ""

# Test 2: Get alert statistics
test_endpoint "/api/alerts/stats" "Global Alert Statistics"

# Test 3: Get all unresolved alerts
test_endpoint "/api/alerts" "All Unresolved Alerts"

# Test 4: Check monitoring service logs
echo -e "${YELLOW}Step 4: Checking monitoring service logs${NC}"
echo "Look for these messages in your backend console:"
echo "  - '🔍 Starting proactive monitoring service...'"
echo "  - '✅ Monitoring service started (60s interval)'"
echo "  - '🔍 Checking N pipelines...'"
echo ""
echo "If you see these logs, the monitoring service is running!"
echo ""

# Test 5: Create a test alert manually
echo -e "${YELLOW}Step 5: Create test alerts${NC}"
echo "Run this SQL to create test alerts:"
echo ""
echo -e "${GREEN}psql your_database < test-alerts.sql${NC}"
echo ""
echo "Or connect to Supabase and run the test-alerts.sql script"
echo ""

# Test 6: Instructions for testing UI
echo -e "${YELLOW}Step 6: Test the UI${NC}"
echo "After creating test alerts, you should see:"
echo ""
echo "1. ${GREEN}Sidebar:${NC}"
echo "   - Blinking BellRing icon with red badge"
echo "   - Number shows total unresolved alerts"
echo ""
echo "2. ${GREEN}Pipeline List (Grid/List View):${NC}"
echo "   - Each pipeline with alerts shows blinking BellRing"
echo "   - Red badge with alert count"
echo "   - Click to go to Logs > Alerts tab"
echo ""
echo "3. ${GREEN}Pipeline Detail Page:${NC}"
echo "   - Status bar shows 'X Alerts' button (red background)"
echo "   - Click to open Logs > Alerts tab"
echo "   - Alerts tab shows all alerts with details"
echo "   - Click 'Resolve' to mark as resolved"
echo ""

# Test 7: Test alert resolution
echo -e "${YELLOW}Step 7: Test Alert Resolution${NC}"
echo "Get an alert ID and resolve it:"
echo ""
echo "# Get alert IDs"
echo "curl $BACKEND_URL/api/alerts | jq '.alerts[] | {id, message}'"
echo ""
echo "# Resolve an alert"
echo "curl -X POST $BACKEND_URL/api/alerts/ALERT_ID/resolve"
echo ""
echo "# Verify it's resolved"
echo "curl $BACKEND_URL/api/alerts/stats"
echo ""

# Test 8: Monitor in real-time
echo -e "${YELLOW}Step 8: Monitor in Real-Time${NC}"
echo "Watch backend logs to see monitoring service in action:"
echo ""
echo "The service checks pipelines every 60 seconds."
echo "You'll see log messages like:"
echo "  🔍 Checking 3 pipelines..."
echo "  🚨 ALERT: CRITICAL - Source connector is FAILED"
echo "  ✅ Resolved 1 CONNECTOR_FAILED alert(s) for pipeline xyz"
echo ""

echo -e "${GREEN}=== Test Instructions Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Make sure backend is running"
echo "2. Run test-alerts.sql to create mock alerts"
echo "3. Open the UI and check all the alert indicators"
echo "4. Test resolving alerts from the UI"
echo "5. Watch backend logs to see monitoring service working"
echo ""
