/*
  # Create Pipeline Slack Channels Table

  ## Changes
  - Create pipeline_slack_channels table to link pipelines with slack integrations
  - Add foreign keys to pipelines and slack_integrations
  - Add RLS policies for authenticated users

  ## Purpose
  Allows assigning multiple Slack channels to a pipeline for notifications
*/

-- Create pipeline_slack_channels table
CREATE TABLE IF NOT EXISTS pipeline_slack_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  slack_integration_id uuid NOT NULL REFERENCES slack_integrations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  -- Ensure a slack integration can only be assigned once per pipeline
  UNIQUE(pipeline_id, slack_integration_id)
);

-- Create indexes
CREATE INDEX idx_pipeline_slack_channels_pipeline ON pipeline_slack_channels(pipeline_id);
CREATE INDEX idx_pipeline_slack_channels_integration ON pipeline_slack_channels(slack_integration_id);

-- Enable RLS
ALTER TABLE pipeline_slack_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "auth_all_pipeline_slack_channels"
  ON pipeline_slack_channels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE pipeline_slack_channels IS 'Links pipelines with Slack integrations for notifications';
