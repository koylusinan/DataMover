-- Add log monitoring preferences to pipelines table
ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS log_monitoring_slack boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN pipelines.log_monitoring_slack IS 'Send Slack notifications for log monitoring events';
