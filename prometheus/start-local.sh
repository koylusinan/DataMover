#!/bin/bash

# =====================================================
# Local Development Startup Script
# =====================================================

set -e

echo "🚀 Starting Local Development Environment..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    cp .env.local.example .env
    echo -e "${GREEN}✅ Created .env file. Please update with your values.${NC}"
    echo ""
fi

# Remove orphan containers (old Zookeeper)
echo -e "${YELLOW}🧹 Cleaning up orphan containers...${NC}"
docker-compose -f docker-compose.local.yml down --remove-orphans 2>/dev/null || true

# Start Kafka stack
echo -e "${BLUE}🐳 Starting Kafka stack with Docker Compose...${NC}"
docker-compose -f docker-compose.local.yml up -d --remove-orphans

echo ""
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"

# Wait for Kafka (KRaft mode - no Zookeeper!)
echo -n "Waiting for Kafka (KRaft mode)..."
max_attempts=60
attempt=0
until docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 2>/dev/null | grep -q "ApiVersion"; do
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo -e " ${RED}❌ Timeout${NC}"
        echo -e "${RED}Kafka failed to start. Check logs with: docker logs kafka${NC}"
        exit 1
    fi
done
echo -e " ${GREEN}✅${NC}"

# Wait for Kafka Connect
echo -n "Waiting for Kafka Connect..."
until curl -s http://localhost:8083/ > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"

echo ""
echo -e "${GREEN}✅ All services are ready!${NC}"
echo ""

# Display service URLs
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Local Development Environment is Running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📊 Service URLs:${NC}"
echo ""
echo -e "  🌐 Kafka UI:         ${BLUE}http://localhost:8081${NC}"
echo -e "  🔌 Kafka Connect:    ${BLUE}http://localhost:8083${NC}"
echo -e "  📈 Prometheus:       ${BLUE}http://localhost:9090${NC}"
echo ""
echo -e "${YELLOW}📝 Kafka Connection:${NC}"
echo ""
echo -e "  Bootstrap Server:    ${BLUE}localhost:9092${NC}"
echo -e "  No authentication required!"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Start Backend (optional)
read -p "Do you want to start the backend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Starting backend...${NC}"
    cd .. && npm run debezium:dev &
    BACKEND_PID=$!
    echo $BACKEND_PID > prometheus/debezium-backend.pid
    echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    echo -e "  Backend URL: ${BLUE}http://localhost:5002${NC}"
    cd prometheus
    echo ""
fi

# Start Frontend (optional)
read -p "Do you want to start the frontend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Starting frontend...${NC}"
    cd .. && npm run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > prometheus/frontend.pid
    echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    echo -e "  Frontend URL: ${BLUE}http://localhost:5173${NC}"
    cd prometheus
    echo ""
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Setup complete! Happy coding! ✨${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo ""
echo -e "  View logs:           ${BLUE}docker-compose -f docker-compose.local.yml logs -f${NC}"
echo -e "  Stop services:       ${BLUE}./stop-local.sh${NC}"
echo -e "  Restart services:    ${BLUE}docker-compose -f docker-compose.local.yml restart${NC}"
echo ""
