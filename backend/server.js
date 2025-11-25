import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import Ajv from 'ajv';
import pg from 'pg';
import { getCached, setCached, initRedis } from './redis-cache.js';
// import { applyDeployment as applyDeploymentJob } from './services/connectDeployer.js'; 

const PORT = Number(process.env.BACKEND_PORT || process.env.PORT || 5001);
const HOST = process.env.BACKEND_HOST || '0.0.0.0';
const ALLOWED_ORIGINS = process.env.BACKEND_ALLOWED_ORIGINS;
const { Client: PgClient, Pool: PgPool } = pg;

const registryPool = new PgPool({
  host: process.env.SUPABASE_DB_HOST || '127.0.0.1',
  port: Number(process.env.SUPABASE_DB_PORT || 54322),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'postgres',
  ssl: process.env.SUPABASE_DB_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

const SCHEMA_BASE_DIR = path.resolve(process.cwd(), 'schemas');
const SCHEMA_MAP = {
  'io.debezium.connector.oracle.OracleConnector': 'debezium-oracle-source.schema.json',
  'io.debezium.connector.postgresql.PostgresConnector': 'debezium-postgres-source.schema.json',
  'io.debezium.connector.sqlserver.SqlServerConnector': 'debezium-sqlserver-source.schema.json',
  'io.debezium.connector.jdbc.JdbcSinkConnector': 'jdbc-sink-postgres.schema.json',
};
const ajv = new Ajv({ allErrors: true, strict: false });
const validatorCache = new Map();

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()) : true,
});

// [DEBUG] Yardımcı Fonksiyon: Şifreyi gizleyerek objeyi logla
function maskSensitiveData(obj) {
  if (!obj) return obj;
  const masked = { ...obj };
  const sensitiveKeys = ['password', 'pass', 'secret', 'key'];
  
  Object.keys(masked).forEach(key => {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      masked[key] = '*****';
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
       masked[key] = maskSensitiveData(masked[key]);
    }
  });
  return masked;
}

server.get('/api/health', async () => ({ status: 'ok' }));

// Initialize Redis for monitoring panel preferences
await initRedis();

// Monitoring Panel Preferences API
// GET: Retrieve user's panel preferences for a pipeline
server.get('/api/monitoring-panels/:pipelineId', async (request, reply) => {
  const { pipelineId } = request.params;
  const userId = request.query.userId || 'default';

  try {
    const key = `user-prefs:monitoring-panels:${userId}:${pipelineId}`;
    const panels = await getCached(key);

    return reply.send({
      success: true,
      panels: panels || { panels: [] }
    });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to get monitoring panels');
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get monitoring panels'
    });
  }
});

// POST: Save user's panel preferences for a pipeline
server.post('/api/monitoring-panels/:pipelineId', async (request, reply) => {
  const { pipelineId } = request.params;
  const { userId = 'default', panels = [] } = request.body || {};

  try {
    const key = `user-prefs:monitoring-panels:${userId}:${pipelineId}`;
    const config = {
      panels,
      timestamp: new Date().toISOString()
    };

    // Store for 30 days (30 * 24 * 60 * 60 seconds)
    await setCached(key, config, 30 * 24 * 60 * 60);

    return reply.send({
      success: true,
      message: 'Panel preferences saved'
    });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to save monitoring panels');
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to save monitoring panels'
    });
  }
});

// Monitoring Layout Preferences API
// GET: Retrieve user's layout preferences for a pipeline
server.get('/api/monitoring-layout/:pipelineId', async (request, reply) => {
  const { pipelineId } = request.params;
  const userId = request.query.userId || 'default';

  try {
    const key = `user-prefs:monitoring-layout:${userId}:${pipelineId}`;
    const layout = await getCached(key);

    if (!layout) {
      return reply.send({
        success: true,
        layout: null,
        message: 'No layout preferences found'
      });
    }

    return reply.send({
      success: true,
      layout
    });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to load monitoring layout');
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to load monitoring layout'
    });
  }
});

