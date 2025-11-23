/*
  # Create Pipeline Progress Tracking System

  1. New Tables
    - `pipeline_progress_events`
      - `id` (uuid, primary key)
      - `pipeline_id` (uuid, foreign key to pipelines)
      - `event_type` (text) - 'source_connected', 'ingesting_started', 'staging_events', 'loading_started'
      - `event_status` (text) - 'pending', 'in_progress', 'completed', 'failed'
      - `metadata` (jsonb) - Additional event data
      - `occurred_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Functions
    - Function to get latest progress for a pipeline
    - Function to update progress event

  3. Security
    - Enable RLS on `pipeline_progress_events` table
    - Add policies for authenticated users
*/

-- Create pipeline_progress_events table
CREATE TABLE IF NOT EXISTS pipeline_progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('source_connected', 'ingesting_started', 'staging_events', 'loading_started')),
  event_status text NOT NULL DEFAULT 'pending' CHECK (event_status IN ('pending', 'in_progress', 'completed', 'failed')),
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pipeline_progress_pipeline_id ON pipeline_progress_events(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_progress_event_type ON pipeline_progress_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_progress_occurred_at ON pipeline_progress_events(occurred_at DESC);

-- Enable RLS
ALTER TABLE pipeline_progress_events ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can read all pipeline progress events"
  ON pipeline_progress_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert pipeline progress events"
  ON pipeline_progress_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update pipeline progress events"
  ON pipeline_progress_events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to get latest progress for a pipeline
CREATE OR REPLACE FUNCTION get_pipeline_progress(p_pipeline_id uuid)
RETURNS TABLE (
  event_type text,
  event_status text,
  metadata jsonb,
  occurred_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ppe.event_type)
    ppe.event_type,
    ppe.event_status,
    ppe.metadata,
    ppe.occurred_at
  FROM pipeline_progress_events ppe
  WHERE ppe.pipeline_id = p_pipeline_id
  ORDER BY ppe.event_type, ppe.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update or insert progress event
CREATE OR REPLACE FUNCTION upsert_pipeline_progress(
  p_pipeline_id uuid,
  p_event_type text,
  p_event_status text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO pipeline_progress_events (pipeline_id, event_type, event_status, metadata)
  VALUES (p_pipeline_id, p_event_type, p_event_status, p_metadata)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
