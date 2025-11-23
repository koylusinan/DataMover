import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST || '127.0.0.1',
  port: Number(process.env.SUPABASE_DB_PORT || 54322),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'postgres',
  ssl: process.env.SUPABASE_DB_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

async function checkPendingConfig() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id,
        name,
        has_pending_changes,
        pending_config IS NULL as pending_is_null,
        jsonb_typeof(pending_config) as pending_type
      FROM pipeline_connectors
      WHERE id = '55601b98-c899-47d0-9b7b-b16185928e83'
    `);

    console.log('Connector Info:', JSON.stringify(result.rows[0], null, 2));

    if (result.rows[0] && !result.rows[0].pending_is_null) {
      const configResult = await client.query(`
        SELECT pending_config
        FROM pipeline_connectors
        WHERE id = '55601b98-c899-47d0-9b7b-b16185928e83'
      `);
      console.log('\nPending Config keys:', Object.keys(configResult.rows[0].pending_config || {}));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPendingConfig();
