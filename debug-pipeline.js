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
  const result = await client.query(`
    SELECT p.name, p.id, p.status, sc.config as source_config
    FROM pipelines p
    LEFT JOIN pipeline_connectors sc ON sc.pipeline_id = p.id AND sc.type = 'source'
    WHERE p.id = '21ce9a3a-a9d7-4a3a-a14b-eaf0d3bb9f53'
  `);

  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  client.release();
  await pool.end();
}
