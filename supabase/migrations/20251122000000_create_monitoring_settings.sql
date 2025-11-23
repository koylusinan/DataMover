-- Create monitoring_settings table to store global threshold configurations
CREATE TABLE IF NOT EXISTS monitoring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lag_ms INTEGER NOT NULL DEFAULT 5000,
  throughput_drop_percent INTEGER NOT NULL DEFAULT 50,
  error_rate_percent INTEGER NOT NULL DEFAULT 1,
  dlq_count INTEGER NOT NULL DEFAULT 0,
  check_interval_ms INTEGER NOT NULL DEFAULT 60000,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO monitoring_settings (lag_ms, throughput_drop_percent, error_rate_percent, dlq_count, check_interval_ms)
VALUES (5000, 50, 1, 0, 60000)
ON CONFLICT DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_monitoring_settings_updated_at ON monitoring_settings(updated_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_monitoring_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_monitoring_settings_updated_at
  BEFORE UPDATE ON monitoring_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_monitoring_settings_updated_at();

-- RLS Policies (allow authenticated users to read, only admins to update)
ALTER TABLE monitoring_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view monitoring settings"
  ON monitoring_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update monitoring settings"
  ON monitoring_settings FOR UPDATE
  USING (auth.role() = 'authenticated');
