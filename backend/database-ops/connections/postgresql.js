const { getPool } = require('../utils/connectionPool');

/**
 * Test PostgreSQL connection
 */
async function testConnection(destinationConfig) {
  const pool = getPool(destinationConfig);

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    client.release();

    return {
      success: true,
      version: result.rows[0].version,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get database information
 */
async function getDatabaseInfo(destinationConfig) {
  const pool = getPool(destinationConfig);

  try {
    const client = await pool.connect();

    // Get version
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version;

    // Get database size
    const sizeResult = await client.query(
      'SELECT pg_database_size($1) as size',
      [destinationConfig.database]
    );
    const size = parseInt(sizeResult.rows[0].size);

    // Get total tables count
    const tablesResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `);
    const totalTables = parseInt(tablesResult.rows[0].count);

    client.release();

    return {
      success: true,
      data: {
        version,
        size,
        totalTables,
        database: destinationConfig.database,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get all tables in the database
 */
async function getTables(destinationConfig) {
  const pool = getPool(destinationConfig);

  try {
    const client = await pool.connect();

    const result = await client.query(`
      SELECT
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    client.release();

    return {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get table statistics (row count, size)
 */
async function getTableStats(destinationConfig, schema, tableName) {
  const pool = getPool(destinationConfig);

  try {
    const client = await pool.connect();

    // Get row count
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`
    );
    const rowCount = parseInt(countResult.rows[0].count);

    // Get table size
    const sizeResult = await client.query(
      `SELECT pg_total_relation_size($1) as size`,
      [`"${schema}"."${tableName}"`]
    );
    const tableSize = parseInt(sizeResult.rows[0].size);

    // Get last modified (if updated_at column exists)
    let lastModified = null;
    try {
      const modifiedResult = await client.query(
        `SELECT MAX(updated_at) as last_modified FROM "${schema}"."${tableName}"`
      );
      lastModified = modifiedResult.rows[0].last_modified;
    } catch (e) {
      // Column doesn't exist, ignore
    }

    client.release();

    return {
      success: true,
      data: {
        rowCount,
        tableSize,
        lastModified,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get table schema
 */
async function getTableSchema(destinationConfig, schema, tableName) {
  const pool = getPool(destinationConfig);

  try {
    const client = await pool.connect();

    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, tableName]);

    client.release();

    return {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get sample data from table (first 10 rows)
 */
async function getSampleData(destinationConfig, schema, tableName) {
  const pool = getPool(destinationConfig);

  try {
    const client = await pool.connect();

    const result = await client.query(
      `SELECT * FROM "${schema}"."${tableName}" LIMIT 10`
    );

    client.release();

    return {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  testConnection,
  getDatabaseInfo,
  getTables,
  getTableStats,
  getTableSchema,
  getSampleData,
};
