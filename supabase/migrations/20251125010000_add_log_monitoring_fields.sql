-- Add log monitoring fields to pipelines table
ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS enable_log_monitoring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS max_wal_size integer DEFAULT 1024,
ADD COLUMN IF NOT EXISTS alert_threshold integer DEFAULT 80;

-- Add comments
COMMENT ON COLUMN pipelines.enable_log_monitoring IS 'Enable log monitoring for the pipeline';
COMMENT ON COLUMN pipelines.max_wal_size IS 'Maximum WAL size in MB';
COMMENT ON COLUMN pipelines.alert_threshold IS 'Alert threshold percentage (0-100)';
COMMENT ON COLUMN pipelines.log_monitoring_slack IS 'Send Slack notifications for log monitoring events';
