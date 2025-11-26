const oracledb = require('oracledb');

// Connection pools for each Oracle destination
const pools = new Map();

// Configure Oracle client
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

/**
 * Get or create a connection pool for an Oracle destination
 */
async function getPool(destinationConfig) {
  const { id, host, port, serviceName, username, password } = destinationConfig;

  // Use destination ID as pool key
  if (pools.has(id)) {
    return pools.get(id);
  }

  try {
    // Create connection string
    const connectString = `${host}:${port || 1521}/${serviceName}`;

    // Create new pool
    const pool = await oracledb.createPool({
      user: username,
      password: password,
      connectString: connectString,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
      poolTimeout: 30, // seconds
      queueTimeout: 5000, // milliseconds
      enableStatistics: true,
    });

    console.log(`Oracle connection pool created for destination ${id}`);
    pools.set(id, pool);
    return pool;
  } catch (error) {
    console.error(`Failed to create Oracle pool for destination ${id}:`, error);
    throw error;
  }
}

/**
 * Test Oracle connection
 */
async function testConnection(destinationConfig) {
  try {
    const pool = await getPool(destinationConfig);
    const connection = await pool.getConnection();

    const result = await connection.execute('SELECT * FROM V$VERSION WHERE BANNER LIKE \'Oracle%\'');

    connection.close();

    return {
      success: true,
      version: result.rows[0]?.BANNER || 'Unknown',
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
  try {
    const pool = await getPool(destinationConfig);
    const connection = await pool.getConnection();

    // Get version
    const versionResult = await connection.execute(
      'SELECT * FROM V$VERSION WHERE BANNER LIKE \'Oracle%\''
    );
    const version = versionResult.rows[0]?.BANNER || 'Unknown';

    // Get database size
    const sizeResult = await connection.execute(`
      SELECT SUM(bytes) as total_size
      FROM dba_data_files
    `);
    const size = parseInt(sizeResult.rows[0]?.TOTAL_SIZE || 0);

    // Get total tables count
    const tablesResult = await connection.execute(`
      SELECT COUNT(*) as count
      FROM all_tables
      WHERE owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DIP', 'ORACLE_OCM', 'DBSNMP', 'APPQOSSYS', 'WMSYS', 'EXFSYS', 'CTXSYS', 'XDB', 'ANONYMOUS', 'MDSYS', 'ORDSYS', 'ORDDATA', 'OLAPSYS')
    `);
    const totalTables = parseInt(tablesResult.rows[0]?.COUNT || 0);

    connection.close();

    return {
      success: true,
      data: {
        version,
        size,
        totalTables,
        serviceName: destinationConfig.serviceName,
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
  try {
    const pool = await getPool(destinationConfig);
    const connection = await pool.getConnection();

    const result = await connection.execute(`
      SELECT
        owner as table_schema,
        table_name,
        (SELECT COUNT(*) FROM all_tab_columns WHERE owner = t.owner AND table_name = t.table_name) as column_count
      FROM all_tables t
      WHERE owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DIP', 'ORACLE_OCM', 'DBSNMP', 'APPQOSSYS', 'WMSYS', 'EXFSYS', 'CTXSYS', 'XDB', 'ANONYMOUS', 'MDSYS', 'ORDSYS', 'ORDDATA', 'OLAPSYS')
      ORDER BY owner, table_name
    `);

    connection.close();

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
  try {
    const pool = await getPool(destinationConfig);
    const connection = await pool.getConnection();

    // Get row count
    const countResult = await connection.execute(
      `SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`
    );
    const rowCount = parseInt(countResult.rows[0]?.COUNT || 0);

    // Get table size
    const sizeResult = await connection.execute(
      `SELECT SUM(bytes) as size
       FROM dba_segments
       WHERE owner = :schema AND segment_name = :tableName`,
      { schema, tableName }
    );
    const tableSize = parseInt(sizeResult.rows[0]?.SIZE || 0);

    // Get last analyzed time
    const analyzedResult = await connection.execute(
      `SELECT last_analyzed
       FROM all_tables
       WHERE owner = :schema AND table_name = :tableName`,
      { schema, tableName }
    );
    const lastModified = analyzedResult.rows[0]?.LAST_ANALYZED || null;

    connection.close();

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
  try {
    const pool = await getPool(destinationConfig);
    const connection = await pool.getConnection();

    const result = await connection.execute(`
      SELECT
        column_name,
        data_type,
        data_length as character_maximum_length,
        nullable as is_nullable,
        data_default as column_default
      FROM all_tab_columns
      WHERE owner = :schema AND table_name = :tableName
      ORDER BY column_id
    `, { schema, tableName });

    connection.close();

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
  try {
    const pool = await getPool(destinationConfig);
    const connection = await pool.getConnection();

    const result = await connection.execute(
      `SELECT * FROM "${schema}"."${tableName}" WHERE ROWNUM <= 10`
    );

    connection.close();

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
 * Close a specific pool
 */
async function closePool(destinationId) {
  if (pools.has(destinationId)) {
    const pool = pools.get(destinationId);
    try {
      await pool.close(10); // Wait 10 seconds for connections to close
      pools.delete(destinationId);
      console.log(`Oracle pool closed for destination ${destinationId}`);
    } catch (error) {
      console.error(`Error closing Oracle pool for destination ${destinationId}:`, error);
    }
  }
}

/**
 * Close all pools
 */
async function closeAllPools() {
  const closePromises = [];
  for (const [id, pool] of pools.entries()) {
    closePromises.push(
      pool.close(10).catch((err) => {
        console.error(`Error closing Oracle pool ${id}:`, err);
      })
    );
  }
  await Promise.all(closePromises);
  pools.clear();
  console.log('All Oracle pools closed');
}

/**
 * Get pool statistics
 */
async function getPoolStats(destinationId) {
  if (!pools.has(destinationId)) {
    return null;
  }

  const pool = pools.get(destinationId);
  return {
    connectionsInUse: pool.connectionsInUse,
    connectionsOpen: pool.connectionsOpen,
    poolMin: pool.poolMin,
    poolMax: pool.poolMax,
    poolIncrement: pool.poolIncrement,
    poolTimeout: pool.poolTimeout,
    queueTimeout: pool.queueTimeout,
  };
}

module.exports = {
  testConnection,
  getDatabaseInfo,
  getTables,
  getTableStats,
  getTableSchema,
  getSampleData,
  closePool,
  closeAllPools,
  getPoolStats,
};
