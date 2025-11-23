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

  const endTime = Date.now() + 60000; // 1 minute from now
  let totalInserted = 0;
  let batchNumber = 0;

  while (Date.now() < endTime) {
    batchNumber++;
    console.log(`\n🔄 Batch ${batchNumber} - Inserting 10 roles...`);

    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      const result = await client.query(
        `INSERT INTO public.roles (role_name, description)
         VALUES ($1, $2)
         RETURNING id, role_name`,
        [`role_${Date.now()}_${i}`, `Auto-generated role at ${new Date().toISOString()}`]
      );
      totalInserted++;
      console.log(`  ✓ Inserted role ${result.rows[0].id}: ${result.rows[0].role_name}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Batch ${batchNumber} completed in ${elapsed}ms. Total: ${totalInserted} roles`);

    // Wait 5 seconds before next batch (minus the time already spent)
    const waitTime = Math.max(0, 5000 - elapsed);
    if (waitTime > 0 && Date.now() + waitTime < endTime) {
      console.log(`⏳ Waiting ${waitTime}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  console.log(`\n🎉 Completed! Total ${totalInserted} roles inserted in 1 minute`);
  await client.end();
}

insertRoles().catch(err => {
  console.error('❌ Error:', err);
  client.end();
  process.exit(1);
});
