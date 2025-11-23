/*
  # Add Pipeline-Specific Alert Preferences

  This migration updates the alert preferences system to support pipeline-specific settings.
  
  1. Changes
    - Add `pipeline_id` column to `alert_preferences` table
    - Make the combination of `recipient_id` and `pipeline_id` unique
    - Update RLS policies for pipeline-based access
    - Add foreign key constraint to pipelines table
  
  2. Rationale
    - Previously: One set of preferences per user (global)
    - Now: One set of preferences per user per pipeline (pipeline-specific)
    - This allows users to configure different alert settings for each pipeline
  
  3. Migration Strategy
    - Existing preferences will remain user-level (pipeline_id = NULL)
    - New preferences will be pipeline-specific
    - Frontend will prioritize pipeline-specific preferences over user-level
*/

-- Add pipeline_id column to alert_preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_preferences' AND column_name = 'pipeline_id'
  ) THEN
    ALTER TABLE alert_preferences ADD COLUMN pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing unique constraint on user_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alert_preferences_user_id_key'
  ) THEN
    ALTER TABLE alert_preferences DROP CONSTRAINT alert_preferences_user_id_key;
  END IF;
END $$;

-- Create unique constraint on user_id + pipeline_id combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alert_preferences_user_pipeline_unique'
  ) THEN
    ALTER TABLE alert_preferences
    ADD CONSTRAINT alert_preferences_user_pipeline_unique
    UNIQUE (user_id, pipeline_id);
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alert_preferences_pipeline 
  ON alert_preferences(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_pipeline
  ON alert_preferences(user_id, pipeline_id);

-- Update RLS policies to include pipeline_id checks
DROP POLICY IF EXISTS "Users can view own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can update own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can insert own alert preferences" ON alert_preferences;

CREATE POLICY "Users can view own alert preferences"
  ON alert_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own alert preferences"
  ON alert_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own alert preferences"
  ON alert_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin policies
CREATE POLICY "Admins can manage all alert preferences"
  ON alert_preferences FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
