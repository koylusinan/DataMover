-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alert_events (
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
  CONSTRAINT alert_events_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.alert_preferences (
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
  CONSTRAINT alert_preferences_user_id_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id),
  CONSTRAINT alert_preferences_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.alert_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  is_external boolean DEFAULT true,
  recipient_user_id uuid,
  pipeline_id uuid,
  channels ARRAY NOT NULL DEFAULT ARRAY['email'::text] CHECK (array_length(channels, 1) > 0),
  slack_webhook_url text,
  CONSTRAINT alert_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT alert_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id),
  CONSTRAINT alert_recipients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id),
  CONSTRAINT alert_recipients_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.user_profiles(id),
  CONSTRAINT alert_recipients_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.connection_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  db_type text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 5432,
  database_name text NOT NULL,
  username text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  database_version text,
  last_connection_check timestamp with time zone,
  connection_status text DEFAULT 'inactive'::text CHECK (connection_status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text])),
  total_tables integer DEFAULT 0,
  database_size bigint DEFAULT 0,
  CONSTRAINT connection_configs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.connector_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL,
  version integer NOT NULL,
  config jsonb NOT NULL,
  schema_version text NOT NULL DEFAULT 'v1'::text,
  checksum character NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  policy_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT connector_versions_pkey PRIMARY KEY (id),
  CONSTRAINT connector_versions_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connectors(id)
);
CREATE TABLE public.connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['source'::text, 'sink'::text])),
  class text NOT NULL,
  owner_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT connectors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.deployments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_version_id uuid NOT NULL,
  environment text NOT NULL,
  connect_cluster_url text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'deployed'::text, 'paused'::text, 'error'::text])),
  status_msg text,
  deployed_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deployments_pkey PRIMARY KEY (id),
  CONSTRAINT deployments_connector_version_id_fkey FOREIGN KEY (connector_version_id) REFERENCES public.connector_versions(id)
);
CREATE TABLE public.job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['precheck'::text, 'seed'::text, 'incremental'::text])),
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text])),
  latency_ms bigint DEFAULT 0,
  summary jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT job_runs_pkey PRIMARY KEY (id),
  CONSTRAINT job_runs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.mapping_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  source_schema text NOT NULL,
  source_table text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT mapping_configs_pkey PRIMARY KEY (id),
  CONSTRAINT mapping_configs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.monitoring_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lag_ms integer NOT NULL DEFAULT 5000,
  throughput_drop_percent integer NOT NULL DEFAULT 50,
  error_rate_percent integer NOT NULL DEFAULT 1,
  dlq_count integer NOT NULL DEFAULT 0,
  check_interval_ms integer NOT NULL DEFAULT 60000,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  pause_duration_seconds integer NOT NULL DEFAULT 5,
  backup_retention_hours integer NOT NULL DEFAULT 24 CHECK (backup_retention_hours >= 1 AND backup_retention_hours <= 24),
  CONSTRAINT monitoring_settings_pkey PRIMARY KEY (id),
  CONSTRAINT monitoring_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.pipeline_connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['source'::text, 'sink'::text])),
  connector_class text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'paused'::text, 'failed'::text])),
  tasks_max integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_deployed_version integer,
  pending_config jsonb,
  has_pending_changes boolean DEFAULT false,
  last_deployed_at timestamp with time zone,
  pending_config_updated_by uuid,
  pending_config_updated_at timestamp with time zone,
  CONSTRAINT pipeline_connectors_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_connectors_pending_config_updated_by_fkey FOREIGN KEY (pending_config_updated_by) REFERENCES auth.users(id),
  CONSTRAINT pipeline_connectors_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.pipeline_logs (
  id bigint NOT NULL DEFAULT nextval('pipeline_logs_id_seq'::regclass),
  pipeline_id uuid NOT NULL,
  run_id uuid,
  ts timestamp with time zone DEFAULT now(),
  level text CHECK (level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text])),
  message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT pipeline_logs_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_logs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.pipeline_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  included boolean DEFAULT true,
  stats jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT pipeline_objects_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_objects_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.pipeline_progress_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['source_connected'::text, 'ingesting_started'::text, 'staging_events'::text, 'loading_started'::text])),
  event_status text NOT NULL DEFAULT 'pending'::text CHECK (event_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_progress_events_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_progress_events_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.pipeline_restore_staging (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  connector_id uuid NOT NULL,
  connector_name text,
  connector_type text NOT NULL CHECK (connector_type = ANY (ARRAY['source'::text, 'sink'::text])),
  connector_class text,
  registry_name text NOT NULL,
  version integer NOT NULL,
  checksum text,
  staged_config jsonb NOT NULL,
  diff jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_restore_staging_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_restore_staging_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id),
  CONSTRAINT pipeline_restore_staging_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.pipeline_connectors(id)
);
CREATE TABLE public.pipeline_slack_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  slack_integration_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT pipeline_slack_channels_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_slack_channels_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id),
  CONSTRAINT pipeline_slack_channels_slack_integration_id_fkey FOREIGN KEY (slack_integration_id) REFERENCES public.slack_integrations(id),
  CONSTRAINT pipeline_slack_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.pipeline_table_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid,
  source_connector_id uuid,
  sink_connector_id uuid,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  status text DEFAULT 'streaming'::text CHECK (status = ANY (ARRAY['snapshotting'::text, 'streaming'::text, 'paused'::text, 'error'::text])),
  last_event_timestamp timestamp with time zone DEFAULT now(),
  row_count bigint DEFAULT 0,
  size_estimate text DEFAULT '0 KB'::text,
  last_sync_time timestamp with time zone DEFAULT now(),
  source_topic text,
  partition_count integer DEFAULT 1,
  destination_table text,
  snapshot_progress integer DEFAULT 0 CHECK (snapshot_progress >= 0 AND snapshot_progress <= 100),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_table_objects_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_table_objects_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id),
  CONSTRAINT pipeline_table_objects_source_connector_id_fkey FOREIGN KEY (source_connector_id) REFERENCES public.pipeline_connectors(id),
  CONSTRAINT pipeline_table_objects_sink_connector_id_fkey FOREIGN KEY (sink_connector_id) REFERENCES public.pipeline_connectors(id)
);
CREATE TABLE public.pipeline_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_object_id uuid,
  task_number integer NOT NULL,
  status text DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'paused'::text, 'failed'::text])),
  worker_id text,
  lag text,
  throughput text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_tasks_table_object_id_fkey FOREIGN KEY (table_object_id) REFERENCES public.pipeline_table_objects(id)
);
CREATE TABLE public.pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['oracle'::text, 'postgres'::text, 'sqlserver'::text])),
  source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination_type text,
  destination_config jsonb DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'batch'::text CHECK (mode = ANY (ARRAY['batch'::text, 'log'::text, 'micro-batch'::text])),
  frequency_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'running'::text, 'paused'::text, 'idle'::text, 'seeding'::text, 'incremental'::text, 'error'::text, 'deleted'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  schedule_config jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamp with time zone,
  backup_retention_hours integer DEFAULT 24,
  restore_notification_minutes integer DEFAULT 60,
  restore_count integer NOT NULL DEFAULT 0 CHECK (restore_count >= 0),
  log_monitoring_slack boolean DEFAULT false,
  enable_log_monitoring boolean DEFAULT false,
  max_wal_size integer DEFAULT 1024,
  alert_threshold integer DEFAULT 80,
  wal_check_interval_seconds integer DEFAULT 60,
  CONSTRAINT pipelines_pkey PRIMARY KEY (id)
);
CREATE TABLE public.precheck_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope = ANY (ARRAY['source'::text, 'destination'::text])),
  name text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT precheck_results_pkey PRIMARY KEY (id),
  CONSTRAINT precheck_results_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id)
);
CREATE TABLE public.slack_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_name text NOT NULL,
  webhook_url text NOT NULL,
  channel_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  name text DEFAULT channel_name,
  CONSTRAINT slack_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT slack_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  action_description text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  role text NOT NULL DEFAULT 'read_only'::text CHECK (role = ANY (ARRAY['admin'::text, 'maintainer'::text, 'read_only'::text])),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.validation_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  checked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT validation_results_pkey PRIMARY KEY (id),
  CONSTRAINT validation_results_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connection_configs(id)
);