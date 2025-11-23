const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres'
});

const tables = [
  {
    name: 'employees',
    columns: `
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE,
      department VARCHAR(100),
      salary DECIMAL(10, 2),
      hire_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'products',
    columns: `
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      price DECIMAL(10, 2),
      stock_quantity INTEGER DEFAULT 0,
      sku VARCHAR(50) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'orders',
    columns: `
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(255),
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_amount DECIMAL(10, 2),
      status VARCHAR(50) DEFAULT 'pending'
    `
  },
  {
    name: 'order_items',
    columns: `
      id SERIAL PRIMARY KEY,
      order_id INTEGER,
      product_name VARCHAR(255),
      quantity INTEGER,
      unit_price DECIMAL(10, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'categories',
    columns: `
      id SERIAL PRIMARY KEY,
      category_name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      parent_category_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'suppliers',
    columns: `
      id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'invoices',
    columns: `
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(255),
      invoice_date DATE DEFAULT CURRENT_DATE,
      due_date DATE,
      amount DECIMAL(10, 2),
      paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'payments',
    columns: `
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50),
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      amount DECIMAL(10, 2),
      payment_method VARCHAR(50),
      transaction_id VARCHAR(100)
    `
  },
  {
    name: 'departments',
    columns: `
      id SERIAL PRIMARY KEY,
      department_name VARCHAR(100) UNIQUE NOT NULL,
      manager_name VARCHAR(255),
      budget DECIMAL(12, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'projects',
    columns: `
      id SERIAL PRIMARY KEY,
      project_name VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      status VARCHAR(50) DEFAULT 'active',
      budget DECIMAL(12, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'tasks',
    columns: `
      id SERIAL PRIMARY KEY,
      task_name VARCHAR(255) NOT NULL,
      project_id INTEGER,
      assigned_to VARCHAR(255),
      status VARCHAR(50) DEFAULT 'todo',
      priority VARCHAR(20),
      due_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'users',
    columns: `
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'roles',
    columns: `
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'permissions',
    columns: `
      id SERIAL PRIMARY KEY,
      permission_name VARCHAR(100) UNIQUE NOT NULL,
      resource VARCHAR(100),
      action VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'audit_logs',
    columns: `
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      action VARCHAR(100),
      table_name VARCHAR(100),
      record_id INTEGER,
      old_values JSONB,
      new_values JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'settings',
    columns: `
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      data_type VARCHAR(50),
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'notifications',
    columns: `
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title VARCHAR(255),
      message TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      notification_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'sessions',
    columns: `
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      session_token VARCHAR(255) UNIQUE NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'api_keys',
    columns: `
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      key_name VARCHAR(100),
      api_key VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  },
  {
    name: 'webhooks',
    columns: `
      id SERIAL PRIMARY KEY,
      webhook_url TEXT NOT NULL,
      event_type VARCHAR(100),
      is_active BOOLEAN DEFAULT TRUE,
      secret_key VARCHAR(255),
      retry_count INTEGER DEFAULT 0,
      last_triggered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
  }
];

async function createTables() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL (testdb)\n');

    let createdCount = 0;
    let skippedCount = 0;

    for (const table of tables) {
      try {
        // Check if table exists
        const checkResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          );
        `, [table.name]);

        if (checkResult.rows[0].exists) {
          console.log(`⏭️  Table '${table.name}' already exists, skipping...`);
          skippedCount++;
          continue;
        }

        // Create table
        await client.query(`
          CREATE TABLE ${table.name} (
            ${table.columns}
          )
        `);

        console.log(`✅ Created table: ${table.name}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error creating table '${table.name}':`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   - Tables created: ${createdCount}`);
    console.log(`   - Tables skipped: ${skippedCount}`);
    console.log(`   - Total tables: ${tables.length}`);
    console.log('='.repeat(50));

    // Show all tables in database
    const allTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 All tables in testdb:');
    allTables.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Connection closed');
  }
}

createTables();
