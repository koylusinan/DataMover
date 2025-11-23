#!/usr/bin/env node
import { Client } from 'pg';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 54322),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
};

const client = new Client(dbConfig);

const slugify = (value, fallback) => {
  if (!value) return fallback;
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
};

const buildOracleConfig = (pipelineName, config) => {
  const topicPrefix = config['topic.prefix'] || slugify(pipelineName, 'oracle-source');
  const host = config.host || config['database.hostname'] || 'localhost';
  const port = String(config.port || config['database.port'] || 1521);
  const user = config.username || config['database.user'] || 'DEBEZIUM';
  const password = config.password || config['database.password'] || '';
  const dbname = config.service_name || config.database_name || config['database.dbname'] || 'XE';
  const schema = config.schema_name || config['database.schema'] || 'INVENTORY';
  const includeList = config['table.include.list'] || '';
  const fetchSize = config.query_fetch_size || config['snapshot.fetch.size'] || 2000;
  const lockTimeout = config.snapshot_lock_timeout || config['snapshot.lock.timeout.ms'] || 5000;
  const serverName = config['database.server.name'] || slugify(`${pipelineName}-server`, 'oracle-server');

  return {
    name: config.name || `${pipelineName}_source`,
    'tasks.max': '1',
    'topic.prefix': topicPrefix,
    'database.hostname': host,
    'database.port': port,
    'database.user': user,
    'database.password': password,
    'database.dbname': dbname,
    'database.server.name': serverName,
    'database.out.server.name': config['database.out.server.name'] || `${serverName}-xout`,
    'database.connection.adapter': config['database.connection.adapter'] || 'logminer',
    'database.schema': schema,
    'database.history.kafka.bootstrap.servers': config['database.history.kafka.bootstrap.servers'] || 'kafka:9092',
    'database.history.kafka.topic': config['database.history.kafka.topic'] || `schema-changes.${topicPrefix}`,
    'snapshot.mode': config['snapshot.mode'] || 'initial',
    'snapshot.lock.timeout.ms': String(lockTimeout),
    'snapshot.fetch.size': String(fetchSize),
    'snapshot.delay.ms': config['snapshot.delay.ms'] || '0',
    'connector.class': 'io.debezium.connector.oracle.OracleConnector',
    'table.include.list': includeList,
    'log.mining.strategy': config['log.mining.strategy'] || 'online_catalog',
    'log.mining.continuous.mine': config['log.mining.continuous.mine'] || 'true',
    'log.mining.sleep.time.default': config['log.mining.sleep.time.default'] || '1000',
    'decimal.handling.mode': config['decimal.handling.mode'] || 'double',
    'time.precision.mode': config['time.precision.mode'] || 'adaptive',
    'tombstones.on.delete': config['tombstones.on.delete'] || 'false',
    'include.schema.changes': config['include.schema.changes'] || 'true',
  };
};

const buildPostgresConfig = (pipelineName, config) => {
  const topicPrefix = config['topic.prefix'] || slugify(pipelineName, 'postgres-source');
  const host = config.host || config['database.hostname'] || 'localhost';
  const port = String(config.port || config['database.port'] || 5432);
  const user = config.username || config['database.user'] || 'postgres';
  const password = config.password || config['database.password'] || '';
  const dbname = config.database_name || config['database.dbname'] || 'postgres';
  const schema = config.schema_name || config['database.schema'] || 'public';
  const includeList = config['table.include.list'] || '';

  return {
    name: config.name || `${pipelineName}_source`,
    'tasks.max': '1',
    'connector.class': 'io.debezium.connector.postgresql.PostgresConnector',
    'database.hostname': host,
    'database.port': port,
    'database.user': user,
    'database.password': password,
    'database.dbname': dbname,
    'database.schema': schema,
    'table.include.list': includeList,
    'topic.prefix': topicPrefix,
    'plugin.name': config['plugin.name'] || 'pgoutput',
    'publication.name': config['publication.name'] || 'dbz_publication',
    'slot.name': config['slot.name'] || 'debezium_slot',
    'slot.drop.on.stop': config['slot.drop.on.stop'] || 'false',
    'snapshot.mode': config['snapshot.mode'] || 'initial',
    'decimal.handling.mode': config['decimal.handling.mode'] || 'double',
    'tombstones.on.delete': config['tombstones.on.delete'] || 'false',
    'include.schema.changes': config['include.schema.changes'] || 'false',
  };
};

const migrate = async () => {
  await client.connect();
  const { rows } = await client.query(`
    SELECT pc.id, pc.name, pc.connector_class, pc.config, p.name AS pipeline_name
    FROM pipeline_connectors pc
    JOIN pipelines p ON p.id = pc.pipeline_id
    WHERE pc.connector_class ILIKE '%oracle%'
       OR pc.connector_class ILIKE '%postgres%'
  `);

  let updated = 0;
  for (const row of rows) {
    const currentConfig = row.config || {};
    let newConfig = null;
    if (/oracle/i.test(row.connector_class)) {
      newConfig = buildOracleConfig(row.pipeline_name, currentConfig);
    } else if (/postgres/i.test(row.connector_class)) {
      newConfig = buildPostgresConfig(row.pipeline_name, currentConfig);
    }

    if (newConfig) {
      await client.query('UPDATE pipeline_connectors SET config = $1 WHERE id = $2', [newConfig, row.id]);
      updated += 1;
      console.log(`Updated ${row.name} (${row.connector_class})`);
    }
  }

  await client.end();
  console.log(`Migration complete. Updated ${updated} connector(s).`);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
