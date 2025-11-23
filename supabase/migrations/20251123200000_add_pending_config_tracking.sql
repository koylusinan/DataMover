/*
  # Add Pending Config Tracking Columns

  ## Changes
  - Add pending_config_updated_by column to pipeline_connectors
  - Add pending_config_updated_at column to pipeline_connectors

  ## Purpose
  Track who and when made pending configuration changes
*/

-- Add pending_config_updated_by column
ALTER TABLE pipeline_connectors
ADD COLUMN IF NOT EXISTS pending_config_updated_by UUID REFERENCES auth.users(id);

-- Add pending_config_updated_at column
ALTER TABLE pipeline_connectors
ADD COLUMN IF NOT EXISTS pending_config_updated_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN pipeline_connectors.pending_config_updated_by IS 'User who last updated the pending configuration';
COMMENT ON COLUMN pipeline_connectors.pending_config_updated_at IS 'Timestamp when pending configuration was last updated';
