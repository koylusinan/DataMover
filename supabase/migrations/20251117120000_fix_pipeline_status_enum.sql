/*
  # Fix Pipeline Status Enum

  ## Changes
  - Updates pipeline status constraint to include 'running' and 'ready' states
  - These statuses are used throughout the application but were missing from the CHECK constraint

  ## Status Lifecycle
  - draft: Initial creation, incomplete configuration
  - ready: Configuration complete, ready to deploy
  - running: Actively streaming data
  - paused: Temporarily stopped
  - idle: Deployed but not actively processing
  - seeding: Initial snapshot in progress
  - incremental: Processing incremental changes
  - error: Failed state requiring intervention
*/

-- Drop existing constraint
ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS pipelines_status_check;

-- Add updated constraint with all valid statuses
ALTER TABLE pipelines ADD CONSTRAINT pipelines_status_check
  CHECK (status IN ('draft', 'ready', 'running', 'paused', 'idle', 'seeding', 'incremental', 'error'));

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_pipelines_status_lookup ON pipelines(status) WHERE status IN ('running', 'error', 'paused');
