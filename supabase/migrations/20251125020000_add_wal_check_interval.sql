-- Add WAL check interval field to pipelines table
ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS wal_check_interval_seconds integer DEFAULT 60;

COMMENT ON COLUMN pipelines.wal_check_interval_seconds IS 'WAL size check interval in seconds (default: 60)';
