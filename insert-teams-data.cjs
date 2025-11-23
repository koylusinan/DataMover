const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres'
});

const departments = ['Engineering', 'Sales', 'Marketing', 'Support', 'HR', 'Finance', 'Product', 'Design', 'Operations', 'Legal'];
const locations = ['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin', 'Singapore', 'Sydney', 'Toronto', 'Paris', 'Amsterdam'];
const teamTypes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];

async function insertTeamsData() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL (testdb)');

    // Get current count
    const countResult = await client.query('SELECT COUNT(*) FROM teams');
    let totalCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Current teams count: ${totalCount}`);

    console.log('🚀 Starting data insertion (20 records every 60 seconds)...');
    console.log('Press Ctrl+C to stop\n');

    const interval = setInterval(async () => {
      try {
        // Insert 20 teams
        for (let i = 0; i < 20; i++) {
          const department = departments[Math.floor(Math.random() * departments.length)];
          const location = locations[Math.floor(Math.random() * locations.length)];
          const teamType = teamTypes[Math.floor(Math.random() * teamTypes.length)];
          const teamSize = Math.floor(Math.random() * 20) + 3; // 3-22 members
          const teamName = `${department} ${teamType} Team`;

          await client.query(
            'INSERT INTO teams (name, department, location, team_size) VALUES ($1, $2, $3, $4)',
            [teamName, department, location, teamSize]
          );
        }

        totalCount += 20;
        console.log(`✅ [${new Date().toISOString()}] Inserted 20 teams. Total: ${totalCount}`);
      } catch (error) {
        console.error('❌ Error inserting teams:', error.message);
      }
    }, 60000); // Every 60 seconds

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      clearInterval(interval);
      console.log('\n\n🛑 Stopping data insertion...');
      await client.end();
      console.log('✅ Connection closed');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

insertTeamsData();
