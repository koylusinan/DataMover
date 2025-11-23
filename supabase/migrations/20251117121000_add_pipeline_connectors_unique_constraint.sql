/*
  # Add Unique Constraint to Pipeline Connectors

  ## Changes
  - Adds unique constraint on (pipeline_id, type) to ensure only one source and one sink per pipeline
  - This prevents duplicate connector entries and supports upsert operations

  ## Benefits
  - Ensures data integrity
  - Enables safe upsert operations during deployment
  - Prevents connector duplication
*/

-- Add unique constraint on pipeline_id and type
ALTER TABLE pipeline_connectors
  ADD CONSTRAINT unique_pipeline_connector_type
  UNIQUE (pipeline_id, type);

-- Create index for faster lookups by pipeline_id
CREATE INDEX IF NOT EXISTS idx_pipeline_connectors_pipeline_type
  ON pipeline_connectors(pipeline_id, type);
