-- =============================================
-- Connector Registry Tables
-- Created: 2024-11-26
-- =============================================

-- Connectors registry
CREATE TABLE IF NOT EXISTS public.connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL,
  class text NOT NULL,
  owner_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT connectors_pkey PRIMARY KEY (id),
  CONSTRAINT connectors_name_key UNIQUE (name),
  CONSTRAINT connectors_kind_check CHECK (kind = ANY (ARRAY['source'::text, 'sink'::text]))
);

-- Connector versions
CREATE TABLE IF NOT EXISTS public.connector_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL,
  version integer NOT NULL,
  config jsonb NOT NULL,
  schema_version text NOT NULL DEFAULT 'v1'::text,
  checksum character(64) NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  policy_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT connector_versions_pkey PRIMARY KEY (id),
  CONSTRAINT connector_versions_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connectors(id) ON DELETE CASCADE
);

-- Unique constraint for connector version
CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_versions_unique
ON public.connector_versions(connector_id, version);

-- Deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connector_version_id uuid NOT NULL,
  environment text NOT NULL,
  connect_cluster_url text NOT NULL,
  status text NOT NULL,
  status_msg text,
  deployed_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deployments_pkey PRIMARY KEY (id),
  CONSTRAINT deployments_status_check CHECK (status = ANY (ARRAY['pending'::text, 'deployed'::text, 'paused'::text, 'error'::text])),
  CONSTRAINT deployments_connector_version_id_fkey FOREIGN KEY (connector_version_id) REFERENCES public.connector_versions(id) ON DELETE CASCADE
);

-- Connection configs
CREATE TABLE IF NOT EXISTS public.connection_configs (
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
  connection_status text DEFAULT 'inactive'::text,
  total_tables integer DEFAULT 0,
  database_size bigint DEFAULT 0,
  CONSTRAINT connection_configs_pkey PRIMARY KEY (id),
  CONSTRAINT connection_configs_status_check CHECK (connection_status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text]))
);

-- Validation results
CREATE TABLE IF NOT EXISTS public.validation_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  checked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT validation_results_pkey PRIMARY KEY (id),
  CONSTRAINT validation_results_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connection_configs(id) ON DELETE CASCADE
);

-- Mapping configs
CREATE TABLE IF NOT EXISTS public.mapping_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  source_schema text NOT NULL,
  source_table text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT mapping_configs_pkey PRIMARY KEY (id),
  CONSTRAINT mapping_configs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Job runs
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  kind text NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running'::text,
  latency_ms bigint DEFAULT 0,
  summary jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT job_runs_pkey PRIMARY KEY (id),
  CONSTRAINT job_runs_kind_check CHECK (kind = ANY (ARRAY['precheck'::text, 'seed'::text, 'incremental'::text])),
  CONSTRAINT job_runs_status_check CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text])),
  CONSTRAINT job_runs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Precheck results
CREATE TABLE IF NOT EXISTS public.precheck_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  scope text NOT NULL,
  name text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT precheck_results_pkey PRIMARY KEY (id),
  CONSTRAINT precheck_results_scope_check CHECK (scope = ANY (ARRAY['source'::text, 'destination'::text])),
  CONSTRAINT precheck_results_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connectors_kind ON public.connectors(kind);
CREATE INDEX IF NOT EXISTS idx_connector_versions_connector_id ON public.connector_versions(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_versions_is_active ON public.connector_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_deployments_connector_version_id ON public.deployments(connector_version_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON public.deployments(status);
CREATE INDEX IF NOT EXISTS idx_connection_configs_user_id ON public.connection_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_pipeline_id ON public.job_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON public.job_runs(status);
