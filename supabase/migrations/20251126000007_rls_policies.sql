-- =============================================
-- Row Level Security Policies
-- Created: 2024-11-26
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_table_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_restore_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precheck_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_slack_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper function to check user role
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
  SELECT role FROM public.user_profiles WHERE id = user_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT public.get_user_role(auth.uid()) = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_maintainer_or_above()
RETURNS boolean AS $$
  SELECT public.get_user_role(auth.uid()) IN ('admin', 'maintainer');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- Pipelines Policies
-- =============================================
DROP POLICY IF EXISTS "pipelines_select" ON public.pipelines;
CREATE POLICY "pipelines_select" ON public.pipelines
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pipelines_insert" ON public.pipelines;
CREATE POLICY "pipelines_insert" ON public.pipelines
  FOR INSERT TO authenticated
  WITH CHECK (public.is_maintainer_or_above());

DROP POLICY IF EXISTS "pipelines_update" ON public.pipelines;
CREATE POLICY "pipelines_update" ON public.pipelines
  FOR UPDATE TO authenticated
  USING (public.is_maintainer_or_above());

DROP POLICY IF EXISTS "pipelines_delete" ON public.pipelines;
CREATE POLICY "pipelines_delete" ON public.pipelines
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================
-- Pipeline Connectors Policies
-- =============================================
DROP POLICY IF EXISTS "pipeline_connectors_select" ON public.pipeline_connectors;
CREATE POLICY "pipeline_connectors_select" ON public.pipeline_connectors
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pipeline_connectors_insert" ON public.pipeline_connectors;
CREATE POLICY "pipeline_connectors_insert" ON public.pipeline_connectors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_maintainer_or_above());

DROP POLICY IF EXISTS "pipeline_connectors_update" ON public.pipeline_connectors;
CREATE POLICY "pipeline_connectors_update" ON public.pipeline_connectors
  FOR UPDATE TO authenticated
  USING (public.is_maintainer_or_above());

DROP POLICY IF EXISTS "pipeline_connectors_delete" ON public.pipeline_connectors;
CREATE POLICY "pipeline_connectors_delete" ON public.pipeline_connectors
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================
-- User Profiles Policies
-- =============================================
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;
CREATE POLICY "user_profiles_delete" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================
-- Alert Events Policies
-- =============================================
DROP POLICY IF EXISTS "alert_events_select" ON public.alert_events;
CREATE POLICY "alert_events_select" ON public.alert_events
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "alert_events_insert" ON public.alert_events;
CREATE POLICY "alert_events_insert" ON public.alert_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "alert_events_update" ON public.alert_events;
CREATE POLICY "alert_events_update" ON public.alert_events
  FOR UPDATE TO authenticated
  USING (public.is_maintainer_or_above());

-- =============================================
-- Alert Preferences Policies
-- =============================================
DROP POLICY IF EXISTS "alert_preferences_select" ON public.alert_preferences;
CREATE POLICY "alert_preferences_select" ON public.alert_preferences
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "alert_preferences_insert" ON public.alert_preferences;
CREATE POLICY "alert_preferences_insert" ON public.alert_preferences
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "alert_preferences_update" ON public.alert_preferences;
CREATE POLICY "alert_preferences_update" ON public.alert_preferences
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "alert_preferences_delete" ON public.alert_preferences;
CREATE POLICY "alert_preferences_delete" ON public.alert_preferences
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- =============================================
-- Slack Integrations Policies
-- =============================================
DROP POLICY IF EXISTS "slack_integrations_select" ON public.slack_integrations;
CREATE POLICY "slack_integrations_select" ON public.slack_integrations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "slack_integrations_insert" ON public.slack_integrations;
CREATE POLICY "slack_integrations_insert" ON public.slack_integrations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_maintainer_or_above());

DROP POLICY IF EXISTS "slack_integrations_update" ON public.slack_integrations;
CREATE POLICY "slack_integrations_update" ON public.slack_integrations
  FOR UPDATE TO authenticated
  USING (public.is_maintainer_or_above());

DROP POLICY IF EXISTS "slack_integrations_delete" ON public.slack_integrations;
CREATE POLICY "slack_integrations_delete" ON public.slack_integrations
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================
-- Monitoring Settings Policies
-- =============================================
DROP POLICY IF EXISTS "monitoring_settings_select" ON public.monitoring_settings;
CREATE POLICY "monitoring_settings_select" ON public.monitoring_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "monitoring_settings_update" ON public.monitoring_settings;
CREATE POLICY "monitoring_settings_update" ON public.monitoring_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin());

