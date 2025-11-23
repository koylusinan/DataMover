#!/bin/bash

# Script to simulate a connector failure for testing proactive monitoring
# This pauses a connector to trigger a PAUSED state (you can also manually stop Kafka Connect)

set -e

KAFKA_CONNECT_URL=${KAFKA_CONNECT_URL:-http://localhost:8083}
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Connector Failure Simulation ===${NC}"
echo ""

# Get list of connectors
echo -e "${YELLOW}Available connectors:${NC}"
connectors=$(curl -s "$KAFKA_CONNECT_URL/connectors")
echo "$connectors" | jq -r '.[]' | nl

if [ "$(echo "$connectors" | jq -r 'length')" = "0" ]; then
    echo -e "${RED}No connectors found!${NC}"
    echo "Please create a pipeline first."
    exit 1
fi

echo ""
echo -e "${YELLOW}Enter connector name to pause (this will simulate a failure):${NC}"
read -r connector_name

if [ -z "$connector_name" ]; then
    echo -e "${RED}No connector name provided${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 1: Checking current status...${NC}"
status=$(curl -s "$KAFKA_CONNECT_URL/connectors/$connector_name/status")
current_state=$(echo "$status" | jq -r '.connector.state')
echo "Current state: $current_state"

if [ "$current_state" = "PAUSED" ]; then
    echo -e "${YELLOW}Connector is already PAUSED${NC}"
    echo ""
    echo -e "${YELLOW}Do you want to resume it instead? (y/n)${NC}"
    read -r resume

    if [ "$resume" = "y" ]; then
        echo ""
        echo -e "${YELLOW}Step 2: Resuming connector...${NC}"
        curl -s -X PUT "$KAFKA_CONNECT_URL/connectors/$connector_name/resume"
        echo -e "${GREEN}✓ Connector resumed${NC}"

        echo ""
        echo "Wait ~60 seconds for monitoring service to detect the change"
        echo "The CONNECTOR_FAILED alert should be auto-resolved"
    fi
    exit 0
fi

echo ""
echo -e "${YELLOW}Step 2: Pausing connector to simulate failure...${NC}"
curl -s -X PUT "$KAFKA_CONNECT_URL/connectors/$connector_name/pause"
echo -e "${GREEN}✓ Connector paused${NC}"

echo ""
echo -e "${YELLOW}Step 3: Verifying pause...${NC}"
sleep 2
status=$(curl -s "$KAFKA_CONNECT_URL/connectors/$connector_name/status")
new_state=$(echo "$status" | jq -r '.connector.state')
echo "New state: $new_state"

if [ "$new_state" = "PAUSED" ]; then
    echo -e "${GREEN}✓ Successfully paused${NC}"
else
    echo -e "${RED}✗ Failed to pause, current state: $new_state${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Simulation Complete ===${NC}"
echo ""
echo "What happens next:"
echo "1. Wait ~60 seconds for the monitoring service to check pipelines"
echo "2. Backend will detect connector is PAUSED/FAILED"
echo "3. An alert will be created in alert_events table"
echo "4. UI will show:"
echo "   - Blinking red bell in sidebar"
echo "   - Blinking red bell on pipeline card"
echo "   - Alert indicator in pipeline detail page"
echo "5. Open Pipeline Detail > Logs > Alerts to see the alert"
echo ""
echo "To resume the connector and clear the alert:"
echo "  curl -X PUT $KAFKA_CONNECT_URL/connectors/$connector_name/resume"
echo ""
echo "Or run this script again and choose to resume."
echo ""