// POST: Save user's layout preferences for a pipeline
server.post('/api/monitoring-layout/:pipelineId', async (request, reply) => {
  const { pipelineId } = request.params;
  const { userId = 'default', layout = [] } = request.body || {};

  try {
    const key = `user-prefs:monitoring-layout:${userId}:${pipelineId}`;
    const config = {
      layout,
      timestamp: new Date().toISOString()
    };

    // Store for 30 days (30 * 24 * 60 * 60 seconds)
    await setCached(key, config, 30 * 24 * 60 * 60);

    return reply.send({
      success: true,
      message: 'Layout preferences saved'
    });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to save monitoring layout');
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to save monitoring layout'
    });
  }
});

// GET /api/pipelines/:pipelineId/wal-size - Get WAL size and replication slot info
server.get('/api/pipelines/:pipelineId/wal-size', async (request, reply) => {
  const { pipelineId } = request.params;

  try {
    // Get pipeline info from database
    const pipelineResult = await registryPool.query(
      `SELECT id, name, source_type, source_config, enable_log_monitoring,
              max_wal_size, alert_threshold
       FROM pipelines
       WHERE id = $1`,
      [pipelineId]
    );

    if (pipelineResult.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Pipeline not found'
      });
    }

    const pipeline = pipelineResult.rows[0];

    // Only support PostgreSQL sources
    if (pipeline.source_type !== 'postgres') {
      return reply.send({
        success: true,
        data: null,
        message: 'WAL monitoring only available for PostgreSQL sources'
      });
    }

    const sourceConfig = pipeline.source_config;

    // Get connector config to find slot name and password
    const connectorResult = await registryPool.query(
      `SELECT config FROM pipeline_connectors
       WHERE pipeline_id = $1 AND type = 'source'`,
      [pipelineId]
    );

    if (connectorResult.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Source connector not found'
      });
    }

    const connectorConfig = connectorResult.rows[0].config;

    // Get slot name
    const slotName = connectorConfig['slot.name'] ||
                     `${pipeline.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_slot`;

    // Get password from connector config
    const password = connectorConfig['database.password'] || '';

    // Get connection details - prefer connector config, fallback to source_config
    let host = connectorConfig['database.hostname'] || sourceConfig.host;
    const port = parseInt(connectorConfig['database.port']) || sourceConfig.port || 5432;
    const database = connectorConfig['database.dbname'] || sourceConfig.database_name;
    const username = connectorConfig['database.user'] || sourceConfig.username;
    const useSSL = connectorConfig['use_ssl'] === 'true' || sourceConfig.ssl;

    // If host is a Docker service name (pg-debezium), use localhost for external access
    if (host === 'pg-debezium' || host === 'postgres' || host.includes('docker')) {
      host = '127.0.0.1';
    }

    // Connect to source PostgreSQL
    const sourcePool = new PgPool({
      host: host,
      port: port,
      database: database,
      user: username,
      password: password,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    let sourceClient;
    try {
      sourceClient = await sourcePool.connect();

      // Query WAL size and replication slot info
      const walResult = await sourceClient.query(`
        SELECT
          slot_name,
          active,
          COALESCE(
            pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) / (1024 * 1024),
            0
          ) as wal_size_mb,
          COALESCE(
            pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn),
            0
          ) as lag_bytes,
          CASE
            WHEN active THEN 'streaming'
            ELSE 'inactive'
          END as wal_status
        FROM pg_replication_slots
        WHERE slot_name = $1
      `, [slotName]);

      if (walResult.rows.length === 0) {
        return reply.send({
          success: true,
          data: null,
          message: `No replication slot found: ${slotName}`
        });
      }

      const slotData = walResult.rows[0];
      const walSizeMB = parseFloat(slotData.wal_size_mb);

      // Query physical WAL directory info
      const walDirResult = await sourceClient.query(`
        SELECT
          pg_size_pretty(sum((pg_stat_file('pg_wal/' || name)).size)) as total_wal_size,
          sum((pg_stat_file('pg_wal/' || name)).size) / (1024 * 1024) as total_wal_size_mb,
          count(*) as wal_file_count
        FROM pg_ls_waldir()
      `);

      const walDirData = walDirResult.rows[0] || {
        total_wal_size: '0 bytes',
        total_wal_size_mb: 0,
        wal_file_count: 0
      };

      return reply.send({
        success: true,
        data: {
          wal_size_mb: walSizeMB,
          max_wal_size_mb: pipeline.max_wal_size || 1024,
          alert_threshold_percent: pipeline.alert_threshold || 80,
          replication_slot: {
            slot_name: slotData.slot_name,
            active: slotData.active,
            wal_status: slotData.wal_status,
            lag_bytes: parseInt(slotData.lag_bytes) || 0
          },
          physical_wal: {
            total_size_mb: parseFloat(walDirData.total_wal_size_mb) || 0,
            total_size_pretty: walDirData.total_wal_size,
            file_count: parseInt(walDirData.wal_file_count) || 0
          }
        }
      });

    } finally {
      if (sourceClient) sourceClient.release();
      await sourcePool.end();
    }

  } catch (error) {
    request.log.error({ err: error, pipelineId }, 'Failed to get WAL size');
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get WAL size'
    });
  }
});

