#!/bin/bash

# =====================================================
# Local Development Stop Script
# =====================================================

set -e

echo "🛑 Stopping Local Development Environment..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Stop frontend
if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    echo -e "${BLUE}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    rm frontend.pid
    echo -e "${GREEN}✅ Frontend stopped${NC}"
fi

# Stop backend
if [ -f debezium-backend.pid ]; then
    BACKEND_PID=$(cat debezium-backend.pid)
    echo -e "${BLUE}Stopping backend (PID: $BACKEND_PID)...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    rm debezium-backend.pid
    echo -e "${GREEN}✅ Backend stopped${NC}"
fi

# Stop Docker services
echo ""
echo -e "${BLUE}🐳 Stopping Docker services...${NC}"
docker-compose -f docker-compose.local.yml stop

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""

# Ask if user wants to remove volumes
read -p "Do you want to remove volumes (DELETE ALL DATA)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}🗑️  Removing volumes and orphan containers...${NC}"
    docker-compose -f docker-compose.local.yml down -v --remove-orphans
    echo -e "${GREEN}✅ Volumes removed${NC}"
else
    echo -e "${BLUE}🧹 Removing containers and orphans (volumes preserved)...${NC}"
    docker-compose -f docker-compose.local.yml down --remove-orphans
    echo -e "${GREEN}✅ Containers removed (volumes preserved)${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Cleanup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
