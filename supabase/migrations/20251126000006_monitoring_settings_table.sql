-- =============================================
-- Monitoring Settings Table
-- Created: 2024-11-26
-- =============================================

-- Global monitoring settings (single row)
CREATE TABLE IF NOT EXISTS public.monitoring_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lag_ms integer NOT NULL DEFAULT 5000,
  throughput_drop_percent integer NOT NULL DEFAULT 50,
  error_rate_percent integer NOT NULL DEFAULT 1,
  dlq_count integer NOT NULL DEFAULT 0,
  check_interval_ms integer NOT NULL DEFAULT 60000,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  pause_duration_seconds integer NOT NULL DEFAULT 5,
  backup_retention_hours integer NOT NULL DEFAULT 24,
  CONSTRAINT monitoring_settings_pkey PRIMARY KEY (id),
  CONSTRAINT monitoring_settings_backup_retention_check CHECK (backup_retention_hours >= 1 AND backup_retention_hours <= 168),
  CONSTRAINT monitoring_settings_lag_ms_check CHECK (lag_ms > 0),
  CONSTRAINT monitoring_settings_throughput_check CHECK (throughput_drop_percent >= 0 AND throughput_drop_percent <= 100),
  CONSTRAINT monitoring_settings_error_rate_check CHECK (error_rate_percent >= 0 AND error_rate_percent <= 100),
  CONSTRAINT monitoring_settings_dlq_count_check CHECK (dlq_count >= 0),
  CONSTRAINT monitoring_settings_check_interval_check CHECK (check_interval_ms >= 1000),
  CONSTRAINT monitoring_settings_pause_duration_check CHECK (pause_duration_seconds >= 0),
  CONSTRAINT monitoring_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Insert default settings if not exists
INSERT INTO public.monitoring_settings (
  lag_ms,
  throughput_drop_percent,
  error_rate_percent,
  dlq_count,
  check_interval_ms,
  pause_duration_seconds,
  backup_retention_hours
)
SELECT 5000, 50, 1, 0, 60000, 5, 24
WHERE NOT EXISTS (SELECT 1 FROM public.monitoring_settings);

-- Function to ensure only one row exists
CREATE OR REPLACE FUNCTION public.check_monitoring_settings_single_row()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.monitoring_settings) >= 1 THEN
    RAISE EXCEPTION 'Only one row allowed in monitoring_settings table';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_single_monitoring_settings'
  ) THEN
    CREATE TRIGGER ensure_single_monitoring_settings
      BEFORE INSERT ON public.monitoring_settings
      FOR EACH ROW EXECUTE FUNCTION public.check_monitoring_settings_single_row();
  END IF;
END $$;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_monitoring_settings_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monitoring_settings_timestamp ON public.monitoring_settings;
CREATE TRIGGER update_monitoring_settings_timestamp
  BEFORE UPDATE ON public.monitoring_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_monitoring_settings_timestamp();
