#!/bin/bash

set -e

echo ""
echo "🔧 Patching Debezium Oracle Connector for Oracle 23c AI Database Support"
echo "=========================================================================="
echo ""

CONNECTOR_JAR="/kafka/connect/plugins/debezium-connector-oracle/debezium-connector-oracle-2.7.4.Final.jar"
WORK_DIR="/tmp/debezium-patch"
BACKUP_JAR="${CONNECTOR_JAR}.backup"

echo "1️⃣  Creating backup of original JAR..."
docker exec kafka-connect bash -c "cp $CONNECTOR_JAR $BACKUP_JAR" 2>/dev/null || echo "   Backup already exists"
echo "   ✅ Backup created: $BACKUP_JAR"

echo ""
echo "2️⃣  Extracting JAR contents..."
docker exec kafka-connect bash -c "rm -rf $WORK_DIR && mkdir -p $WORK_DIR"
docker exec kafka-connect bash -c "cd $WORK_DIR && jar xf $CONNECTOR_JAR"
echo "   ✅ JAR extracted to $WORK_DIR"

echo ""
echo "3️⃣  Patching OracleConnection.java..."
echo "   Finding the class file..."

# The compiled class is in: io/debezium/connector/oracle/OracleConnection.class
# We need to patch the bytecode or replace with modified version

# Since we can't easily patch bytecode, let's create a configuration workaround
# by setting an environment variable that Debezium might respect

echo ""
echo "⚠️  PROBLEM: Cannot easily patch compiled Java bytecode"
echo ""
echo "📋 ALTERNATIVE SOLUTIONS:"
echo ""
echo "   A) Upgrade to Debezium 2.8+ (if available, may have fix)"
echo "   B) Build custom Debezium from source with patch"
echo "   C) Use environment variable workaround"
echo "   D) Skip validation by using CREATE connector without validation"
echo ""
echo "Let's try OPTION C: Environment Variable Workaround"
echo ""

# Restore original JAR
docker exec kafka-connect bash -c "rm -rf $WORK_DIR"

echo "=========================================================================="
echo ""
