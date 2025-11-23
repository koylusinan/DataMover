#!/bin/bash

# =====================================================
# Download JMX Prometheus Java Agent
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📥 JMX Prometheus Java Agent Setup${NC}"
echo ""

JAR_FILE="jmx_prometheus_javaagent-0.17.2.jar"
JAR_URL="https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/0.17.2/$JAR_FILE"

# Check if already exists
if [ -f "$JAR_FILE" ]; then
    SIZE=$(ls -lh "$JAR_FILE" | awk '{print $5}')
    echo -e "${GREEN}✅ $JAR_FILE already exists ($SIZE)${NC}"
    echo ""
    read -p "Do you want to re-download? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✅ Using existing JAR file${NC}"
        echo ""
        echo -e "${BLUE}Files in current directory:${NC}"
        ls -lh
        exit 0
    fi
    echo ""
    echo -e "${YELLOW}Removing old version...${NC}"
    rm "$JAR_FILE"
fi

# Download JAR file
echo -e "${BLUE}Downloading from: $JAR_URL${NC}"
curl -Lo "$JAR_FILE" "$JAR_URL"

# Verify download
if [ -f "$JAR_FILE" ]; then
    SIZE=$(ls -lh "$JAR_FILE" | awk '{print $5}')
    echo ""
    echo -e "${GREEN}✅ Successfully downloaded $JAR_FILE ($SIZE)${NC}"
    echo ""
    echo -e "${BLUE}Files in current directory:${NC}"
    ls -lh
    echo ""
else
    echo -e "${RED}❌ Failed to download $JAR_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ JMX Agent is ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
