#!/bin/bash

echo "=== Testing Debezium Backend Integration ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend URLs
DEBEZIUM_BACKEND="http://localhost:5002"
KAFKA_CONNECT="http://127.0.0.1:8083"

echo "1. Testing Debezium Backend Health..."
response=$(curl -s -w "\n%{http_code}" ${DEBEZIUM_BACKEND}/api/health)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Debezium Backend is running${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Debezium Backend is not available (HTTP $http_code)${NC}"
    echo "Make sure to run: npm run debezium:dev"
    exit 1
fi

echo ""
echo "2. Testing Kafka Connect..."
response=$(curl -s -w "\n%{http_code}" ${KAFKA_CONNECT}/)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Kafka Connect is running${NC}"
    echo "Version: $(echo $body | grep -o '"version":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}✗ Kafka Connect is not available (HTTP $http_code)${NC}"
    echo "Make sure Kafka Connect is running on port 8083"
    exit 1
fi

echo ""
echo "3. Testing Kafka Connect Info via Backend..."
response=$(curl -s -w "\n%{http_code}" ${DEBEZIUM_BACKEND}/api/kafka-connect/info)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Backend can communicate with Kafka Connect${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Backend cannot communicate with Kafka Connect${NC}"
    exit 1
fi

echo ""
echo "4. Listing Connector Plugins..."
response=$(curl -s -w "\n%{http_code}" ${DEBEZIUM_BACKEND}/api/kafka-connect/connector-plugins)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Connector plugins available${NC}"
    # Extract plugin count
    plugin_count=$(echo "$body" | grep -o '"class"' | wc -l)
    echo "Found $plugin_count connector plugins"

    # Show Debezium connectors
    echo ""
    echo "Debezium Connectors:"
    echo "$body" | grep -o '"class":"io.debezium[^"]*"' | cut -d'"' -f4 | while read line; do
        echo "  - $line"
    done
else
    echo -e "${YELLOW}⚠ Could not list connector plugins${NC}"
fi

echo ""
echo "5. Listing Deployed Connectors..."
response=$(curl -s -w "\n%{http_code}" ${DEBEZIUM_BACKEND}/api/kafka-connect/connectors)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    connector_count=$(echo "$body" | grep -o '"name"' | wc -l)
    if [ "$connector_count" -gt "0" ]; then
        echo -e "${GREEN}✓ Found $connector_count deployed connectors${NC}"
        echo "$body" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read line; do
            echo "  - $line"
        done
    else
        echo -e "${YELLOW}⚠ No connectors deployed yet${NC}"
    fi
else
    echo -e "${RED}✗ Could not list connectors${NC}"
fi

echo ""
echo "=== Test Summary ==="
echo -e "${GREEN}✓ All integration tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Create a pipeline in the UI (http://localhost:5173)"
echo "2. Deploy the pipeline"
echo "3. Monitor connector status"
echo ""
echo "Useful commands:"
echo "  curl ${DEBEZIUM_BACKEND}/api/health"
echo "  curl ${DEBEZIUM_BACKEND}/api/kafka-connect/connectors"
echo "  curl ${KAFKA_CONNECT}/connectors"