server.post('/api/test-connection', async (request, reply) => {
  const payload = request.body ?? {};
  const { connectionType } = payload;

  // [DEBUG] Gelen isteği logla
  server.log.info({ msg: '[DEBUG] Incoming test-connection request', payload: maskSensitiveData(payload) });

  if (!connectionType) {
    return reply.code(400).send({
      success: false,
      error: 'connectionType is required',
    });
  }

  try {
    let result;
    switch (connectionType) {
      case 'oracle':
        result = await testOracleConnection(payload);
        break;
      case 'postgres':
      case 'postgresql':
        result = await testPostgresConnection(payload);
        break;
      default:
        return reply.code(400).send({
          success: false,
          error: `Connection type "${connectionType}" is not supported by this backend`,
        });
    }
    return reply.send(result);
  } catch (error) {
    request.log.error({ err: error }, 'Connection test failed');
    return reply.code(500).send({ success: false, error: error.message || 'Connection test failed' });
  }
});

server.post('/api/list-tables', async (request, reply) => {
  const payload = request.body ?? {};
  const { connectionType } = payload;

  // [DEBUG] Gelen isteği logla
  server.log.info({ msg: '[DEBUG] Incoming list-tables request', payload: maskSensitiveData(payload) });

  if (!connectionType) {
    return reply.code(400).send({ success: false, error: 'connectionType is required' });
  }

  try {
    let tables = [];
    switch (connectionType) {
      case 'oracle':
        tables = await listOracleTables(payload);
        break;
      case 'postgresql':
        tables = await listPostgresTables(payload);
        break;
      default:
        return reply.code(400).send({
          success: false,
          error: `Listing tables for connection type "${connectionType}" is not implemented`,
        });
    }

    return reply.send({ success: true, tables });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to list tables');
    return reply.code(500).send({ success: false, error: error.message || 'Failed to list tables' });
  }
});

server.post('/api/oracle/list-tables', async (request, reply) => {
  const payload = request.body ?? {};
  try {
    const tables = await listOracleTables(payload);
    return reply.send({ success: true, tables });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to list Oracle tables');
    return reply.code(500).send({ success: false, error: error.message || 'Failed to list Oracle tables' });
  }
});

server.get('/api/connectors/:name/diff', async (request, reply) => {
  const { name } = request.params;
  const query = request.query || {};
  const fromVersion = Number(query.from);
  const toVersion = Number(query.to);

  if (!name || Number.isNaN(fromVersion) || Number.isNaN(toVersion)) {
    return reply.code(400).send({ success: false, error: 'Valid connector name, from, and to versions are required' });
  }

  const client = await registryPool.connect();
  try {
    const connector = await getConnectorByName(client, name);
    if (!connector) {
      return reply.code(404).send({ success: false, error: 'Connector not found' });
    }

    const [fromConfig, toConfig] = await Promise.all([
      getConnectorVersionConfig(client, connector.id, fromVersion),
      getConnectorVersionConfig(client, connector.id, toVersion),
    ]);

    if (!fromConfig || !toConfig) {
      return reply.code(404).send({ success: false, error: 'One or more versions not found' });
    }

    const diff = diffConnectorConfigs(fromConfig, toConfig);
    return reply.send({ success: true, diff });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to compute connector diff');
    return reply.code(500).send({ success: false, error: 'Failed to compute diff' });
  } finally {
    client.release();
  }
});

