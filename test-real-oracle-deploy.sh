#!/bin/bash

set -e

echo ""
echo "🧪 Testing Oracle 23c AI Database Connector Deployment"
echo "======================================================================"
echo ""

CONNECTOR_NAME="test-oracle-23c-fix"
KAFKA_CONNECT_URL="http://localhost:8083"

# Clean up existing connector
echo "1️⃣  Cleaning up existing test connector..."
curl -s -X DELETE "$KAFKA_CONNECT_URL/connectors/$CONNECTOR_NAME" > /dev/null 2>&1 || true
sleep 2
echo "   ✅ Cleanup done"

# Create connector config
echo ""
echo "2️⃣  Creating Oracle connector WITHOUT database.oracle.version..."
echo "   📝 This should trigger the backend fix to auto-add version=23.0.0.0"
echo ""

CONNECTOR_CONFIG='{
  "name": "'"$CONNECTOR_NAME"'",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "tasks.max": "1",
    "database.hostname": "oracle-xe",
    "database.port": "1521",
    "database.user": "c##dbzuser",
    "database.password": "dbz",
    "database.dbname": "FREEPDB1",
    "database.server.name": "oracle23c_test",
    "database.connection.adapter": "logminer",
    "database.pdb.name": "FREEPDB1",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:29092",
    "schema.history.internal.kafka.topic": "test-oracle-schema-history-fix",
    "table.include.list": "C##DBZUSER\\..*",
    "snapshot.mode": "initial",
    "errors.tolerance": "all",
    "errors.deadletterqueue.topic.name": "test-oracle-dlq",
    "errors.deadletterqueue.topic.replication.factor": "1",
    "errors.deadletterqueue.context.headers.enable": "true"
  }
}'

echo "   Sending connector config to Kafka Connect..."
RESPONSE=$(curl -s -X POST "$KAFKA_CONNECT_URL/connectors" \
  -H "Content-Type: application/json" \
  -d "$CONNECTOR_CONFIG")

if echo "$RESPONSE" | grep -q "error_code"; then
  echo ""
  echo "   ❌ FAILED to create connector"
  echo "$RESPONSE" | jq .

  if echo "$RESPONSE" | grep -q "Failed to resolve Oracle database version"; then
    echo ""
    echo "   🔍 ERROR: The version detection still failed!"
    echo "   💡 This means the banner 'Oracle AI Database' was not recognized."
    echo "   🔧 The fix needs to be applied through the backend (port 5002), not directly to Kafka Connect."
    echo ""
    echo "   NOTE: We're testing direct Kafka Connect deployment."
    echo "         The fix only works when deploying through the backend API (/api/pipelines/:id/deploy)"
  fi

  exit 1
else
  echo "   ✅ Connector created successfully!"
fi

echo ""
echo "3️⃣  Waiting for connector to initialize..."
sleep 5

echo ""
echo "4️⃣  Checking connector status..."
STATUS=$(curl -s "$KAFKA_CONNECT_URL/connectors/$CONNECTOR_NAME/status")
echo "$STATUS" | jq '{name, state: .connector.state, worker: .connector.worker_id, task_state: .tasks[0].state}'

if echo "$STATUS" | grep -q '"state":"RUNNING"'; then
  echo ""
  echo "   ✅ Connector is RUNNING!"
else
  echo ""
  echo "   ⚠️  Connector is not running. Checking for errors..."
  if echo "$STATUS" | jq -e '.tasks[0].trace' > /dev/null 2>&1; then
    echo ""
    echo "   Task error trace:"
    echo "$STATUS" | jq -r '.tasks[0].trace' | head -20
  fi
fi

echo ""
echo "5️⃣  Retrieving actual connector config to verify fix..."
CONFIG=$(curl -s "$KAFKA_CONNECT_URL/connectors/$CONNECTOR_NAME/config")

if echo "$CONFIG" | jq -e '.["database.oracle.version"]' > /dev/null 2>&1; then
  VERSION=$(echo "$CONFIG" | jq -r '.["database.oracle.version"]')
  echo ""
  echo "   ✅ FIX VERIFIED: database.oracle.version = $VERSION"
  echo "   🎉 The Oracle 23c AI Database workaround is working!"
else
  echo ""
  echo "   ⚠️  database.oracle.version not found in config"
  echo "   💡 The fix was NOT applied (expected when testing direct Kafka Connect)"
fi

echo ""
echo "6️⃣  Cleaning up..."
curl -s -X DELETE "$KAFKA_CONNECT_URL/connectors/$CONNECTOR_NAME" > /dev/null 2>&1
echo "   ✅ Test connector deleted"

echo ""
echo "======================================================================"
echo ""
echo "📋 SUMMARY:"
echo ""
echo "   This test deploys directly to Kafka Connect (bypassing the backend)."
echo "   The fix is in the backend's prepareConnectorConfig() function."
echo ""
echo "   To test the fix properly, you need to:"
echo "   1. Create a pipeline in the UI"
echo "   2. Deploy it through the backend API (port 5002)"
echo "   3. The backend will automatically add database.oracle.version=23.0.0.0"
echo ""
echo "   OR manually add this to the connector config:"
echo '   "database.oracle.version": "23.0.0.0"'
echo ""
echo "======================================================================"
echo ""
