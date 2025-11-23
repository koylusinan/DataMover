/*
  # Create slack_webhooks View

  ## Changes
  - Create a view named slack_webhooks that maps to slack_integrations
  - This provides backward compatibility for existing code

  ## Purpose
  Allows legacy code using slack_webhooks table name to work seamlessly
  with the new slack_integrations table structure
*/

-- Create slack_webhooks view for backward compatibility
CREATE OR REPLACE VIEW slack_webhooks AS
SELECT
  id,
  channel_name as name,
  webhook_url,
  description,
  user_id,
  user_id as created_by,
  is_active,
  created_at
FROM slack_integrations;

COMMENT ON VIEW slack_webhooks IS 'Backward compatibility view mapping to slack_integrations table';
