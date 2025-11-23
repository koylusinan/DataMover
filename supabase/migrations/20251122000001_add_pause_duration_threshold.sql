-- Add pause_duration_seconds threshold to monitoring_settings
ALTER TABLE monitoring_settings
ADD COLUMN IF NOT EXISTS pause_duration_seconds INTEGER NOT NULL DEFAULT 5;

-- Update the existing row to have the default value
UPDATE monitoring_settings
SET pause_duration_seconds = 5
WHERE pause_duration_seconds IS NULL;
