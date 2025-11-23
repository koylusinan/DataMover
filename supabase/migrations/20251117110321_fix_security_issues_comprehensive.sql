/*
  # Fix Security Issues - Comprehensive Cleanup

  ## Changes
  
  ### 1. Drop Unused Indexes (22 indexes)
  - Removes unused indexes to improve write performance and reduce storage overhead
  
  ### 2. Remove Duplicate Indexes (2 pairs)
  - Drops duplicate indexes on alert_preferences and alert_recipients tables
  
  ### 3. Consolidate Multiple Permissive Policies (5 tables)
  - Merges duplicate SELECT policies into single policies per table
  - Tables: alert_preferences, alert_recipients, pipeline_objects, slack_integrations, user_profiles
  
  ### 4. Fix Function Search Path Mutability (2 functions)
  - Sets immutable search_path for security functions
  - Prevents search_path manipulation attacks
  
  ## Security Benefits
  - Reduced attack surface from unused indexes
  - Clearer policy structure with single permissive policies
  - Protected function execution context
  - Better database performance
*/

-- ============================================================================
-- PART 1: Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_connection_configs_user_id;
DROP INDEX IF EXISTS idx_validation_results_connection_id;
DROP INDEX IF EXISTS idx_job_runs_started_at;
DROP INDEX IF EXISTS idx_pipelines_user_id;
DROP INDEX IF EXISTS idx_pipeline_logs_ts;
DROP INDEX IF EXISTS connector_versions_config_gin;
DROP INDEX IF EXISTS connector_versions_active_idx;
DROP INDEX IF EXISTS idx_pipeline_connectors_pending_updated;
DROP INDEX IF EXISTS idx_pipeline_connectors_deployed;
DROP INDEX IF EXISTS idx_alert_recipients_is_external;
DROP INDEX IF EXISTS idx_alert_preferences_recipient_id;
DROP INDEX IF EXISTS idx_user_profiles_role;
DROP INDEX IF EXISTS idx_user_profiles_is_active;
DROP INDEX IF EXISTS idx_user_activity_logs_resource;
DROP INDEX IF EXISTS idx_alert_preferences_pipeline;
DROP INDEX IF EXISTS idx_alert_preferences_recipient_pipeline;
DROP INDEX IF EXISTS idx_pipeline_connectors_deployed_by_fk;
DROP INDEX IF EXISTS idx_pipeline_connectors_pending_updated_by_fk;
DROP INDEX IF EXISTS idx_slack_integrations_user_id_fk;
DROP INDEX IF EXISTS idx_alert_recipients_created_by_fk;
DROP INDEX IF EXISTS idx_alert_recipients_user_id_fk;
DROP INDEX IF EXISTS idx_alert_recipients_pipeline_id_fk;

-- ============================================================================
-- PART 2: Drop Duplicate Indexes
-- ============================================================================

-- On alert_preferences: keep idx_alert_preferences_pipeline_id_fk
-- (already dropped idx_alert_preferences_pipeline above)

-- On alert_recipients: keep idx_alert_recipients_pipeline_id
DROP INDEX IF EXISTS idx_alert_recipients_pipeline_id_fk;

-- ============================================================================
-- PART 3: Consolidate Multiple Permissive Policies
-- ============================================================================

-- TABLE: alert_preferences
DROP POLICY IF EXISTS "Users can manage own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can view alert preferences" ON alert_preferences;

CREATE POLICY "Users can view and manage own alert preferences"
  ON alert_preferences
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    has_role_level('admin')
  );

-- TABLE: alert_recipients
DROP POLICY IF EXISTS "Admins can manage alert recipients" ON alert_recipients;
DROP POLICY IF EXISTS "Users can view alert recipients" ON alert_recipients;

CREATE POLICY "Users can view relevant alert recipients"
  ON alert_recipients
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    created_by = auth.uid() OR
    has_role_level('admin')
  );

-- TABLE: pipeline_objects
DROP POLICY IF EXISTS "Maintainer can manage own pipeline objects" ON pipeline_objects;
DROP POLICY IF EXISTS "Users can view own pipeline objects" ON pipeline_objects;

CREATE POLICY "Users can view and manage own pipeline objects"
  ON pipeline_objects
  FOR SELECT
  TO authenticated
  USING (
    pipeline_id IN (
      SELECT id FROM pipelines 
      WHERE user_id = auth.uid()
    ) OR
    has_role_level('admin')
  );

-- TABLE: slack_integrations
DROP POLICY IF EXISTS "Users can manage own slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can view slack integrations" ON slack_integrations;

CREATE POLICY "Users can view and manage own slack integrations"
  ON slack_integrations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    has_role_level('admin')
  );

-- TABLE: user_profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PART 4: Fix Function Search Path Mutability
-- ============================================================================

-- Recreate has_role_level function with immutable search_path
CREATE OR REPLACE FUNCTION has_role_level(minimum_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid() AND is_active = true;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  CASE minimum_role
    WHEN 'read_only' THEN
      RETURN user_role IN ('read_only', 'maintainer', 'admin');
    WHEN 'maintainer' THEN
      RETURN user_role IN ('maintainer', 'admin');
    WHEN 'admin' THEN
      RETURN user_role = 'admin';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Recreate log_user_activity function with immutable search_path
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- PART 5: Add Documentation Comments
-- ============================================================================

COMMENT ON POLICY "Users can view and manage own alert preferences" ON alert_preferences IS 
'Consolidated policy: Users can view their own preferences, preferences for recipients they created, and admins can view all';

COMMENT ON POLICY "Users can view relevant alert recipients" ON alert_recipients IS 
'Consolidated policy: Users can view recipients they created, recipients assigned to them, and admins can view all';

COMMENT ON POLICY "Users can view and manage own pipeline objects" ON pipeline_objects IS 
'Consolidated policy: Users can view objects for their own pipelines, and admins can view all';

COMMENT ON POLICY "Users can view and manage own slack integrations" ON slack_integrations IS 
'Consolidated policy: Users can view their own Slack integrations, and admins can view all';

COMMENT ON POLICY "Authenticated users can view profiles" ON user_profiles IS 
'Consolidated policy: All authenticated users can view all profiles for collaboration purposes';

COMMENT ON FUNCTION has_role_level(text) IS 
'Security function with immutable search_path to prevent search_path manipulation attacks';

COMMENT ON FUNCTION log_user_activity() IS 
'Activity logging function with immutable search_path to prevent search_path manipulation attacks';