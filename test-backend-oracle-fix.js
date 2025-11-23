#!/usr/bin/env node

/**
 * Test the prepareConnectorConfig function to verify Oracle 23c fix
 */

// Simulate the prepareConnectorConfig function from backend
function prepareConnectorConfig(rawConfig, connectorName, pipelineName, type) {
    const flatConfig = {};

    // 1. FLATTENING
    for (const [key, value] of Object.entries(rawConfig || {})) {
        if (value === null || value === undefined) continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
            const nestedObj = value;
            for (const [nestedKey, nestedValue] of Object.entries(nestedObj)) {
                if (nestedValue !== null && nestedValue !== undefined) {
                    flatConfig[nestedKey] = nestedValue;
                }
            }
        }
        else if (typeof value === 'string' && value.trim().startsWith('{') && (key === 'snapshot_config' || key === 'config')) {
            try {
                const parsed = JSON.parse(value);
                for (const [nestedKey, nestedValue] of Object.entries(parsed)) {
                    if (nestedValue !== null && nestedValue !== undefined) {
                        flatConfig[nestedKey] = nestedValue;
                    }
                }
            } catch (e) {
                flatConfig[key] = value;
            }
        }
        else {
            flatConfig[key] = value;
        }
    }

    // 2. KEY NORMALIZATION
    if (flatConfig['connector_class'] && !flatConfig['connector.class']) {
        flatConfig['connector.class'] = flatConfig['connector_class'];
    }
    delete flatConfig['connector_class'];
    delete flatConfig['snapshot_config'];
    delete flatConfig['registry_connector'];
    delete flatConfig['registry_version'];
    delete flatConfig['checksum'];

    // Oracle special handling
    if (flatConfig['connector.class'] === 'io.debezium.connector.oracle.OracleConnector') {
        delete flatConfig['database.schema'];

        if (flatConfig['database.connection.adapter'] !== 'xstream') {
            delete flatConfig['database.out.server.name'];
        }

        if (flatConfig['schema.history.internal.kafka.bootstrap.servers'] === '127.0.0.1:9092') {
            flatConfig['schema.history.internal.kafka.bootstrap.servers'] = 'kafka:9092';
        }
        if (flatConfig['database.history.kafka.bootstrap.servers'] === '127.0.0.1:9092') {
            flatConfig['database.history.kafka.bootstrap.servers'] = 'kafka:9092';
        }

        // WORKAROUND: Oracle 23c "Oracle AI Database" version detection fix
        if (!flatConfig['database.oracle.version']) {
            flatConfig['database.oracle.version'] = '23.0.0.0';
            console.log('✅ [ORACLE 23c FIX] Setting database.oracle.version=23.0.0.0 to bypass AI Database branding issue');
        }
    }

    // 3. MANDATORY OVERRIDES
    flatConfig['name'] = connectorName;
    flatConfig['errors.tolerance'] = 'all';
    flatConfig['errors.deadletterqueue.topic.name'] = `${pipelineName}-${type}-dlq`;
    flatConfig['errors.deadletterqueue.topic.replication.factor'] = '1';
    flatConfig['errors.deadletterqueue.context.headers.enable'] = 'true';

    // 4. STRING SANITIZATION
    const finalStringConfig = {};
    for (const [key, value] of Object.entries(flatConfig)) {
        finalStringConfig[key] = String(value);
    }

    return finalStringConfig;
}

// Test case: Oracle connector config without database.oracle.version
const testOracleConfig = {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "tasks.max": "1",
    "database.hostname": "127.0.0.1",
    "database.port": "1521",
    "database.user": "c##dbzuser",
    "database.password": "dbz",
    "database.dbname": "FREEPDB1",
    "database.server.name": "oracle23c",
    "database.connection.adapter": "logminer",
    "database.pdb.name": "FREEPDB1",
    "schema.history.internal.kafka.bootstrap.servers": "127.0.0.1:9092",
    "schema.history.internal.kafka.topic": "oracle-schema-history",
    "table.include.list": ".*",
    "snapshot.mode": "initial"
};

console.log('\n🧪 Testing Oracle 23c Backend Fix\n');
console.log('=' .repeat(70));
console.log('\n📥 INPUT CONFIG (without database.oracle.version):');
console.log(JSON.stringify(testOracleConfig, null, 2));

const result = prepareConnectorConfig(
    testOracleConfig,
    'test-oracle-source',
    'test-pipeline',
    'source'
);

console.log('\n📤 OUTPUT CONFIG (after prepareConnectorConfig):');
console.log(JSON.stringify(result, null, 2));

console.log('\n🔍 VERIFICATION:');
if (result['database.oracle.version']) {
    console.log(`✅ SUCCESS: database.oracle.version = "${result['database.oracle.version']}"`);
    console.log('✅ The Oracle 23c AI Database workaround is working correctly!');
    console.log('\n💡 This will bypass Debezium\'s broken version detection query');
    console.log('   that fails with "Oracle AI Database" branding.');
} else {
    console.log('❌ FAILED: database.oracle.version not found!');
    console.log('❌ The fix is not working.');
}

console.log('\n' + '='.repeat(70) + '\n');
