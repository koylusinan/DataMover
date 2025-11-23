/*
  # Add Schedule Configuration to Pipelines

  ## Summary
  Adds a schedule_config column to the pipelines table to store scheduling information
  for pipeline execution.

  ## Changes Made
  1. New Columns
    - `schedule_config` (jsonb) - Stores schedule settings including frequency and time preferences
      Default: '{}'

  ## Notes
  - The schedule_config column will store JSON data with scheduling parameters
  - Existing rows will have an empty object as default value
*/

-- Add schedule_config column to pipelines table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipelines' AND column_name = 'schedule_config'
  ) THEN
    ALTER TABLE pipelines ADD COLUMN schedule_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN pipelines.schedule_config IS 'Stores scheduling configuration for pipeline execution (frequency, time preferences, etc.)';
