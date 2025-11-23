#!/usr/bin/env node

const { Client } = require('pg');

// PostgreSQL connection to testdb
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres'
});

async function connectDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL (testdb)');
  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    process.exit(1);
  }
}

async function insertBatch(count) {
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 10000)}@example.com`;

    await client.query(
      'INSERT INTO public.customers (name, email) VALUES ($1, $2)',
      [name, email]
    );
  }
}

async function run() {
  await connectDatabase();

  console.log('🚀 Starting FAST data insertion');
  console.log('📊 10 records/second for 60 seconds = 600 total records\n');

  let totalInserted = 0;
  let iterations = 0;

  const startTime = Date.now();

  // Insert 10 records every second for 60 seconds
  const interval = setInterval(async () => {
    iterations++;

    try {
      await insertBatch(10);
      totalInserted += 10;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`[${elapsed}s] Inserted 10 records. Total: ${totalInserted}/600`);

      // Stop after 60 seconds (60 iterations)
      if (iterations >= 60) {
        clearInterval(interval);
        const result = await client.query('SELECT COUNT(*) FROM public.customers');
        console.log(`\n✅ COMPLETED! Inserted ${totalInserted} records in 60 seconds`);
        console.log(`📊 Database total: ${result.rows[0].count} customers`);
        await client.end();
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Error inserting data:', error.message);
      clearInterval(interval);
      await client.end();
      process.exit(1);
    }
  }, 1000); // Every 1 second
}

run().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  await client.end();
  process.exit(0);
});
