-- =============================================
-- Utility Functions and Triggers
-- Created: 2024-11-26
-- =============================================

-- =============================================
-- Auto-update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to pipelines
DROP TRIGGER IF EXISTS update_pipelines_updated_at ON public.pipelines;
CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to pipeline_connectors
DROP TRIGGER IF EXISTS update_pipeline_connectors_updated_at ON public.pipeline_connectors;
CREATE TRIGGER update_pipeline_connectors_updated_at
  BEFORE UPDATE ON public.pipeline_connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to pipeline_table_objects
DROP TRIGGER IF EXISTS update_pipeline_table_objects_updated_at ON public.pipeline_table_objects;
CREATE TRIGGER update_pipeline_table_objects_updated_at
  BEFORE UPDATE ON public.pipeline_table_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to pipeline_tasks
DROP TRIGGER IF EXISTS update_pipeline_tasks_updated_at ON public.pipeline_tasks;
CREATE TRIGGER update_pipeline_tasks_updated_at
  BEFORE UPDATE ON public.pipeline_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to alert_events
DROP TRIGGER IF EXISTS update_alert_events_updated_at ON public.alert_events;
CREATE TRIGGER update_alert_events_updated_at
  BEFORE UPDATE ON public.alert_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to alert_preferences
DROP TRIGGER IF EXISTS update_alert_preferences_updated_at ON public.alert_preferences;
CREATE TRIGGER update_alert_preferences_updated_at
  BEFORE UPDATE ON public.alert_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to connectors
DROP TRIGGER IF EXISTS update_connectors_updated_at ON public.connectors;
CREATE TRIGGER update_connectors_updated_at
  BEFORE UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to connection_configs
DROP TRIGGER IF EXISTS update_connection_configs_updated_at ON public.connection_configs;
CREATE TRIGGER update_connection_configs_updated_at
  BEFORE UPDATE ON public.connection_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to pipeline_restore_staging
DROP TRIGGER IF EXISTS update_pipeline_restore_staging_updated_at ON public.pipeline_restore_staging;
CREATE TRIGGER update_pipeline_restore_staging_updated_at
  BEFORE UPDATE ON public.pipeline_restore_staging
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Soft delete helper function
-- =============================================
CREATE OR REPLACE FUNCTION public.soft_delete_pipeline(pipeline_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.pipelines
  SET
    deleted_at = now(),
    status = 'deleted',
    updated_at = now()
  WHERE id = pipeline_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Get active pipelines count
-- =============================================
CREATE OR REPLACE FUNCTION public.get_active_pipeline_count()
RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM public.pipelines
  WHERE deleted_at IS NULL
  AND status NOT IN ('deleted', 'draft');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- Get pipeline stats
-- =============================================
CREATE OR REPLACE FUNCTION public.get_pipeline_stats()
RETURNS TABLE (
  total_pipelines integer,
  running_pipelines integer,
  paused_pipelines integer,
  error_pipelines integer,
  draft_pipelines integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::integer as total_pipelines,
    COUNT(*) FILTER (WHERE status = 'running')::integer as running_pipelines,
    COUNT(*) FILTER (WHERE status = 'paused')::integer as paused_pipelines,
    COUNT(*) FILTER (WHERE status = 'error')::integer as error_pipelines,
    COUNT(*) FILTER (WHERE status = 'draft')::integer as draft_pipelines
  FROM public.pipelines
  WHERE deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- Clean up expired deleted pipelines
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_pipelines()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.pipelines
    WHERE deleted_at IS NOT NULL
    AND deleted_at + (COALESCE(backup_retention_hours, 24) || ' hours')::interval <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Get unresolved alert count
-- =============================================
CREATE OR REPLACE FUNCTION public.get_unresolved_alert_count(p_pipeline_id uuid DEFAULT NULL)
RETURNS integer AS $$
BEGIN
  IF p_pipeline_id IS NULL THEN
    RETURN (SELECT COUNT(*)::integer FROM public.alert_events WHERE resolved = false);
  ELSE
    RETURN (SELECT COUNT(*)::integer FROM public.alert_events WHERE pipeline_id = p_pipeline_id AND resolved = false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- Resolve all alerts for pipeline
-- =============================================
CREATE OR REPLACE FUNCTION public.resolve_all_alerts(p_pipeline_id uuid)
RETURNS integer AS $$
DECLARE
  resolved_count integer;
BEGIN
  WITH resolved AS (
    UPDATE public.alert_events
    SET resolved = true, resolved_at = now()
    WHERE pipeline_id = p_pipeline_id AND resolved = false
    RETURNING id
  )
  SELECT COUNT(*) INTO resolved_count FROM resolved;

  RETURN resolved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
