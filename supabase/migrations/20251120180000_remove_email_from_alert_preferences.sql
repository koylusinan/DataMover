/*
  # Remove Email Columns from Alert Preferences

  This migration removes all email-related columns from alert_preferences table.
  We're moving to a Slack-only notification system where users are managed through Slack channels.

  Changes:
  - Remove all *_email columns
  - Keep only *_slack and *_dashboard columns
  - Pipeline-specific alerts will be sent to assigned Slack channels
*/

-- Remove email columns
ALTER TABLE alert_preferences
DROP COLUMN IF EXISTS pipeline_connectivity_email,
DROP COLUMN IF EXISTS pipeline_job_failures_email,
DROP COLUMN IF EXISTS source_event_types_email,
DROP COLUMN IF EXISTS failed_events_summary_email,
DROP COLUMN IF EXISTS webhooks_email,
DROP COLUMN IF EXISTS pipeline_loading_status_email,
DROP COLUMN IF EXISTS source_side_events_email,
DROP COLUMN IF EXISTS data_spike_alert_email;

-- Rename user_id to created_by for clarity (optional)
-- This tracks who created the preferences, not who receives them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_preferences' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE alert_preferences RENAME COLUMN user_id TO created_by;
  END IF;
END $$;

-- Update policies to use created_by
DROP POLICY IF EXISTS "Users can view own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can insert own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can update own alert preferences" ON alert_preferences;

CREATE POLICY "Users can view own alert preferences"
  ON alert_preferences FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own alert preferences"
  ON alert_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own alert preferences"
  ON alert_preferences FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
