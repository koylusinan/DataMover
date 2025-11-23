#!/usr/bin/env node

/**
 * Test script for Oracle 23c AI Database version detection fix
 *
 * This script tests the workaround for Debezium 2.7.4's broken version detection
 * that fails with Oracle 23c's "Oracle AI Database" branding.
 */

const KAFKA_CONNECT_URL = 'http://127.0.0.1:8083';

// Minimal Oracle connector config for testing version detection
const testConnectorConfig = {
  "name": "test-oracle-23c-version",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "tasks.max": "1",

    // Database connection
    "database.hostname": process.env.ORACLE_HOST || "127.0.0.1",
    "database.port": process.env.ORACLE_PORT || "1521",
    "database.user": process.env.ORACLE_USER || "c##dbzuser",
    "database.password": process.env.ORACLE_PASSWORD || "dbz",
    "database.dbname": process.env.ORACLE_DBNAME || "FREEPDB1",
    "database.server.name": "oracle23c_test",

    // Oracle-specific settings
    "database.connection.adapter": "logminer",
    "database.pdb.name": process.env.ORACLE_PDB || "FREEPDB1",

    // Schema history
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "test-oracle-schema-history",

    // Include/exclude
    "table.include.list": ".*TEST_TABLE.*",
    "schema.include.list": "C##DBZUSER",

    // Snapshot settings
    "snapshot.mode": "initial",

    // Error handling
    "errors.tolerance": "all",
    "errors.deadletterqueue.topic.name": "test-oracle-dlq",
    "errors.deadletterqueue.topic.replication.factor": "1",
    "errors.deadletterqueue.context.headers.enable": "true",

    // THE FIX: This should be automatically added by the backend
    // "database.oracle.version": "23.0.0.0"
  }
};

async function testConnector() {
  console.log('\n🧪 Testing Oracle 23c AI Database Version Detection Fix\n');
  console.log('=' .repeat(60));

  try {
    // 1. Check Kafka Connect
    console.log('\n1️⃣  Checking Kafka Connect...');
    const healthCheck = await fetch(`${KAFKA_CONNECT_URL}/`);
    if (!healthCheck.ok) {
      throw new Error('Kafka Connect is not running');
    }
    console.log('   ✅ Kafka Connect is running');

    // 2. Delete existing test connector if exists
    console.log('\n2️⃣  Cleaning up existing test connector...');
    const deleteResponse = await fetch(
      `${KAFKA_CONNECT_URL}/connectors/${testConnectorConfig.name}`,
      { method: 'DELETE' }
    );
    if (deleteResponse.status === 204) {
      console.log('   ✅ Deleted existing connector');
    } else {
      console.log('   ℹ️  No existing connector to delete');
    }

    // Wait a bit for deletion
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Create connector
    console.log('\n3️⃣  Creating Oracle connector...');
    console.log(`   📝 Config: ${JSON.stringify(testConnectorConfig.config, null, 2).substring(0, 200)}...`);

    const createResponse = await fetch(`${KAFKA_CONNECT_URL}/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConnectorConfig)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('\n   ❌ Failed to create connector');
      console.error('   Error:', errorText);

      // Check if it's the version detection error
      if (errorText.includes('Failed to resolve Oracle database version')) {
        console.error('\n   🔍 ROOT CAUSE: Oracle 23c "AI Database" branding not recognized!');
        console.error('   💡 The fix (database.oracle.version=23.0.0.0) was NOT applied.');
        console.error('   🔧 Make sure the backend is using the updated code.');
      }

      throw new Error(`Connector creation failed: ${errorText}`);
    }

    const connector = await createResponse.json();
    console.log('   ✅ Connector created successfully');
    console.log(`   📦 Connector: ${connector.name}`);

    // 4. Check connector status
    console.log('\n4️⃣  Checking connector status...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await fetch(
      `${KAFKA_CONNECT_URL}/connectors/${testConnectorConfig.name}/status`
    );
    const status = await statusResponse.json();

    console.log(`   📊 State: ${status.connector.state}`);
    console.log(`   📊 Worker: ${status.connector.worker_id}`);

    if (status.tasks && status.tasks.length > 0) {
      console.log(`   📊 Task State: ${status.tasks[0].state}`);
      if (status.tasks[0].trace) {
        console.log(`   ⚠️  Task Error: ${status.tasks[0].trace.substring(0, 200)}...`);
      }
    }

    // 5. Get connector config to verify the fix
    console.log('\n5️⃣  Verifying the version fix was applied...');
    const configResponse = await fetch(
      `${KAFKA_CONNECT_URL}/connectors/${testConnectorConfig.name}/config`
    );
    const actualConfig = await configResponse.json();

    if (actualConfig['database.oracle.version']) {
      console.log(`   ✅ FIX APPLIED: database.oracle.version = ${actualConfig['database.oracle.version']}`);
      console.log('   🎉 The Oracle 23c AI Database workaround is working!');
    } else {
      console.log('   ⚠️  WARNING: database.oracle.version not found in config');
      console.log('   🔧 The backend fix may not be working correctly');
    }

    // 6. Clean up
    console.log('\n6️⃣  Cleaning up test connector...');
    await fetch(
      `${KAFKA_CONNECT_URL}/connectors/${testConnectorConfig.name}`,
      { method: 'DELETE' }
    );
    console.log('   ✅ Test connector deleted');

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY\n');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run test
testConnector();
