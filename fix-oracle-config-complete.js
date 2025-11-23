import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST || '127.0.0.1',
  port: Number(process.env.SUPABASE_DB_PORT || 54322),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'postgres',
});

const client = await pool.connect();

try {
  // Get current config
  const result = await client.query(`
    SELECT sc.config
    FROM pipelines p
    LEFT JOIN pipeline_connectors sc ON sc.pipeline_id = p.id AND sc.type = 'source'
    WHERE p.id = '21ce9a3a-a9d7-4a3a-a14b-eaf0d3bb9f53'
  `);

  const config = result.rows[0].config;

  // Update config with Oracle 23c compatible settings
  if (config.snapshot_config) {
    // Use explicit JDBC URL instead of hostname/port/dbname
    config.snapshot_config['database.url'] = 'jdbc:oracle:thin:@oracle-xe:1521/FREEPDB1';

    // Keep these for reference but URL takes precedence
    config.snapshot_config['database.hostname'] = 'oracle-xe';
    config.snapshot_config['database.port'] = '1521';
    config.snapshot_config['database.dbname'] = 'FREEPDB1';

    // Oracle 23c specific settings - use compatible log mining strategy
    config.snapshot_config['log.mining.strategy'] = 'online_catalog';

    // Add history storage configuration (required for Debezium)
    config.snapshot_config['schema.history.internal.kafka.bootstrap.servers'] = '127.0.0.1:9092';
    config.snapshot_config['schema.history.internal.kafka.topic'] = 'schema-changes.oracle-xe';

    // Remove problematic database.history.* (old parameter names)
    delete config.snapshot_config['database.history.kafka.topic'];
    delete config.snapshot_config['database.history.kafka.bootstrap.servers'];
    delete config.snapshot_config['database.server.name']; // Not needed with topic.prefix
    delete config.snapshot_config['database.out.server.name']; // Only for XStream

    console.log('✅ Updated configuration:');
    console.log('  - database.url:', config.snapshot_config['database.url']);
    console.log('  - log.mining.strategy:', config.snapshot_config['log.mining.strategy']);
    console.log('  - schema.history.internal.kafka.bootstrap.servers:', config.snapshot_config['schema.history.internal.kafka.bootstrap.servers']);
  }

  // Update in database
  await client.query(`
    UPDATE pipeline_connectors
    SET config = $1, updated_at = now()
    WHERE pipeline_id = '21ce9a3a-a9d7-4a3a-a14b-eaf0d3bb9f53' AND type = 'source'
  `, [config]);

  console.log('\n✅ Configuration updated successfully in database');
} finally {
  client.release();
  await pool.end();
}
