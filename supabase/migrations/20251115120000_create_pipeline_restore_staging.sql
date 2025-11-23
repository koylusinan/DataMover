CREATE TABLE IF NOT EXISTS pipeline_restore_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES pipeline_connectors(id) ON DELETE CASCADE,
  connector_name text,
  connector_type text NOT NULL CHECK (connector_type IN ('source', 'sink')),
  connector_class text,
  registry_name text NOT NULL,
  version integer NOT NULL,
  checksum text,
  staged_config jsonb NOT NULL,
  diff jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_restore_staging_pipeline_connector_idx
  ON pipeline_restore_staging (pipeline_id, connector_id);

ALTER TABLE pipeline_restore_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own staged restores"
  ON pipeline_restore_staging FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_restore_staging.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_restore_staging.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon can manage staged restores"
  ON pipeline_restore_staging FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
