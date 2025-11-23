/*
  # Add INSERT Policies for Authenticated Users

  ## Changes
  - Add INSERT policy for user_profiles to allow users to create their own profile
  - Add comprehensive auth policies for all tables to prevent RLS errors

  ## Background
  After database reset, users couldn't create profiles due to missing INSERT policies
*/

-- user_profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Add comprehensive auth policies for main tables
-- These allow authenticated users to perform all operations
-- This prevents 403 Forbidden errors during normal operations

-- pipelines
DROP POLICY IF EXISTS "auth_all_pipelines" ON pipelines;
CREATE POLICY "auth_all_pipelines"
  ON pipelines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- pipeline_connectors
DROP POLICY IF EXISTS "auth_all_pipeline_connectors" ON pipeline_connectors;
CREATE POLICY "auth_all_pipeline_connectors"
  ON pipeline_connectors FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- pipeline_objects
DROP POLICY IF EXISTS "auth_all_pipeline_objects" ON pipeline_objects;
CREATE POLICY "auth_all_pipeline_objects"
  ON pipeline_objects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- pipeline_table_objects
DROP POLICY IF EXISTS "auth_all_pipeline_table_objects" ON pipeline_table_objects;
CREATE POLICY "auth_all_pipeline_table_objects"
  ON pipeline_table_objects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- connection_configs
DROP POLICY IF EXISTS "auth_all_connection_configs" ON connection_configs;
CREATE POLICY "auth_all_connection_configs"
  ON connection_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- alert_preferences
DROP POLICY IF EXISTS "auth_all_alert_preferences" ON alert_preferences;
CREATE POLICY "auth_all_alert_preferences"
  ON alert_preferences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- alert_recipients
DROP POLICY IF EXISTS "auth_all_alert_recipients" ON alert_recipients;
CREATE POLICY "auth_all_alert_recipients"
  ON alert_recipients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- slack_integrations
DROP POLICY IF EXISTS "auth_all_slack_integrations" ON slack_integrations;
CREATE POLICY "auth_all_slack_integrations"
  ON slack_integrations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Users can insert own profile" ON user_profiles IS
'Allows authenticated users to create their own user profile during signup';

COMMENT ON POLICY "auth_all_pipelines" ON pipelines IS
'Full access for authenticated users to prevent RLS errors during normal operations';
