require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const postgresService = require('./connections/postgresql');
const { closeAllPools } = require('./utils/connectionPool');

const app = express();
const PORT = process.env.DATABASE_OPS_PORT || 3001;

// Helper function to map localhost to K8s host gateway
function mapHostForK8s(host) {
  if (host === 'localhost' || host === '127.0.0.1') {
    return process.env.K8S_HOST_GATEWAY || host;
  }
  return host;
}

// Direct PostgreSQL connection to Supabase database
const supabaseDbPool = new Pool({
  host: mapHostForK8s('localhost'),
  port: 54322,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
  max: 5,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'database-ops-backend' });
});

/**
 * Get connection config from pipeline's destination_config
 */
async function getConnectionConfig(pipelineId) {
  const client = await supabaseDbPool.connect();

  try {
    const result = await client.query(
      'SELECT destination_type, destination_config, source_config FROM pipelines WHERE id = $1',
      [pipelineId]
    );

    if (result.rows.length === 0) {
      throw new Error('Pipeline not found');
    }

    const pipeline = result.rows[0];
    const destConfig = typeof pipeline.destination_config === 'string'
      ? JSON.parse(pipeline.destination_config)
      : pipeline.destination_config;

    const sourceConfig = typeof pipeline.source_config === 'string'
      ? JSON.parse(pipeline.source_config)
      : pipeline.source_config;

    // Normalize database type (postgres -> postgresql)
    let dbType = pipeline.destination_type || 'postgresql';
    if (dbType === 'postgres') {
      dbType = 'postgresql';
    }

    // Use source config for connection info (since source and destination use the same DB)
    const rawHost = sourceConfig.host || destConfig.host || '127.0.0.1';
    return {
      id: pipelineId,
      type: dbType,
      host: mapHostForK8s(rawHost),
      port: sourceConfig.port || destConfig.port || 5432,
      database: sourceConfig.database_name || destConfig.database || 'testdb',
      username: sourceConfig.username || destConfig.username || 'postgres',
      password: 'postgres', // Default password for local development
    };
  } finally {
    client.release();
  }
}

/**
 * Test connection (using pipeline ID)
 */
app.post('/api/pipelines/:id/connection-test', async (req, res) => {
  try {
    const { id } = req.params;
    const connectionConfig = await getConnectionConfig(id);

    let result;
    if (connectionConfig.type === 'postgresql') {
      result = await postgresService.testConnection(connectionConfig);
    } else {
      return res.status(400).json({
        success: false,
        error: `Database type ${connectionConfig.type} not supported yet`,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get database information (using pipeline ID)
 */
app.get('/api/pipelines/:id/database-info', async (req, res) => {
  try {
    const { id } = req.params;
    const connectionConfig = await getConnectionConfig(id);

    let result;
    if (connectionConfig.type === 'postgresql') {
      result = await postgresService.getDatabaseInfo(connectionConfig);
    } else {
      return res.status(400).json({
        success: false,
        error: `Database type ${connectionConfig.type} not supported yet`,
      });
    }

    // TODO: Update connection_configs table with latest info if needed
    // (Currently commented out as this feature will be added later)

    res.json(result);
  } catch (error) {
    // TODO: Update connection status to error
    // (Currently commented out as this feature will be added later)

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get all tables
 */
app.get('/api/pipelines/:id/tables', async (req, res) => {
  try {
    const { id } = req.params;
    const connectionConfig = await getConnectionConfig(id);

    let result;
    if (connectionConfig.type === 'postgresql') {
      result = await postgresService.getTables(connectionConfig);
    } else {
      return res.status(400).json({
        success: false,
        error: `Database type ${connectionConfig.type} not supported yet`,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get table statistics
 */
app.get('/api/pipelines/:id/tables/:schema/:tableName/stats', async (req, res) => {
  try {
    const { id, schema, tableName } = req.params;
    const connectionConfig = await getConnectionConfig(id);

    let result;
    if (connectionConfig.type === 'postgresql') {
      result = await postgresService.getTableStats(connectionConfig, schema, tableName);
    } else {
      return res.status(400).json({
        success: false,
        error: `Database type ${connectionConfig.type} not supported yet`,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get table schema
 */
app.get('/api/pipelines/:id/tables/:schema/:tableName/schema', async (req, res) => {
  try {
    const { id, schema, tableName } = req.params;
    const connectionConfig = await getConnectionConfig(id);

    let result;
    if (connectionConfig.type === 'postgresql') {
      result = await postgresService.getTableSchema(connectionConfig, schema, tableName);
    } else {
      return res.status(400).json({
        success: false,
        error: `Database type ${connectionConfig.type} not supported yet`,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get sample data
 */
app.get('/api/pipelines/:id/tables/:schema/:tableName/sample', async (req, res) => {
  try {
    const { id, schema, tableName } = req.params;
    const connectionConfig = await getConnectionConfig(id);

    let result;
    if (connectionConfig.type === 'postgresql') {
      result = await postgresService.getSampleData(connectionConfig, schema, tableName);
    } else {
      return res.status(400).json({
        success: false,
        error: `Database type ${connectionConfig.type} not supported yet`,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get sink tables (CDC created tables)
 */
app.get('/api/pipelines/:id/sink-tables', async (req, res) => {
  try {
    const { id } = req.params;

    // Get connection config directly
    const connectionConfig = await getConnectionConfig(id);

    // Get all tables from database
    const tablesResult = await postgresService.getTables(connectionConfig);

    if (!tablesResult.success) {
      return res.json({ success: true, data: [] });
    }

    // Filter tables that match CDC pattern (topic names)
    const sinkTables = [];

    for (const table of tablesResult.data) {
      // CDC tables typically have format: schema.tablename or servername.schema.tablename
      // Get stats for each table
      const statsResult = await postgresService.getTableStats(
        connectionConfig,
        table.table_schema,
        table.table_name
      );

      if (statsResult.success) {
        sinkTables.push({
          schema: table.table_schema,
          tableName: table.table_name,
          rowCount: statsResult.data.rowCount,
          tableSize: statsResult.data.tableSize,
          lastModified: statsResult.data.lastModified,
          columnCount: table.column_count,
        });
      }
    }

    res.json({
      success: true,
      data: sinkTables,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections...');
  await closeAllPools();
  await supabaseDbPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connections...');
  await closeAllPools();
  await supabaseDbPool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Database Operations Backend running on port ${PORT}`);
});