server.post('/api/connectors/:name/mark-deployed', async (request, reply) => {
  const { name } = request.params;
  const { version } = request.body ?? {};

  if (!name || version === undefined) {
    return reply.code(400).send({ success: false, error: 'Connector name and version are required' });
  }

  const numericVersion = Number(version);
  if (Number.isNaN(numericVersion)) {
    return reply.code(400).send({ success: false, error: 'Version must be numeric' });
  }

  try {
    const result = await registryPool.query(
      `update pipeline_connectors
       set last_deployed_version = $2
       where config->>'registry_connector' = $1
       returning id`,
      [name, numericVersion]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ success: false, error: 'No pipeline connectors reference this registry connector' });
    }

    return reply.send({ success: true, updated: result.rowCount });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to mark connector as deployed');
    return reply.code(500).send({ success: false, error: 'Failed to update connector deployment state' });
  }
});

server.get('/api/connectors', async (request, reply) => {
  const client = await registryPool.connect();
  try {
    const res = await client.query(
      `select c.*, cv.version as active_version, cv.checksum as active_checksum
       from connectors c
       left join connector_versions cv on cv.connector_id = c.id and cv.is_active = true
       order by c.name asc`
    );
    return reply.send({ success: true, connectors: res.rows });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to list connectors');
    return reply.code(500).send({ success: false, error: 'Failed to list connectors' });
  } finally {
    client.release();
  }
});

server.get('/api/connectors/:name/versions', async (request, reply) => {
  const { name } = request.params;
  const client = await registryPool.connect();
  try {
    const connector = await getConnectorByName(client, name);
    if (!connector) {
      return reply.code(404).send({ success: false, error: 'Connector not found' });
    }

    const versions = await client.query(
      `select * from connector_versions
       where connector_id = $1
       order by version desc`,
      [connector.id]
    );

    return reply.send({ success: true, connector, versions: versions.rows });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to list versions');
    return reply.code(500).send({ success: false, error: 'Failed to list versions' });
  } finally {
    client.release();
  }
});

