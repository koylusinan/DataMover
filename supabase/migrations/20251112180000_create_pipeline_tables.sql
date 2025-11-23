/*
  # Create Pipeline Management Schema

  ## Overview
  This migration creates the complete schema for pipeline lifecycle management including
  pipeline configurations, object selections, mappings, job runs, and logging.

  ## New Tables

  ### `pipelines`
  Stores pipeline configurations with source and destination settings
  - `id` (uuid, primary key) - Unique pipeline identifier
  - `user_id` (uuid) - Reference to authenticated user
  - `name` (text) - Pipeline name
  - `source_type` (text) - Database type: oracle, postgres, sqlserver
  - `source_config` (jsonb) - Source connection configuration
  - `destination_type` (text) - Destination type: postgres, snowflake, etc.
  - `destination_config` (jsonb) - Destination connection configuration
  - `mode` (text) - Ingestion mode: batch, log, micro-batch
  - `frequency_minutes` (integer) - Batch frequency in minutes
  - `status` (text) - Pipeline status: draft, seeding, incremental, idle, error, paused
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `pipeline_objects`
  Stores selected schemas and tables for each pipeline
  - `id` (uuid, primary key) - Unique identifier
  - `pipeline_id` (uuid, foreign key) - Reference to pipelines
  - `schema_name` (text) - Database schema name
  - `table_name` (text) - Table name
  - `included` (boolean) - Whether object is included in sync
  - `stats` (jsonb) - Object statistics (row count, size, etc.)

  ### `mapping_configs`
  Stores column mapping configurations for each table
  - `id` (uuid, primary key) - Unique identifier
  - `pipeline_id` (uuid, foreign key) - Reference to pipelines
  - `source_schema` (text) - Source schema name
  - `source_table` (text) - Source table name
  - `mapping` (jsonb) - Column mapping configuration

  ### `job_runs`
  Tracks execution history for all pipeline operations
  - `id` (uuid, primary key) - Unique run identifier
  - `pipeline_id` (uuid, foreign key) - Reference to pipelines
  - `kind` (text) - Run type: precheck, seed, incremental
  - `started_at` (timestamptz) - Run start timestamp
  - `finished_at` (timestamptz) - Run completion timestamp
  - `status` (text) - Run status: running, success, error
  - `latency_ms` (bigint) - Execution latency in milliseconds
  - `summary` (jsonb) - Run summary data

  ### `pipeline_logs`
  Detailed logging for all pipeline operations
  - `id` (bigserial, primary key) - Unique log identifier
  - `pipeline_id` (uuid, foreign key) - Reference to pipelines
  - `run_id` (uuid) - Reference to job_runs
  - `ts` (timestamptz) - Log timestamp
  - `level` (text) - Log level: debug, info, warn, error
  - `message` (text) - Log message
  - `context` (jsonb) - Additional context data

  ### `precheck_results`
  Stores pre-check validation results for sources and destinations
  - `id` (uuid, primary key) - Unique identifier
  - `pipeline_id` (uuid, foreign key) - Reference to pipelines
  - `scope` (text) - Check scope: source, destination
  - `name` (text) - Check name (e.g., oracle_version, archivelog)
  - `passed` (boolean) - Whether check passed
  - `detail` (jsonb) - Detailed check results and remediation
  - `created_at` (timestamptz) - Check execution timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own pipelines and related data
  - Proper cascading deletes to maintain referential integrity

  ## Indexes
  - User-based queries optimized
  - Pipeline relationship lookups optimized
  - Log queries by timestamp optimized
*/

CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('oracle', 'postgres', 'sqlserver')),
  source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination_type text,
  destination_config jsonb DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'batch' CHECK (mode IN ('batch', 'log', 'micro-batch')),
  frequency_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'seeding', 'incremental', 'idle', 'error', 'paused')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  included boolean DEFAULT true,
  stats jsonb DEFAULT '{}'::jsonb,
  UNIQUE(pipeline_id, schema_name, table_name)
);

CREATE TABLE IF NOT EXISTS mapping_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  source_schema text NOT NULL,
  source_table text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('precheck', 'seed', 'incremental')),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  latency_ms bigint DEFAULT 0,
  summary jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id bigserial PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  run_id uuid,
  ts timestamptz DEFAULT now(),
  level text CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS precheck_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('source', 'destination')),
  name text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE precheck_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pipelines"
  ON pipelines FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipelines"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipelines"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pipelines"
  ON pipelines FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own pipeline objects"
  ON pipeline_objects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_objects.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own pipeline objects"
  ON pipeline_objects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_objects.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_objects.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own mapping configs"
  ON mapping_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = mapping_configs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own mapping configs"
  ON mapping_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = mapping_configs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = mapping_configs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own job runs"
  ON job_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = job_runs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own job runs"
  ON job_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = job_runs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own pipeline logs"
  ON pipeline_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_logs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own pipeline logs"
  ON pipeline_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_logs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own precheck results"
  ON precheck_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = precheck_results.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own precheck results"
  ON precheck_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = precheck_results.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_objects_pipeline_id ON pipeline_objects(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_mapping_configs_pipeline_id ON mapping_configs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_pipeline_id ON job_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_pipeline_id ON pipeline_logs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_ts ON pipeline_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_precheck_results_pipeline_id ON precheck_results(pipeline_id);
