/*
  # Add 'deleted' Status to Pipelines

  ## Changes
  - Updates pipeline status constraint to include 'deleted' state
  - This status is used for soft-deleted pipelines that can be restored

  ## Status Lifecycle (updated)
  - draft: Initial creation, incomplete configuration
  - ready: Configuration complete, ready to deploy
  - running: Actively streaming data
  - paused: Temporarily stopped
  - idle: Deployed but not actively processing
  - seeding: Initial snapshot in progress
  - incremental: Processing incremental changes
  - error: Failed state requiring intervention
  - deleted: Soft-deleted, can be restored (NEW)
*/

-- Drop existing constraint
ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS pipelines_status_check;

-- Add updated constraint with 'deleted' status
ALTER TABLE pipelines ADD CONSTRAINT pipelines_status_check
  CHECK (status IN ('draft', 'ready', 'running', 'paused', 'idle', 'seeding', 'incremental', 'error', 'deleted'));

-- Update index to include deleted status for filtering
DROP INDEX IF EXISTS idx_pipelines_status_lookup;
CREATE INDEX IF NOT EXISTS idx_pipelines_status_lookup ON pipelines(status) WHERE status IN ('running', 'error', 'paused', 'deleted');