server.post('/api/connectors/:name/versions/:version/activate', async (request, reply) => {
  const { name, version } = request.params;
  const numericVersion = Number(version);

  if (!name || Number.isNaN(numericVersion)) {
    return reply.code(400).send({ success: false, error: 'Valid connector name and version are required' });
  }

  const client = await registryPool.connect();
  try {
    await client.query('BEGIN');
    const connector = await getConnectorByName(client, name);
    if (!connector) {
      await client.query('ROLLBACK');
      return reply.code(404).send({ success: false, error: 'Connector not found' });
    }

    const versionResult = await client.query(
      'select * from connector_versions where connector_id = $1 and version = $2',
      [connector.id, numericVersion]
    );

    if (versionResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.code(404).send({ success: false, error: 'Connector version not found' });
    }

    const activated = versionResult.rows[0];

    // Deploy the configuration to Kafka Connect
    const KAFKA_CONNECT_URL = process.env.KAFKA_CONNECT_URL || 'http://127.0.0.1:8083';
    try {
      const kafkaConnectResponse = await fetch(
        `${KAFKA_CONNECT_URL}/connectors/${encodeURIComponent(name)}/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activated.config),
        }
      );

      if (!kafkaConnectResponse.ok) {
        const errorText = await kafkaConnectResponse.text();
        await client.query('ROLLBACK');
        server.log.error({ err: errorText }, 'Failed to deploy config to Kafka Connect');
        return reply.code(500).send({
          success: false,
          error: `Failed to deploy to Kafka Connect: ${errorText}`
        });
      }

      server.log.info(`Successfully deployed config for connector ${name} to Kafka Connect`);
    } catch (kafkaError) {
      await client.query('ROLLBACK');
      server.log.error({ err: kafkaError }, 'Failed to connect to Kafka Connect');
      return reply.code(500).send({
        success: false,
        error: `Failed to connect to Kafka Connect: ${kafkaError.message}`
      });
    }

    // Update database registry after successful deployment
    await client.query('update connector_versions set is_active = false where connector_id = $1', [connector.id]);
    await client.query(
      'update connector_versions set is_active = true where connector_id = $1 and version = $2',
      [connector.id, numericVersion]
    );

    await client.query('COMMIT');
    return reply.send({
      success: true,
      connector,
      version: { id: activated.id, version: activated.version, checksum: activated.checksum },
      deployed: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    server.log.error({ err: error }, 'Failed to activate connector version');
    return reply.code(500).send({ success: false, error: 'Failed to activate connector version' });
  } finally {
    client.release();
  }
});

server.post('/api/registry/connectors/:name/versions', async (request, reply) => {
  const { name } = request.params;
  const payload = request.body ?? {};
  const { kind, connectorClass, config, schemaKey, schemaVersion, ownerId, createdBy, metadata } = payload;

  if (!kind || !connectorClass || !config) {
    return reply.code(400).send({
      success: false,
      error: 'kind, connectorClass, and config are required'
    });
  }

  const client = await registryPool.connect();
  try {
    await client.query('BEGIN');

    const connector = await getOrCreateConnector(client, {
      name,
      kind,
      connectorClass,
      ownerId: ownerId || null,
      metadata: metadata || {}
    });

    const validator = getSchemaValidator(schemaKey || connectorClass);
    if (validator) {
      const isValid = validator(config);
      if (!isValid) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          success: false,
          error: 'Configuration validation failed',
          details: validator.errors || [],
        });
      }
    }

    const { warnings, errors } = evaluatePolicies(kind, connectorClass, config);
    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return reply.code(400).send({
        success: false,
        error: 'Configuration policy violations',
        details: errors.map(e => ({ message: e })),
      });
    }

    const checksum = crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
    const existingVersionResult = await client.query(
      'select * from connector_versions where connector_id = $1 and checksum = $2',
      [connector.id, checksum]
    );

    if (existingVersionResult.rowCount > 0) {
      await client.query('COMMIT');
      const existing = existingVersionResult.rows[0];
      return reply.send({
        success: true,
        connector,
        version: {
          id: existing.id,
          version: existing.version,
          checksum: existing.checksum,
        },
        warnings: ['Configuration unchanged; existing version returned', ...warnings],
      });
    }

    const maxVersionResult = await client.query(
      'select max(version) as max_version from connector_versions where connector_id = $1',
      [connector.id]
    );
    const nextVersion = (maxVersionResult.rows[0]?.max_version || 0) + 1;

    const insertVersionResult = await client.query(
      `insert into connector_versions
       (connector_id, version, config, schema_version, checksum, created_by, policy_warnings, is_active)
       values ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, false)
       returning *`,
      [
        connector.id,
        nextVersion,
        JSON.stringify(config),
        schemaVersion || 'v1',
        checksum,
        createdBy || null,
        JSON.stringify(warnings.length > 0 ? warnings : []),
      ]
    );

    await client.query('COMMIT');
    const newVersion = insertVersionResult.rows[0];

    return reply.send({
      success: true,
      connector,
      version: {
        id: newVersion.id,
        version: newVersion.version,
        checksum: newVersion.checksum,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    server.log.error({ err: error }, 'Failed to create connector version');
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to create connector version'
    });
  } finally {
    client.release();
  }
});

server.get('/api/deployments', async (request, reply) => {
  const { connectorName } = request.query;
  const client = await registryPool.connect();
  try {
    let sql =
      `select d.*, c.name as connector_name, cv.version as connector_version
       from deployments d
       join connector_versions cv on d.connector_version_id = cv.id
       join connectors c on cv.connector_id = c.id`;
    const params = [];
    if (connectorName) {
      sql += ' where c.name = $1';
      params.push(connectorName);
    }
    sql += ' order by d.created_at desc limit 100';
    const deployments = await client.query(sql, params);
    return reply.send({ success: true, deployments: deployments.rows });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to list deployments');
    return reply.code(500).send({ success: false, error: 'Failed to list deployments' });
  } finally {
    client.release();
  }
});

// ==========================================
//  DATABASE FONKSİYONLARI (DEBUG EKLENDİ)
// ==========================================

async function testOracleConnection(config) {
  assertOracleConfig(config);
  
  // [DEBUG] Oracle Config Kontrolü
  console.log('-----------------------------------------------------');
  console.log('[DEBUG] testOracleConnection çağrıldı.');
  console.log(`[DEBUG] Host: ${config.host}, Port: ${config.port}`);
  console.log(`[DEBUG] Username: ${config.username}`);
  console.log(`[DEBUG] ServiceName: ${config.serviceName} | Database Param: ${config.database}`);
  
  const oracledb = await loadOracleClient();
  const connectionOptions = buildOracleConnectionOptions(config);

  let connection;
  try {
    console.log('[DEBUG] oracledb.getConnection çağrılıyor...');
    connection = await oracledb.getConnection(connectionOptions);
    console.log('[DEBUG] Bağlantı başarılı! Versiyon sorgulanıyor...');
    
    const versionResult = await connection.execute(
      "SELECT banner AS version FROM v$version WHERE banner LIKE 'Oracle Database%'"
    );

    console.log('[DEBUG] Versiyon sorgusu sonucu:', versionResult.rows);

    return {
      success: true,
      message: 'Oracle connection successful',
      version: versionResult.rows?.[0]?.VERSION || versionResult.rows?.[0]?.version || null,
    };
  } catch (err) {
    console.error('[DEBUG] Oracle Bağlantı Hatası Detayı:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        server.log.warn({ err: closeError }, 'Failed to close Oracle connection cleanly');
      }
    }
    console.log('-----------------------------------------------------');
  }
}

async function testPostgresConnection(config) {
  assertPostgresConfig(config);

  const client = new PgClient({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows?.[0]?.version || null;

    return {
      success: true,
      message: 'PostgreSQL connection successful',
      version,
    };
  } finally {
    try {
      await client.end();
    } catch (closeError) {
      server.log.warn({ err: closeError }, 'Failed to close PostgreSQL connection cleanly');
    }
  }
}

let oracleModulePromise;

async function loadOracleClient() {
  if (!oracleModulePromise) {
    oracleModulePromise = import('oracledb')
      .then((module) => module.default || module)
      .then((oracledb) => {
        if (process.env.ORACLE_CLIENT_LIB_DIR) {
          console.log(`[DEBUG] initOracleClient çağrılıyor. LibDir: ${process.env.ORACLE_CLIENT_LIB_DIR}`);
          oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB_DIR });
        } else {
          console.log('[DEBUG] initOracleClient çağrılmadı (LibDir yok), Thin mode kullanılacak.');
        }
        oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
        return oracledb;
      })
      .catch((error) => {
        oracleModulePromise = undefined;
        throw new Error(`Failed to load oracledb driver: ${error.message}`);
      });
  }

  return oracleModulePromise;
}

function assertOracleConfig(config) {
  const requiredFields = ['host', 'port', 'username', 'password'];
  requiredFields.forEach((field) => {
    if (config[field] === undefined || config[field] === null || config[field] === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  });
}

function buildOracleConnectionOptions(config) {
  // [DEBUG] Bağlantı dizesini (Connect String) oluşturma mantığı
  const targetService = config.serviceName || config.database;
  
  // Eğer Service Name yoksa loga uyarı bas
  if (!targetService) {
      console.warn('[DEBUG] UYARI: Hem serviceName hem de database parametresi boş!');
  }

  const connectString = `//${config.host}:${config.port}/${targetService}`;
  
  console.log(`[DEBUG] Oluşturulan Connect String: ${connectString}`);
  console.log(`[DEBUG] Kullanılan User: ${config.username}`);

  const connectionOptions = {
    user: config.username,
    password: config.password,
    connectString,
  };

  if (config.ssl && process.env.ORACLE_SSL_WALLET_LOCATION) {
    connectionOptions.walletLocation = process.env.ORACLE_SSL_WALLET_LOCATION;
    if (process.env.ORACLE_SSL_WALLET_PASSWORD) {
      connectionOptions.walletPassword = process.env.ORACLE_SSL_WALLET_PASSWORD;
    }
  }

  return connectionOptions;
}

async function listOracleTables(config) {
  assertOracleConfig(config);
  const oracledb = await loadOracleClient();
  const connectionOptions = buildOracleConnectionOptions(config);

  console.log('[DEBUG] listOracleTables çağrıldı. Bağlantı kuruluyor...');

  let connection;
  try {
    connection = await oracledb.getConnection(connectionOptions);
    
    // [DEBUG] Kullanıcı adını kontrol et
    const currentUserResult = await connection.execute("SELECT USER FROM DUAL");
    console.log('[DEBUG] Veritabanına şu kullanıcı olarak bağlanıldı:', currentUserResult.rows?.[0]?.USER);

    const query = `
      SELECT
        owner AS schema_name,
        table_name,
        NVL(num_rows, 0) AS row_count,
        NVL(blocks, 0) AS block_count,
        TO_CHAR(NVL(last_analyzed, SYSDATE), 'YYYY-MM-DD"T"HH24:MI:SS') AS last_analyzed
      FROM all_tables
      WHERE owner NOT IN ('SYS','SYSTEM','XDB','CTXSYS','MDSYS','ORDSYS','OUTLN','DBSNMP')
      ORDER BY owner, table_name
    `;

    const result = await connection.execute(query);
    console.log(`[DEBUG] Tablo listesi çekildi. Toplam tablo sayısı: ${result.rows?.length}`);

    const tables = (result.rows || []).map((row) => {
      const schema = row.SCHEMA_NAME || row.schema_name;
      const table = row.TABLE_NAME || row.table_name;
      const rowCount = row.ROW_COUNT ?? row.row_count ?? 0;
      const blockCount = row.BLOCK_COUNT ?? row.block_count ?? 0;
      const sizeBytes = blockCount * 8192;
      return {
        schema,
        table,
        rowCount,
        sizeEstimate: formatBytes(sizeBytes),
        lastModified: row.LAST_ANALYZED || row.last_analyzed || '',
      };
    });

    return tables;
  } catch(err) {
      console.error('[DEBUG] listOracleTables hatası:', err);
      throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        server.log.warn({ err: error }, 'Failed to close Oracle connection cleanly');
      }
    }
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(1)} ${units[exponent]}`;
}

async function listPostgresTables(config) {
  assertPostgresConfig(config);

  // Map localhost to host.minikube.internal when running in K8s
  let actualHost = config.host;
  if (config.host === 'localhost' || config.host === '127.0.0.1') {
    actualHost = process.env.K8S_HOST_GATEWAY || config.host;
  }

  const client = new PgClient({
    host: actualHost,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  const schema = config.schemaName || 'public';

  const query = `
    SELECT
      nsp.nspname AS schema_name,
      cls.relname AS table_name,
      COALESCE(stat.n_live_tup, 0) AS row_count,
      COALESCE(pg_total_relation_size(cls.oid), 0) AS total_bytes,
      TO_CHAR(stat.last_analyze, 'YYYY-MM-DD"T"HH24:MI:SS') AS last_analyzed
    FROM pg_class cls
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    LEFT JOIN pg_stat_all_tables stat ON stat.relid = cls.oid
    WHERE cls.relkind = 'r'
      AND nsp.nspname = $1
    ORDER BY cls.relname;
  `;

  try {
    const result = await client.query(query, [schema]);
    return result.rows.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      rowCount: Number(row.row_count) || 0,
      sizeEstimate: formatBytes(Number(row.total_bytes) || 0),
      lastModified: row.last_analyzed || '',
    }));
  } finally {
    await client.end();
  }
}

function assertPostgresConfig(config) {
  const required = ['host', 'port', 'database', 'username', 'password'];
  required.forEach((field) => {
    if (config[field] === undefined || config[field] === null || config[field] === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  });
}

function validateConfig(schemaKey, config) {
  try {
    const validator = getSchemaValidator(schemaKey);
    const valid = validator(config);
    return { valid, errors: valid ? [] : validator.errors || [] };
  } catch (error) {
    server.log.error({ err: error }, 'Failed to load schema');
    return { valid: false, errors: [{ message: 'Unable to load schema definition' }] };
  }
}

function getSchemaValidator(schemaKey) {
  if (validatorCache.has(schemaKey)) {
    return validatorCache.get(schemaKey);
  }

  const schemaFileName = SCHEMA_MAP[schemaKey] || schemaKey;
  const schemaPath = path.join(SCHEMA_BASE_DIR, schemaFileName);

  if (!fs.existsSync(schemaPath)) {
    server.log.warn({ schemaKey, schemaPath }, 'Schema file not found');
    return null;
  }

  const schemaContent = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validator = ajv.compile(schemaContent);
  validatorCache.set(schemaKey, validator);
  return validator;
}

function sanitizeConfig(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeConfig(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((acc, key) => {
      const sanitized = sanitizeConfig(value[key]);
      if (sanitized !== undefined) {
        acc[key] = sanitized;
      }
      return acc;
    }, {});
  }
  return value;
}

function canonicalizeConfig(config) {
  return canonicalizeValue(config);
}

function canonicalizeValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const serialized = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key])}`);
    return `{${serialized.join(',')}}`;
  }
  return JSON.stringify(value);
}

