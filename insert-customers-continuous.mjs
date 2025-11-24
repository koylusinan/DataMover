import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres'
});

async function insertCustomers() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL testdb on port 5432');

    const duration = 60 * 1000; // 1 minute in milliseconds
    const interval = 2000; // 2 seconds
    const recordsPerBatch = 100;
    const startTime = Date.now();
    let totalInserted = 0;

    console.log('🚀 Starting continuous insertion for 1 minute...');
    console.log(`📊 Inserting ${recordsPerBatch} records every ${interval / 1000} seconds\n`);

    const insertInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= duration) {
        clearInterval(insertInterval);
        console.log(`\n✅ Completed! Total records inserted: ${totalInserted}`);
        await client.end();
        process.exit(0);
        return;
      }

      try {
        // Insert 10 customers
        const values = [];
        const placeholders = [];

        for (let i = 0; i < recordsPerBatch; i++) {
          const timestamp = Date.now();
          const name = `Customer_${timestamp}_${i}`;
          const email = `customer${timestamp}${i}@example.com`;

          const offset = i * 2;
          placeholders.push(`($${offset + 1}, $${offset + 2})`);
          values.push(name, email);
        }

        const query = `
          INSERT INTO customers (name, email)
          VALUES ${placeholders.join(', ')}
        `;

        await client.query(query, values);
        totalInserted += recordsPerBatch;

        const timeRemaining = Math.ceil((duration - elapsed) / 1000);
        console.log(`✓ Inserted ${recordsPerBatch} customers | Total: ${totalInserted} | Time remaining: ${timeRemaining}s`);
      } catch (error) {
        console.error('❌ Error inserting batch:', error.message);
      }
    }, interval);

  } catch (error) {
    console.error('❌ Connection error:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted by user');
  await client.end();
  process.exit(0);
});

insertCustomers();
