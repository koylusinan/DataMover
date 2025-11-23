/*
  # Fix Slack Integrations Schema

  ## Changes
  - Rename 'channel' column to 'channel_name' to match frontend expectations
  - Add 'description' column for additional channel information
  - Add 'name' column for webhook name (alias for channel_name)

  ## Purpose
  Aligns the slack_integrations table schema with what the frontend components expect
*/

-- Add description column
ALTER TABLE slack_integrations
ADD COLUMN IF NOT EXISTS description text;

-- Rename channel to channel_name
ALTER TABLE slack_integrations
RENAME COLUMN channel TO channel_name;

-- Add name column as alias for channel_name (for backward compatibility)
ALTER TABLE slack_integrations
ADD COLUMN IF NOT EXISTS name text GENERATED ALWAYS AS (channel_name) STORED;

COMMENT ON TABLE slack_integrations IS 'Stores Slack webhook integrations with channel names and descriptions';
