/*
  # Add alert channels to alert recipients

  1. Changes
    - Add `channels` column to `alert_recipients` table
      - Stores array of channel types: email, slack, dashboard
      - Default is ['email']
    - Add `slack_webhook_url` column for Slack integration
    - Add check constraint to ensure at least one channel is selected

  2. Notes
    - Channels can be: 'email', 'slack', 'dashboard'
    - Multiple channels can be selected per recipient
    - Email channel is default for backward compatibility
*/

-- Add channels column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_recipients' AND column_name = 'channels'
  ) THEN
    ALTER TABLE alert_recipients 
    ADD COLUMN channels text[] DEFAULT ARRAY['email']::text[] NOT NULL;
  END IF;
END $$;

-- Add slack webhook URL column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_recipients' AND column_name = 'slack_webhook_url'
  ) THEN
    ALTER TABLE alert_recipients 
    ADD COLUMN slack_webhook_url text;
  END IF;
END $$;

-- Add check constraint to ensure at least one channel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'alert_recipients_channels_not_empty'
  ) THEN
    ALTER TABLE alert_recipients
    ADD CONSTRAINT alert_recipients_channels_not_empty 
    CHECK (array_length(channels, 1) > 0);
  END IF;
END $$;

-- Update existing records to have email channel
UPDATE alert_recipients
SET channels = ARRAY['email']::text[]
WHERE channels IS NULL OR array_length(channels, 1) IS NULL;