-- =============================================
-- Generic Read Policies for Supporting Tables
-- =============================================
-- Pipeline objects
DROP POLICY IF EXISTS "pipeline_objects_all" ON public.pipeline_objects;
CREATE POLICY "pipeline_objects_all" ON public.pipeline_objects FOR ALL TO authenticated USING (true);

-- Pipeline table objects
DROP POLICY IF EXISTS "pipeline_table_objects_all" ON public.pipeline_table_objects;
CREATE POLICY "pipeline_table_objects_all" ON public.pipeline_table_objects FOR ALL TO authenticated USING (true);

-- Pipeline tasks
DROP POLICY IF EXISTS "pipeline_tasks_all" ON public.pipeline_tasks;
CREATE POLICY "pipeline_tasks_all" ON public.pipeline_tasks FOR ALL TO authenticated USING (true);

-- Pipeline logs
DROP POLICY IF EXISTS "pipeline_logs_all" ON public.pipeline_logs;
CREATE POLICY "pipeline_logs_all" ON public.pipeline_logs FOR ALL TO authenticated USING (true);

-- Pipeline progress events
DROP POLICY IF EXISTS "pipeline_progress_events_all" ON public.pipeline_progress_events;
CREATE POLICY "pipeline_progress_events_all" ON public.pipeline_progress_events FOR ALL TO authenticated USING (true);

-- Pipeline restore staging
DROP POLICY IF EXISTS "pipeline_restore_staging_all" ON public.pipeline_restore_staging;
CREATE POLICY "pipeline_restore_staging_all" ON public.pipeline_restore_staging FOR ALL TO authenticated USING (true);

-- Connectors
DROP POLICY IF EXISTS "connectors_all" ON public.connectors;
CREATE POLICY "connectors_all" ON public.connectors FOR ALL TO authenticated USING (true);

-- Connector versions
DROP POLICY IF EXISTS "connector_versions_all" ON public.connector_versions;
CREATE POLICY "connector_versions_all" ON public.connector_versions FOR ALL TO authenticated USING (true);

-- Deployments
DROP POLICY IF EXISTS "deployments_all" ON public.deployments;
CREATE POLICY "deployments_all" ON public.deployments FOR ALL TO authenticated USING (true);

-- Connection configs
DROP POLICY IF EXISTS "connection_configs_all" ON public.connection_configs;
CREATE POLICY "connection_configs_all" ON public.connection_configs FOR ALL TO authenticated USING (true);

-- Validation results
DROP POLICY IF EXISTS "validation_results_all" ON public.validation_results;
CREATE POLICY "validation_results_all" ON public.validation_results FOR ALL TO authenticated USING (true);

-- Mapping configs
DROP POLICY IF EXISTS "mapping_configs_all" ON public.mapping_configs;
CREATE POLICY "mapping_configs_all" ON public.mapping_configs FOR ALL TO authenticated USING (true);

-- Job runs
DROP POLICY IF EXISTS "job_runs_all" ON public.job_runs;
CREATE POLICY "job_runs_all" ON public.job_runs FOR ALL TO authenticated USING (true);

-- Precheck results
DROP POLICY IF EXISTS "precheck_results_all" ON public.precheck_results;
CREATE POLICY "precheck_results_all" ON public.precheck_results FOR ALL TO authenticated USING (true);

-- User activity logs
DROP POLICY IF EXISTS "user_activity_logs_all" ON public.user_activity_logs;
CREATE POLICY "user_activity_logs_all" ON public.user_activity_logs FOR ALL TO authenticated USING (true);

-- Alert recipients
DROP POLICY IF EXISTS "alert_recipients_all" ON public.alert_recipients;
CREATE POLICY "alert_recipients_all" ON public.alert_recipients FOR ALL TO authenticated USING (true);

-- Pipeline slack channels
DROP POLICY IF EXISTS "pipeline_slack_channels_all" ON public.pipeline_slack_channels;
CREATE POLICY "pipeline_slack_channels_all" ON public.pipeline_slack_channels FOR ALL TO authenticated USING (true);
