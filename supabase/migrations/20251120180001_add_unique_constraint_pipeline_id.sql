/*
  # Add Unique Constraint on pipeline_id

  This migration adds a unique constraint on pipeline_id column in alert_preferences table.
  This ensures that each pipeline can have only one alert preferences configuration.

  Required for the upsert operation with ON CONFLICT clause.
*/

-- Add unique constraint on pipeline_id
CREATE UNIQUE INDEX IF NOT EXISTS alert_preferences_pipeline_id_unique
ON alert_preferences(pipeline_id);
