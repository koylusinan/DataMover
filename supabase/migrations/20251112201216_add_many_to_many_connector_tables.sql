/*
  # Add Many-to-Many Connector Relationships

  ## Summary
  This migration enables tables to have multiple source and sink connectors by creating
  junction tables for many-to-many relationships.

  ## Changes Made

  1. New Tables
    - `table_source_connectors` - Junction table linking tables to source connectors
      - `id` (uuid, primary key)
      - `table_object_id` (uuid, foreign key to pipeline_table_objects)
      - `connector_id` (uuid, foreign key to pipeline_connectors)
      - `created_at` (timestamptz)
    
    - `table_sink_connectors` - Junction table linking tables to sink connectors
      - `id` (uuid, primary key)
      - `table_object_id` (uuid, foreign key to pipeline_table_objects)
      - `connector_id` (uuid, foreign key to pipeline_connectors)
      - `created_at` (timestamptz)

  2. Data Migration
    - Copy existing source_connector_id and sink_connector_id relationships to junction tables
    - Keep old columns for backwards compatibility during transition

  3. Security
    - Enable RLS on junction tables
    - Add policies for anonymous access
*/

-- Create table_source_connectors junction table
CREATE TABLE IF NOT EXISTS table_source_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_object_id uuid REFERENCES pipeline_table_objects(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES pipeline_connectors(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(table_object_id, connector_id)
);

ALTER TABLE table_source_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read table source connectors"
  ON table_source_connectors FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert table source connectors"
  ON table_source_connectors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update table source connectors"
  ON table_source_connectors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete table source connectors"
  ON table_source_connectors FOR DELETE
  TO anon
  USING (true);

-- Create table_sink_connectors junction table
CREATE TABLE IF NOT EXISTS table_sink_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_object_id uuid REFERENCES pipeline_table_objects(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES pipeline_connectors(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(table_object_id, connector_id)
);

ALTER TABLE table_sink_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read table sink connectors"
  ON table_sink_connectors FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert table sink connectors"
  ON table_sink_connectors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update table sink connectors"
  ON table_sink_connectors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete table sink connectors"
  ON table_sink_connectors FOR DELETE
  TO anon
  USING (true);

-- Migrate existing data to junction tables
INSERT INTO table_source_connectors (table_object_id, connector_id)
SELECT id, source_connector_id
FROM pipeline_table_objects
WHERE source_connector_id IS NOT NULL
ON CONFLICT (table_object_id, connector_id) DO NOTHING;

INSERT INTO table_sink_connectors (table_object_id, connector_id)
SELECT id, sink_connector_id
FROM pipeline_table_objects
WHERE sink_connector_id IS NOT NULL
ON CONFLICT (table_object_id, connector_id) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_table_source_connectors_table ON table_source_connectors(table_object_id);
CREATE INDEX IF NOT EXISTS idx_table_source_connectors_connector ON table_source_connectors(connector_id);
CREATE INDEX IF NOT EXISTS idx_table_sink_connectors_table ON table_sink_connectors(table_object_id);
CREATE INDEX IF NOT EXISTS idx_table_sink_connectors_connector ON table_sink_connectors(connector_id);
