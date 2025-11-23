-- Add backup_retention_hours to monitoring_settings table
-- This controls how long soft-deleted pipelines are kept before permanent deletion
ALTER TABLE monitoring_settings
ADD COLUMN IF NOT EXISTS backup_retention_hours INTEGER NOT NULL DEFAULT 24
CHECK (backup_retention_hours >= 1 AND backup_retention_hours <= 24);

-- Update existing row with default value
UPDATE monitoring_settings
SET backup_retention_hours = 24
WHERE backup_retention_hours IS NULL;

-- Add comment
COMMENT ON COLUMN monitoring_settings.backup_retention_hours IS 'Global setting: Hours to keep soft-deleted pipelines before permanent deletion (1-24). Default 24 hours.';