function evaluatePolicies(kind, connectorClass, config) {
  const warnings = [];
  const errors = [];

  const tasksMax = Number(config['tasks.max']);
  if (!Number.isNaN(tasksMax) && tasksMax > 8) {
    warnings.push('tasks.max exceeds recommended threshold (8)');
  }

  if (String(config['errors.tolerance']).toLowerCase() === 'all') {
    warnings.push('errors.tolerance=all may hide data issues');
  }

  if (connectorClass === 'io.debezium.connector.jdbc.JdbcSinkConnector') {
    const insertMode = config['insert.mode'];
    const pkMode = config['primary.key.mode'] || config['pk.mode'];
    if (
      insertMode === 'upsert' &&
      !['record_key', 'record_value'].includes(pkMode || '')
    ) {
      errors.push('insert.mode=upsert requires pk.mode to be record_key or record_value');
    }
    const autoCreate = normalizeBoolean(config['auto.create']);
    const autoEvolve = normalizeBoolean(config['auto.evolve']);
    if (autoCreate === false && autoEvolve === true) {
      warnings.push('auto.evolve enabled while auto.create disabled');
    }
  }

  return { warnings, errors };
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

async function getOrCreateConnector(client, { name, kind, connectorClass, ownerId, metadata }) {
  const existing = await client.query('select * from connectors where name = $1', [name]);
  if (existing.rowCount > 0) {
    const connector = existing.rows[0];
    server.log.info({
      name,
      requestKind: kind,
      requestClass: connectorClass,
      existingKind: connector.kind,
      existingClass: connector.class
    }, 'Existing connector found');

    if (connector.kind !== kind || connector.class !== connectorClass) {
      throw new Error(`Connector kind or class mismatch with existing record: expected kind=${kind} class=${connectorClass}, found kind=${connector.kind} class=${connector.class}`);
    }
    return existing.rows[0];
  }

  const insert = await client.query(
    `insert into connectors (name, kind, class, owner_id, metadata)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [name, kind, connectorClass, ownerId, metadata || {}]
  );
  return insert.rows[0];
}

async function getConnectorByName(client, name) {
  const result = await client.query('select * from connectors where name = $1', [name]);
  return result.rows[0];
}

async function selectConnectorVersion(client, connectorId, versionNumber) {
  if (versionNumber !== undefined) {
    const result = await client.query('select * from connector_versions where connector_id = $1 and version = $2', [
      connectorId,
      versionNumber,
    ]);
    return result.rows[0];
  }

  const result = await client.query(
    'select * from connector_versions where connector_id = $1 and is_active = true limit 1',
    [connectorId]
  );
  return result.rows[0];
}

async function getConnectorVersionConfig(client, connectorId, versionNumber) {
  const result = await client.query(
    'select config from connector_versions where connector_id = $1 and version = $2',
    [connectorId, versionNumber]
  );
  return result.rows[0]?.config || null;
}

function diffConnectorConfigs(fromConfig, toConfig) {
  const fromFlat = flattenConfig(fromConfig);
  const toFlat = flattenConfig(toConfig);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, value] of Object.entries(toFlat)) {
    if (!(key in fromFlat)) {
      added.push({ path: key, value });
    } else if (fromFlat[key] !== value) {
      changed.push({ path: key, from: fromFlat[key], to: value });
    }
  }

  for (const [key, value] of Object.entries(fromFlat)) {
    if (!(key in toFlat)) {
      removed.push({ path: key, value });
    }
  }

  return { added, removed, changed };
}

function flattenConfig(obj, prefix = '') {
  if (obj === null || obj === undefined) {
    return { [prefix || 'value']: 'null' };
  }

  if (Array.isArray(obj)) {
    return obj.reduce((acc, value, index) => {
      const key = prefix ? `${prefix}[${index}]` : `[${index}]`;
      Object.assign(acc, flattenConfig(value, key));
      return acc;
    }, {});
  }

  if (typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      Object.assign(acc, flattenConfig(value, nextPrefix));
      return acc;
    }, {});
  }

  const serialized = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return { [prefix || 'value']: serialized };
}

try {
  await server.listen({ port: PORT, host: HOST });
  server.log.info(`Backend listening on http://${HOST}:${PORT}`);
} catch (error) {
  server.log.error(error, 'Failed to start backend server');
  process.exit(1);
}