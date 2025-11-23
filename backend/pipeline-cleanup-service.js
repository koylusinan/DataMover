/**
 * Pipeline Cleanup Service
 *
 * Automatically deletes pipelines that have been soft-deleted and exceeded their retention period.
 * Runs every hour to check for expired pipelines.
 */

import pg from 'pg';

const { Pool: PgPool } = pg;

const pool = new PgPool({
  host: process.env.SUPABASE_DB_HOST || '127.0.0.1',
  port: Number(process.env.SUPABASE_DB_PORT || 54322),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'postgres',
  ssl: process.env.SUPABASE_DB_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

const LOG_PREFIX = '[Pipeline Cleanup]';

/**
 * Delete expired pipelines permanently from the database
 */
async function cleanupExpiredPipelines() {
  const client = await pool.connect();

  try {
    // Find pipelines that are soft-deleted and have exceeded their retention period
    const query = `
      SELECT
        id,
        name,
        deleted_at,
        backup_retention_hours,
        (deleted_at + (backup_retention_hours || ' hours')::interval) AS deletion_time
      FROM pipelines
      WHERE deleted_at IS NOT NULL
        AND (deleted_at + (COALESCE(backup_retention_hours, 24) || ' hours')::interval) <= NOW()
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log(`${LOG_PREFIX} No expired pipelines found`);
      return { deleted: 0, errors: [] };
    }

    console.log(`${LOG_PREFIX} Found ${result.rows.length} expired pipeline(s) to delete`);

    const deleted = [];
    const errors = [];

    for (const row of result.rows) {
      try {
        console.log(`${LOG_PREFIX} Deleting pipeline: ${row.name} (ID: ${row.id})`);

        // Delete pipeline connectors first (foreign key constraint)
        await client.query('DELETE FROM pipeline_connectors WHERE pipeline_id = $1', [row.id]);

        // Delete any restore staging data
        await client.query('DELETE FROM pipeline_restore_staging WHERE pipeline_id = $1', [row.id]);

        // Delete the pipeline itself
        await client.query('DELETE FROM pipelines WHERE id = $1', [row.id]);

        deleted.push({ id: row.id, name: row.name });
        console.log(`${LOG_PREFIX} Successfully deleted pipeline: ${row.name}`);
      } catch (err) {
        console.error(`${LOG_PREFIX} Failed to delete pipeline ${row.name}:`, err);
        errors.push({ id: row.id, name: row.name, error: err.message });
      }
    }

    return { deleted, errors };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during cleanup:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Start the cleanup service
 */
async function startCleanupService() {
  console.log(`${LOG_PREFIX} Starting pipeline cleanup service...`);
  console.log(`${LOG_PREFIX} Cleanup will run every hour`);

  // Run immediately on startup
  try {
    await cleanupExpiredPipelines();
  } catch (err) {
    console.error(`${LOG_PREFIX} Initial cleanup failed:`, err);
  }

  // Then run every hour
  setInterval(async () => {
    try {
      await cleanupExpiredPipelines();
    } catch (err) {
      console.error(`${LOG_PREFIX} Scheduled cleanup failed:`, err);
    }
  }, 60 * 60 * 1000); // 1 hour
}

export { cleanupExpiredPipelines, startCleanupService };
