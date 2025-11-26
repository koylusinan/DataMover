-- =============================================
-- Core Pipeline Tables
-- Created: 2024-11-26
-- =============================================

-- Pipelines table (main table)
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL,
  source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination_type text,
  destination_config jsonb DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'batch'::text,
  frequency_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  schedule_config jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamp with time zone,
  backup_retention_hours integer DEFAULT 24,
  restore_notification_minutes integer DEFAULT 60,
  restore_count integer NOT NULL DEFAULT 0,
  log_monitoring_slack boolean DEFAULT false,
  enable_log_monitoring boolean DEFAULT false,
  max_wal_size integer DEFAULT 1024,
  alert_threshold integer DEFAULT 80,
  wal_check_interval_seconds integer DEFAULT 60,
  CONSTRAINT pipelines_pkey PRIMARY KEY (id),
  CONSTRAINT pipelines_source_type_check CHECK (source_type = ANY (ARRAY['oracle'::text, 'postgres'::text, 'sqlserver'::text])),
  CONSTRAINT pipelines_mode_check CHECK (mode = ANY (ARRAY['batch'::text, 'log'::text, 'micro-batch'::text])),
  CONSTRAINT pipelines_status_check CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'running'::text, 'paused'::text, 'idle'::text, 'seeding'::text, 'incremental'::text, 'error'::text, 'deleted'::text])),
  CONSTRAINT pipelines_restore_count_check CHECK (restore_count >= 0)
);

-- Pipeline connectors
CREATE TABLE IF NOT EXISTS public.pipeline_connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid,
  name text NOT NULL,
  type text NOT NULL,
  connector_class text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'running'::text,
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
  CONSTRAINT pipeline_connectors_type_check CHECK (type = ANY (ARRAY['source'::text, 'sink'::text])),
  CONSTRAINT pipeline_connectors_status_check CHECK (status = ANY (ARRAY['running'::text, 'paused'::text, 'failed'::text])),
  CONSTRAINT pipeline_connectors_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE,
  CONSTRAINT pipeline_connectors_pending_config_updated_by_fkey FOREIGN KEY (pending_config_updated_by) REFERENCES auth.users(id)
);

-- Unique constraint for one source and one sink per pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_connectors_unique_type
ON public.pipeline_connectors(pipeline_id, type);

-- Pipeline objects (selected tables)
CREATE TABLE IF NOT EXISTS public.pipeline_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  included boolean DEFAULT true,
  stats jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT pipeline_objects_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_objects_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Pipeline table objects (detailed table info)
CREATE TABLE IF NOT EXISTS public.pipeline_table_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid,
  source_connector_id uuid,
  sink_connector_id uuid,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  status text DEFAULT 'streaming'::text,
  last_event_timestamp timestamp with time zone DEFAULT now(),
  row_count bigint DEFAULT 0,
  size_estimate text DEFAULT '0 KB'::text,
  last_sync_time timestamp with time zone DEFAULT now(),
  source_topic text,
  partition_count integer DEFAULT 1,
  destination_table text,
  snapshot_progress integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_table_objects_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_table_objects_status_check CHECK (status = ANY (ARRAY['snapshotting'::text, 'streaming'::text, 'paused'::text, 'error'::text])),
  CONSTRAINT pipeline_table_objects_snapshot_progress_check CHECK (snapshot_progress >= 0 AND snapshot_progress <= 100),
  CONSTRAINT pipeline_table_objects_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE,
  CONSTRAINT pipeline_table_objects_source_connector_id_fkey FOREIGN KEY (source_connector_id) REFERENCES public.pipeline_connectors(id) ON DELETE SET NULL,
  CONSTRAINT pipeline_table_objects_sink_connector_id_fkey FOREIGN KEY (sink_connector_id) REFERENCES public.pipeline_connectors(id) ON DELETE SET NULL
);

-- Pipeline tasks
CREATE TABLE IF NOT EXISTS public.pipeline_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_object_id uuid,
  task_number integer NOT NULL,
  status text DEFAULT 'running'::text,
  worker_id text,
  lag text,
  throughput text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_tasks_status_check CHECK (status = ANY (ARRAY['running'::text, 'paused'::text, 'failed'::text])),
  CONSTRAINT pipeline_tasks_table_object_id_fkey FOREIGN KEY (table_object_id) REFERENCES public.pipeline_table_objects(id) ON DELETE CASCADE
);

-- Pipeline logs
CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pipeline_id uuid NOT NULL,
  run_id uuid,
  ts timestamp with time zone DEFAULT now(),
  level text,
  message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT pipeline_logs_level_check CHECK (level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text])),
  CONSTRAINT pipeline_logs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Pipeline progress events
CREATE TABLE IF NOT EXISTS public.pipeline_progress_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'pending'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_progress_events_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_progress_events_event_type_check CHECK (event_type = ANY (ARRAY['source_connected'::text, 'ingesting_started'::text, 'staging_events'::text, 'loading_started'::text])),
  CONSTRAINT pipeline_progress_events_event_status_check CHECK (event_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])),
  CONSTRAINT pipeline_progress_events_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Pipeline restore staging
CREATE TABLE IF NOT EXISTS public.pipeline_restore_staging (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  connector_id uuid NOT NULL,
  connector_name text,
  connector_type text NOT NULL,
  connector_class text,
  registry_name text NOT NULL,
  version integer NOT NULL,
  checksum text,
  staged_config jsonb NOT NULL,
  diff jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_restore_staging_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_restore_staging_connector_type_check CHECK (connector_type = ANY (ARRAY['source'::text, 'sink'::text])),
  CONSTRAINT pipeline_restore_staging_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE,
  CONSTRAINT pipeline_restore_staging_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.pipeline_connectors(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON public.pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_deleted_at ON public.pipelines(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_connectors_pipeline_id ON public.pipeline_connectors(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_objects_pipeline_id ON public.pipeline_objects(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_table_objects_pipeline_id ON public.pipeline_table_objects(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_pipeline_id ON public.pipeline_logs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_ts ON public.pipeline_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_progress_events_pipeline_id ON public.pipeline_progress_events(pipeline_id);
