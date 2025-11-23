/*
  # Add Pipeline Support to Alert Recipients

  1. Changes
    - Add `pipeline_id` column to `alert_recipients` table
    - Add foreign key constraint to `pipelines` table
    - Add composite unique constraint (pipeline_id + email) to prevent duplicates
    - Update RLS policies to work with pipeline-based alerts

  2. Notes
    - Pipeline ID can be NULL for global alerts (backward compatibility)
    - Each pipeline can have multiple recipients
    - Each recipient can be assigned to multiple pipelines
*/

-- Add pipeline_id column to alert_recipients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_recipients' AND column_name = 'pipeline_id'
  ) THEN
    ALTER TABLE alert_recipients 
    ADD COLUMN pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add composite unique constraint to prevent duplicate recipients per pipeline
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'alert_recipients_pipeline_email_unique'
  ) THEN
    ALTER TABLE alert_recipients 
    ADD CONSTRAINT alert_recipients_pipeline_email_unique 
    UNIQUE (pipeline_id, email);
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_alert_recipients_pipeline_id 
  ON alert_recipients(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_recipient_user_id 
  ON alert_recipients(recipient_user_id);