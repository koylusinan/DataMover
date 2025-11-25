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

async function checkConnectorPassword() {
  try {
    const result = await pool.query(`
      SELECT pc.id, pc.pipeline_id, pc.type, pc.config, p.name as pipeline_name
      FROM pipeline_connectors pc
      JOIN pipelines p ON p.id = pc.pipeline_id
      WHERE p.name = 'denizim' AND pc.type = 'source'
    `);

    if (result.rows.length > 0) {
      const connector = result.rows[0];
      const config = connector.config;

      console.log('Pipeline:', connector.pipeline_name);
      console.log('Connector Type:', connector.type);
      console.log('\nConnector Config Keys:', Object.keys(config));
      console.log('\nFull Config:', JSON.stringify(config, null, 2));

      // Check for password fields
      const passwordFields = Object.keys(config).filter(k =>
        k.toLowerCase().includes('password') || k.toLowerCase().includes('pass')
      );
      console.log('\nPassword-related fields:', passwordFields);

      passwordFields.forEach(field => {
        console.log(`\n${field}:`, typeof config[field], config[field]);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkConnectorPassword();
