-- =============================================
-- Alert System Tables
-- Created: 2024-11-26
-- =============================================

-- Alert events
CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_events_pkey PRIMARY KEY (id),
  CONSTRAINT alert_events_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Alert preferences
CREATE TABLE IF NOT EXISTS public.alert_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  pipeline_connectivity_slack boolean DEFAULT false,
  pipeline_connectivity_dashboard boolean DEFAULT false,
  pipeline_job_failures_slack boolean DEFAULT false,
  pipeline_job_failures_dashboard boolean DEFAULT false,
  source_event_types_slack boolean DEFAULT false,
  source_event_types_dashboard boolean DEFAULT false,
  failed_events_summary_slack boolean DEFAULT false,
  failed_events_summary_dashboard boolean DEFAULT false,
  webhooks_slack boolean DEFAULT false,
  webhooks_dashboard boolean DEFAULT false,
  pipeline_loading_status_slack boolean DEFAULT false,
  pipeline_loading_status_dashboard boolean DEFAULT false,
  source_side_events_slack boolean DEFAULT false,
  source_side_events_dashboard boolean DEFAULT false,
  data_spike_alert_slack boolean DEFAULT false,
  data_spike_alert_dashboard boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  pipeline_id uuid,
  CONSTRAINT alert_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT alert_preferences_user_id_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT alert_preferences_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Unique constraint: one preference per user per pipeline (or global if pipeline_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_preferences_unique
ON public.alert_preferences(created_by, COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Alert recipients
CREATE TABLE IF NOT EXISTS public.alert_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  is_external boolean DEFAULT true,
  recipient_user_id uuid,
  pipeline_id uuid,
  channels text[] NOT NULL DEFAULT ARRAY['email'::text],
  slack_webhook_url text,
  CONSTRAINT alert_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT alert_recipients_channels_check CHECK (array_length(channels, 1) > 0),
  CONSTRAINT alert_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT alert_recipients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT alert_recipients_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT alert_recipients_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_events_pipeline_id ON public.alert_events(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_resolved ON public.alert_events(resolved);
CREATE INDEX IF NOT EXISTS idx_alert_events_severity ON public.alert_events(severity);
CREATE INDEX IF NOT EXISTS idx_alert_events_alert_type ON public.alert_events(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON public.alert_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_created_by ON public.alert_preferences(created_by);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_pipeline_id ON public.alert_preferences(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_user_id ON public.alert_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_pipeline_id ON public.alert_recipients(pipeline_id);
