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
    console.log('✅ Using existing customers table (id, name, email, created_at)');
  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
  }
}

async function insertTestData() {
  try {
    const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];

    // Insert 20 customer records
    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;

      await client.query(
        'INSERT INTO public.customers (name, email) VALUES ($1, $2)',
        [name, email]
      );
    }

    const result = await client.query('SELECT COUNT(*) FROM public.customers');
    console.log(`✅ [${new Date().toISOString()}] Inserted 20 customers. Total: ${result.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error inserting data:', error.message);
  }
}

async function run() {
  await connectDatabase();

  console.log('🚀 Starting data insertion (20 records every 10 seconds)...');
  console.log('Press Ctrl+C to stop\n');

  // Insert data every 10 seconds
  setInterval(insertTestData, 10000);

  // Insert first batch immediately
  await insertTestData();
}

run().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  await client.end();
  process.exit(0);
});
