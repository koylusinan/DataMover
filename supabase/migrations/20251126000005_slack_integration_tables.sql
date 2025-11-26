-- =============================================
-- Slack Integration Tables
-- Created: 2024-11-26
-- =============================================

-- Slack integrations
CREATE TABLE IF NOT EXISTS public.slack_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_name text NOT NULL,
  webhook_url text NOT NULL,
  channel_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  name text,
  CONSTRAINT slack_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT slack_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE
);

-- Set default name to channel_name if not provided
CREATE OR REPLACE FUNCTION public.set_slack_integration_name()
RETURNS trigger AS $$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name := NEW.channel_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_slack_integration_name_trigger ON public.slack_integrations;
CREATE TRIGGER set_slack_integration_name_trigger
  BEFORE INSERT ON public.slack_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_slack_integration_name();

-- Pipeline slack channels (many-to-many)
CREATE TABLE IF NOT EXISTS public.pipeline_slack_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  slack_integration_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT pipeline_slack_channels_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_slack_channels_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE,
  CONSTRAINT pipeline_slack_channels_slack_integration_id_fkey FOREIGN KEY (slack_integration_id) REFERENCES public.slack_integrations(id) ON DELETE CASCADE,
  CONSTRAINT pipeline_slack_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unique constraint: one channel per pipeline-integration pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_slack_channels_unique
ON public.pipeline_slack_channels(pipeline_id, slack_integration_id);

-- View for easy webhook lookup
CREATE OR REPLACE VIEW public.slack_webhooks_view AS
SELECT
  si.id,
  si.user_id,
  si.workspace_name,
  si.webhook_url,
  si.channel_name,
  si.is_active,
  si.name,
  si.description,
  psc.pipeline_id
FROM public.slack_integrations si
LEFT JOIN public.pipeline_slack_channels psc ON si.id = psc.slack_integration_id
WHERE si.is_active = true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_integrations_user_id ON public.slack_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_integrations_is_active ON public.slack_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_pipeline_slack_channels_pipeline_id ON public.pipeline_slack_channels(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_slack_channels_slack_integration_id ON public.pipeline_slack_channels(slack_integration_id);
