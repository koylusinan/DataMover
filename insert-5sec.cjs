const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres',
});

async function insertRoles() {
  await client.connect();
  console.log('✅ Connected to PostgreSQL (testdb)');

  console.log('🔄 Inserting 10 roles...');
  const startTime = Date.now();

  for (let i = 0; i < 10; i++) {
    const result = await client.query(
      `INSERT INTO public.roles (role_name, description)
       VALUES ($1, $2)
       RETURNING id, role_name`,
      [`role_${Date.now()}_${i}`, `Test role at ${new Date().toISOString()}`]
    );
    console.log(`  ✓ Inserted role ${result.rows[0].id}: ${result.rows[0].role_name}`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`✅ Completed in ${elapsed}ms`);

  await client.end();
}

insertRoles().catch(err => {
  console.error('❌ Error:', err);
  client.end();
  process.exit(1);
});
