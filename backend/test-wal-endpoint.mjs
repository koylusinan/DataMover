import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: 54322,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
  ssl: false,
});

async function testWALEndpoint() {
  try {
    // Get PostgreSQL pipelines
    const result = await pool.query(`
      SELECT id, name, source_type
      FROM pipelines
      WHERE source_type = 'postgres'
      LIMIT 5
    `);

    console.log('📋 PostgreSQL Pipelines:');
    console.log(result.rows);

    if (result.rows.length > 0) {
      const pipelineId = result.rows[0].id;
      console.log(`\n🧪 Testing WAL endpoint for pipeline: ${result.rows[0].name} (${pipelineId})`);

      // Test the WAL endpoint
      const response = await fetch(`http://localhost:5001/api/pipelines/${pipelineId}/wal-size`);
      const data = await response.json();

      console.log('\n📊 WAL Endpoint Response:');
      console.log(JSON.stringify(data, null, 2));
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testWALEndpoint();
