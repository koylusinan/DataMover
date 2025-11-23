/*
  # Add Pending Configuration Support
  
  ## Overview
  Adds support for tracking pending configuration changes before deployment.
  
  ## Changes
  1. Add `pending_config` column to track uncommitted configuration changes
  2. Add `has_pending_changes` column to quickly identify connectors with pending updates
  3. Add `last_deployed_at` column to track when the configuration was last deployed
  
  ## Usage
  - When user clicks "Save All", configuration is saved to `pending_config`
  - `has_pending_changes` is set to true
  - When user clicks "Deploy", `pending_config` is copied to `config` and deployed to Debezium
  - `has_pending_changes` is set to false after successful deployment
*/

-- Add pending_config column to pipeline_connectors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_connectors' AND column_name = 'pending_config'
  ) THEN
    ALTER TABLE pipeline_connectors ADD COLUMN pending_config jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add has_pending_changes flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_connectors' AND column_name = 'has_pending_changes'
  ) THEN
    ALTER TABLE pipeline_connectors ADD COLUMN has_pending_changes boolean DEFAULT false;
  END IF;
END $$;

-- Add last_deployed_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_connectors' AND column_name = 'last_deployed_at'
  ) THEN
    ALTER TABLE pipeline_connectors ADD COLUMN last_deployed_at timestamptz DEFAULT NULL;
  END IF;
END $$;