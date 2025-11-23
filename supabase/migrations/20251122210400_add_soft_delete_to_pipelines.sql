-- Add soft delete and backup retention to pipelines table
ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS backup_retention_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS restore_notification_minutes INTEGER DEFAULT 60;

-- Add index for cleanup job performance
CREATE INDEX IF NOT EXISTS idx_pipelines_deleted_at ON pipelines(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN pipelines.deleted_at IS 'Timestamp when pipeline was soft-deleted. NULL means active pipeline.';
COMMENT ON COLUMN pipelines.backup_retention_hours IS 'Hours to keep deleted pipeline before permanent deletion (1-24)';
COMMENT ON COLUMN pipelines.restore_notification_minutes IS 'Minutes before deletion to show restore warning (1-60)';
