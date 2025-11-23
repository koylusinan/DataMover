const { Pool } = require('pg');

// Connection pools for each destination
const pools = new Map();

/**
 * Get or create a connection pool for a destination
 */
function getPool(destinationConfig) {
  const { id, host, port, database, username, password } = destinationConfig;

  // Use destination ID as pool key
  if (pools.has(id)) {
    return pools.get(id);
  }

  // Create new pool
  const pool = new Pool({
    host,
    port: port || 5432,
    database,
    user: username,
    password,
    max: 5, // Maximum connections per destination
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error(`PostgreSQL pool error for destination ${id}:`, err);
  });

  pools.set(id, pool);
  return pool;
}

/**
 * Close a specific pool
 */
async function closePool(destinationId) {
  if (pools.has(destinationId)) {
    const pool = pools.get(destinationId);
    await pool.end();
    pools.delete(destinationId);
  }
}

/**
 * Close all pools
 */
async function closeAllPools() {
  const closePromises = [];
  for (const [id, pool] of pools.entries()) {
    closePromises.push(pool.end());
  }
  await Promise.all(closePromises);
  pools.clear();
}

module.exports = {
  getPool,
  closePool,
  closeAllPools,
};
