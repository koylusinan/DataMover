/*
  # Optimize RLS Policies for Performance

  ## Changes
  
  Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
  This prevents re-evaluation for each row and improves query performance
  
  Note: We're recreating existing policies with optimized versions
*/

-- =====================================================
-- connection_configs - Optimize existing policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view own connections" ON connection_configs;
CREATE POLICY "Users can view own connections"
ON connection_configs FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid()) OR
  has_role_level('maintainer')
);

DROP POLICY IF EXISTS "Admin and maintainer can create connections" ON connection_configs;
CREATE POLICY "Admin and maintainer can create connections"
ON connection_configs FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid()) AND
  has_role_level('maintainer')
);

DROP POLICY IF EXISTS "Maintainer can update own connections" ON connection_configs;
CREATE POLICY "Maintainer can update own connections"
ON connection_configs FOR UPDATE
TO authenticated
USING (
  user_id = (select auth.uid()) AND
  has_role_level('maintainer')
)
WITH CHECK (
  user_id = (select auth.uid())
);

DROP POLICY IF EXISTS "Maintainer can delete own connections" ON connection_configs;
CREATE POLICY "Maintainer can delete own connections"
ON connection_configs FOR DELETE
TO authenticated
USING (
  user_id = (select auth.uid()) AND
  has_role_level('maintainer')
);

-- =====================================================
-- pipeline_objects - Optimize existing policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view own pipeline objects" ON pipeline_objects;
CREATE POLICY "Users can view own pipeline objects"
ON pipeline_objects FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = pipeline_objects.pipeline_id
    AND pipelines.user_id = (select auth.uid())
  ) OR
  has_role('admin')
);

DROP POLICY IF EXISTS "Maintainer can manage own pipeline objects" ON pipeline_objects;
CREATE POLICY "Maintainer can manage own pipeline objects"
ON pipeline_objects FOR ALL
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = pipeline_objects.pipeline_id
    AND pipelines.user_id = (select auth.uid())
  ) AND has_role_level('maintainer')) OR
  has_role('admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = pipeline_objects.pipeline_id
    AND pipelines.user_id = (select auth.uid())
  ) OR
  has_role('admin')
);

-- =====================================================
-- job_runs - Optimize existing policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view own job runs" ON job_runs;
CREATE POLICY "Users can view own job runs"
ON job_runs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = job_runs.pipeline_id
    AND pipelines.user_id = (select auth.uid())
  ) OR
  has_role('admin')
);

DROP POLICY IF EXISTS "Admin and maintainer can create job runs" ON job_runs;
CREATE POLICY "Admin and maintainer can create job runs"
ON job_runs FOR INSERT
TO authenticated
WITH CHECK (has_role_level('maintainer'));

-- =====================================================
-- pipeline_logs - Optimize existing policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view own pipeline logs" ON pipeline_logs;
CREATE POLICY "Users can view own pipeline logs"
ON pipeline_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = pipeline_logs.pipeline_id
    AND pipelines.user_id = (select auth.uid())
  ) OR
  has_role('admin')
);

DROP POLICY IF EXISTS "All users can insert pipeline logs" ON pipeline_logs;
CREATE POLICY "All users can insert pipeline logs"
ON pipeline_logs FOR INSERT
TO authenticated
WITH CHECK (has_role_level('viewer'));

-- =====================================================
-- slack_integrations - Consolidate and optimize
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Admins can manage all slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can view own slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Admins can view all slack integrations" ON slack_integrations;

CREATE POLICY "Users can view slack integrations"
ON slack_integrations FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid()) OR
  has_role('admin')
);

CREATE POLICY "Users can manage own slack integrations"
ON slack_integrations FOR ALL
TO authenticated
USING (
  user_id = (select auth.uid()) OR
  has_role('admin')
)
WITH CHECK (
  user_id = (select auth.uid()) OR
  has_role('admin')
);

-- =====================================================
-- alert_recipients - Consolidate and optimize
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all alert recipients" ON alert_recipients;
DROP POLICY IF EXISTS "Admins can insert alert recipients" ON alert_recipients;
DROP POLICY IF EXISTS "Admins can delete alert recipients" ON alert_recipients;
DROP POLICY IF EXISTS "Users can view their own alert assignments" ON alert_recipients;
DROP POLICY IF EXISTS "Users can view alert recipients for any pipeline" ON alert_recipients;

CREATE POLICY "Users can view alert recipients"
ON alert_recipients FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid()) OR
  pipeline_id IN (
    SELECT id FROM pipelines WHERE user_id = (select auth.uid())
  ) OR
  has_role('admin')
);

CREATE POLICY "Admins can manage alert recipients"
ON alert_recipients FOR ALL
TO authenticated
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- =====================================================
-- alert_preferences - Consolidate and optimize
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Admins can update all alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Admins can insert all alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can view own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can insert own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Users can update own alert preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Admins can manage all alert preferences" ON alert_preferences;

CREATE POLICY "Users can view alert preferences"
ON alert_preferences FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid()) OR
  pipeline_id IN (
    SELECT id FROM pipelines WHERE user_id = (select auth.uid())
  ) OR
  has_role('admin')
);

CREATE POLICY "Users can manage own alert preferences"
ON alert_preferences FOR ALL
TO authenticated
USING (
  user_id = (select auth.uid()) OR
  has_role('admin')
)
WITH CHECK (
  user_id = (select auth.uid()) OR
  has_role('admin')
);
