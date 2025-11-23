-- Add slack_webhook_url column to pipelines table
ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN pipelines.slack_webhook_url IS 'Slack incoming webhook URL for pipeline alerts and notifications';
