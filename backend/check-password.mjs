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

async function checkPassword() {
  try {
    const result = await pool.query(`
      SELECT id, name, source_config
      FROM pipelines
      WHERE name = 'denizim'
    `);

    if (result.rows.length > 0) {
      const pipeline = result.rows[0];
      const sourceConfig = pipeline.source_config;

      console.log('Pipeline:', pipeline.name);
      console.log('Source Config:', JSON.stringify(sourceConfig, null, 2));
      console.log('\nPassword field type:', typeof sourceConfig.password);
      console.log('Password value:', sourceConfig.password);

      if (Buffer.isBuffer(sourceConfig.password)) {
        console.log('Is Buffer: YES');
        console.log('Buffer toString:', sourceConfig.password.toString('utf8'));
      } else {
        console.log('Is Buffer: NO');
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkPassword();
