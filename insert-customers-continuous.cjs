const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

const cities = ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Mersin', 'Kayseri'];

function getRandomCity() {
  return cities[Math.floor(Math.random() * cities.length)];
}

async function insertBatch(batchNumber, batchSize) {
  const values = [];
  const timestamp = Date.now();

  for (let i = 0; i < batchSize; i++) {
    const id = batchNumber * batchSize + i + 1;
    const name = `Customer ${id}`;
    const email = `customer${id}_${timestamp}@example.com`;
    const city = getRandomCity();
    values.push(`('${name}', '${email}', '${city}')`);
  }

  const query = `INSERT INTO customers (name, email, city) VALUES ${values.join(', ')}`;

  try {
    await client.query(query);
    console.log(`[${new Date().toISOString()}] Batch ${batchNumber + 1}: Inserted ${batchSize} records`);
  } catch (err) {
    console.error(`Error inserting batch ${batchNumber + 1}:`, err.message);
  }
}

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL');
  console.log('Starting continuous inserts: 50 records every 2 seconds for 30 seconds');
  console.log('Total expected records: ~750');
  console.log('---');

  const intervalMs = 2000; // 2 seconds
  const durationMs = 30000; // 30 seconds
  const batchSize = 50;

  let batchNumber = 0;
  const startTime = Date.now();

  const interval = setInterval(async () => {
    const elapsed = Date.now() - startTime;

    if (elapsed >= durationMs) {
      clearInterval(interval);
      console.log('---');
      console.log('Completed! Disconnecting...');
      await client.end();
      process.exit(0);
    } else {
      await insertBatch(batchNumber, batchSize);
      batchNumber++;
    }
  }, intervalMs);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
