/*
  # Fix Alert Preferences Unique Constraint

  This migration removes the old user_id unique constraint that prevents
  multiple preferences per user (which we need for pipeline-specific preferences).

  1. Changes
    - Drop `alert_preferences_user_id_key` constraint
    - This allows multiple alert_preferences records per user (one per pipeline)
    - The new `alert_preferences_recipient_pipeline_unique` constraint handles uniqueness
  
  2. Rationale
    - Old constraint: user_id must be unique (one preference per user)
    - New constraint: (recipient_id, pipeline_id) must be unique (one preference per user per pipeline)
*/

-- Drop the old user_id unique constraint
ALTER TABLE alert_preferences DROP CONSTRAINT IF EXISTS alert_preferences_user_id_key;
