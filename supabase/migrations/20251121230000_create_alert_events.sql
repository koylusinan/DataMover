-- Create alert_events table for proactive monitoring
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'CONNECTOR_FAILED', 'HIGH_LAG', 'THROUGHPUT_DROP', 'DLQ_MESSAGES', 'HIGH_ERROR_RATE'
  severity TEXT NOT NULL, -- 'critical', 'warning', 'info'
  message TEXT NOT NULL,
  metadata JSONB, -- Additional context (error trace, lag value, etc.)
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_alert_events_pipeline_id ON alert_events(pipeline_id);
CREATE INDEX idx_alert_events_resolved ON alert_events(resolved);
CREATE INDEX idx_alert_events_created_at ON alert_events(created_at DESC);
CREATE INDEX idx_alert_events_severity ON alert_events(severity);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_alert_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_alert_events_updated_at
  BEFORE UPDATE ON alert_events
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_events_updated_at();

-- Enable RLS
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read alert_events"
  ON alert_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update alert_events"
  ON alert_events FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to alert_events"
  ON alert_events FOR ALL
  TO service_role
  USING (true);
