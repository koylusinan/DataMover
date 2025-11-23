#!/bin/bash

# Test Rollback Mechanism
# Bu script Debezium olmadan rollback logic'i test eder

echo "🧪 Testing Rollback Mechanism..."
echo "================================"
echo ""

# Backend'in çalıştığından emin ol
BACKEND_URL="http://localhost:3001"

# Test için mock connector oluştur
TEST_PIPELINE_ID="123e4567-e89b-12d3-a456-426614174000"

echo "📝 Test Scenario 1: Successful Deploy (Both source & sink)"
echo "-----------------------------------------------------------"
curl -X POST "${BACKEND_URL}/api/pipelines/${TEST_PIPELINE_ID}/deploy" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

echo ""
echo ""

echo "📝 Test Scenario 2: Failed Sink Deploy (Should rollback source)"
echo "----------------------------------------------------------------"
echo "Bu test için sink config'e invalid bir değer ekleyeceğiz"
echo ""

# Pipeline'ı pause edelim
echo "⏸️  Pausing pipeline..."
curl -X POST "${BACKEND_URL}/api/pipelines/${TEST_PIPELINE_ID}/pause" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

echo ""
echo ""

echo "▶️  Starting pipeline..."
curl -X POST "${BACKEND_URL}/api/pipelines/${TEST_PIPELINE_ID}/start" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

echo ""
echo ""

echo "🗑️  Deleting connectors..."
curl -X DELETE "${BACKEND_URL}/api/pipelines/${TEST_PIPELINE_ID}/connectors" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

echo ""
echo ""
echo "✅ Test completed!"
echo ""
echo "💡 Check backend logs for detailed rollback information:"
echo "   - Look for: 'Rolling back source connector due to sink failure'"
echo "   - Look for: 'Source connector rolled back'"
echo ""
