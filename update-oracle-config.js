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

  // Update hostname in snapshot_config
  if (config.snapshot_config) {
    config.snapshot_config['database.hostname'] = 'oracle-xe';
    console.log('Updated database.hostname to oracle-xe');
  }

  // Update in database
  await client.query(`
    UPDATE pipeline_connectors
    SET config = $1, updated_at = now()
    WHERE pipeline_id = '21ce9a3a-a9d7-4a3a-a14b-eaf0d3bb9f53' AND type = 'source'
  `, [config]);

  console.log('✅ Configuration updated successfully');
  console.log('New hostname:', config.snapshot_config['database.hostname']);
} finally {
  client.release();
  await pool.end();
}
