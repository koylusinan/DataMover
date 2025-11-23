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

  console.log('🔄 Inserting 100 roles...');
  const startTime = Date.now();

  for (let i = 0; i < 100; i++) {
    const result = await client.query(
      `INSERT INTO public.roles (role_name, description)
       VALUES ($1, $2)
       RETURNING id, role_name`,
      [`role_${Date.now()}_${i}`, `Bulk test role at ${new Date().toISOString()}`]
    );
    if (i % 10 === 0) {
      console.log(`  ✓ Progress: ${i}/100 - Last ID: ${result.rows[0].id}`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`✅ Completed 100 inserts in ${elapsed}ms`);

  await client.end();
}

insertRoles().catch(err => {
  console.error('❌ Error:', err);
  client.end();
  process.exit(1);
});
