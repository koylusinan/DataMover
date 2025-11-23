/*
  # Create Connectors and Table Objects

  1. New Tables
    - `pipeline_connectors`
      - `id` (uuid, primary key)
      - `pipeline_id` (uuid, foreign key to pipelines)
      - `name` (text) - connector name
      - `type` (text) - 'source' or 'sink'
      - `connector_class` (text) - Java class
      - `config` (jsonb) - full connector configuration
      - `status` (text) - 'running', 'paused', 'failed'
      - `tasks_max` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `pipeline_table_objects`
      - `id` (uuid, primary key)
      - `pipeline_id` (uuid, foreign key to pipelines)
      - `source_connector_id` (uuid, foreign key to pipeline_connectors)
      - `sink_connector_id` (uuid, foreign key to pipeline_connectors)
      - `schema_name` (text)
      - `table_name` (text)
      - `status` (text) - 'snapshotting', 'streaming', 'paused', 'error'
      - `last_event_timestamp` (timestamptz)
      - `row_count` (bigint)
      - `size_estimate` (text)
      - `last_sync_time` (timestamptz)
      - `source_topic` (text)
      - `partition_count` (integer)
      - `destination_table` (text)
      - `snapshot_progress` (integer) - 0-100
      - `error_message` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `pipeline_tasks`
      - `id` (uuid, primary key)
      - `table_object_id` (uuid, foreign key to pipeline_table_objects)
      - `task_number` (integer)
      - `status` (text) - 'running', 'paused', 'failed'
      - `worker_id` (text)
      - `lag` (text)
      - `throughput` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for anonymous access (read-only)
*/

-- Create pipeline_connectors table
CREATE TABLE IF NOT EXISTS pipeline_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('source', 'sink')),
  connector_class text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'running' CHECK (status IN ('running', 'paused', 'failed')),
  tasks_max integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read connectors"
  ON pipeline_connectors FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert connectors"
  ON pipeline_connectors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update connectors"
  ON pipeline_connectors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create pipeline_table_objects table
CREATE TABLE IF NOT EXISTS pipeline_table_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  source_connector_id uuid REFERENCES pipeline_connectors(id) ON DELETE SET NULL,
  sink_connector_id uuid REFERENCES pipeline_connectors(id) ON DELETE SET NULL,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  status text DEFAULT 'streaming' CHECK (status IN ('snapshotting', 'streaming', 'paused', 'error')),
  last_event_timestamp timestamptz DEFAULT now(),
  row_count bigint DEFAULT 0,
  size_estimate text DEFAULT '0 KB',
  last_sync_time timestamptz DEFAULT now(),
  source_topic text,
  partition_count integer DEFAULT 1,
  destination_table text,
  snapshot_progress integer DEFAULT 0 CHECK (snapshot_progress >= 0 AND snapshot_progress <= 100),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_table_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read table objects"
  ON pipeline_table_objects FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert table objects"
  ON pipeline_table_objects FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update table objects"
  ON pipeline_table_objects FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create pipeline_tasks table
CREATE TABLE IF NOT EXISTS pipeline_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_object_id uuid REFERENCES pipeline_table_objects(id) ON DELETE CASCADE,
  task_number integer NOT NULL,
  status text DEFAULT 'running' CHECK (status IN ('running', 'paused', 'failed')),
  worker_id text,
  lag text,
  throughput text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tasks"
  ON pipeline_tasks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert tasks"
  ON pipeline_tasks FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update tasks"
  ON pipeline_tasks FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_connectors_pipeline ON pipeline_connectors(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_table_objects_pipeline ON pipeline_table_objects(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_table_objects_source ON pipeline_table_objects(source_connector_id);
CREATE INDEX IF NOT EXISTS idx_table_objects_sink ON pipeline_table_objects(sink_connector_id);
CREATE INDEX IF NOT EXISTS idx_tasks_table_object ON pipeline_tasks(table_object_id);
