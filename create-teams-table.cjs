const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres'
});

async function createTeamsTable() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL (testdb)');

    // Create teams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(100),
        location VARCHAR(100),
        team_size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created teams table');

    // Generate team names
    const departments = ['Engineering', 'Sales', 'Marketing', 'Support', 'HR', 'Finance', 'Product', 'Design', 'Operations', 'Legal'];
    const locations = ['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin', 'Singapore', 'Sydney', 'Toronto', 'Paris', 'Amsterdam'];
    const teamTypes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];

    // Insert 100 teams
    for (let i = 1; i <= 100; i++) {
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

    console.log('✅ Inserted 100 teams');

    // Show sample data
    const result = await client.query('SELECT * FROM teams ORDER BY id LIMIT 5');
    console.log('\n📊 Sample teams:');
    console.table(result.rows);

    const count = await client.query('SELECT COUNT(*) FROM teams');
    console.log(`\n✅ Total teams in database: ${count.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

createTeamsTable();
