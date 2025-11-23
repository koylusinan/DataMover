/*
  # Enforce Single Source and Sink Connector Per Pipeline

  ## Summary
  This migration enforces the business rule that each pipeline can have exactly one source 
  connector and one sink connector.

  ## Changes Made

  1. Database Constraints
    - Add unique constraint on pipeline_connectors to ensure only one source per pipeline
    - Add unique constraint on pipeline_connectors to ensure only one sink per pipeline
    - These constraints prevent multiple source or sink connectors in the same pipeline

  2. Data Cleanup
    - Remove table-level connector relationships (table_source_connectors, table_sink_connectors)
    - These are no longer needed since connectors are at pipeline level only
    - All tables in a pipeline use the same source and sink connectors

  3. Notes
    - The old source_connector_id and sink_connector_id columns in pipeline_table_objects 
      are kept for backward compatibility but are no longer used
    - Connectors are now purely pipeline-level resources
*/

-- Add unique constraints to enforce single source and sink per pipeline
-- First, clean up any duplicate connectors (keep only the first one of each type)

-- Remove duplicate source connectors (keep only the oldest one per pipeline)
DELETE FROM pipeline_connectors pc1
WHERE pc1.type = 'source'
AND EXISTS (
  SELECT 1 FROM pipeline_connectors pc2
  WHERE pc2.pipeline_id = pc1.pipeline_id
  AND pc2.type = 'source'
  AND pc2.created_at < pc1.created_at
);

-- Remove duplicate sink connectors (keep only the oldest one per pipeline)
DELETE FROM pipeline_connectors pc1
WHERE pc1.type = 'sink'
AND EXISTS (
  SELECT 1 FROM pipeline_connectors pc2
  WHERE pc2.pipeline_id = pc1.pipeline_id
  AND pc2.type = 'sink'
  AND pc2.created_at < pc1.created_at
);

-- Add unique constraint for single source per pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_single_source 
ON pipeline_connectors(pipeline_id) 
WHERE type = 'source';

-- Add unique constraint for single sink per pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_single_sink 
ON pipeline_connectors(pipeline_id) 
WHERE type = 'sink';

-- Drop the junction tables as they're no longer needed
DROP TABLE IF EXISTS table_source_connectors CASCADE;
DROP TABLE IF EXISTS table_sink_connectors CASCADE;

-- Add helpful comment
COMMENT ON TABLE pipeline_connectors IS 'Each pipeline has exactly one source connector and one sink connector. All tables in the pipeline use these connectors.';
