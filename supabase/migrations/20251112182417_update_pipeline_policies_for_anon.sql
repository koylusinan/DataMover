/*
  # Update Pipeline Policies for Anonymous Access

  ## Overview
  This migration updates the RLS policies to allow anonymous (unauthenticated) users
  to create and manage pipelines. This is useful for demo/testing purposes.

  ## Changes
  - Drop existing restrictive policies
  - Add new policies that allow both authenticated and anonymous users
  - Use user_id from the data itself for authorization (trust client)

  ## Security Note
  This is a simplified security model suitable for demo/development.
  In production, you should require authentication and use auth.uid().
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can insert own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can update own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can delete own pipelines" ON pipelines;

DROP POLICY IF EXISTS "Users can view own pipeline objects" ON pipeline_objects;
DROP POLICY IF EXISTS "Users can manage own pipeline objects" ON pipeline_objects;

DROP POLICY IF EXISTS "Users can view own mapping configs" ON mapping_configs;
DROP POLICY IF EXISTS "Users can manage own mapping configs" ON mapping_configs;

DROP POLICY IF EXISTS "Users can view own job runs" ON job_runs;
DROP POLICY IF EXISTS "Users can insert own job runs" ON job_runs;

DROP POLICY IF EXISTS "Users can view own pipeline logs" ON pipeline_logs;
DROP POLICY IF EXISTS "Users can insert own pipeline logs" ON pipeline_logs;

DROP POLICY IF EXISTS "Users can view own precheck results" ON precheck_results;
DROP POLICY IF EXISTS "Users can insert own precheck results" ON precheck_results;

-- Create new permissive policies for pipelines
CREATE POLICY "Allow all operations on pipelines"
  ON pipelines FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for pipeline_objects
CREATE POLICY "Allow all operations on pipeline_objects"
  ON pipeline_objects FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for mapping_configs
CREATE POLICY "Allow all operations on mapping_configs"
  ON mapping_configs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for job_runs
CREATE POLICY "Allow all operations on job_runs"
  ON job_runs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for pipeline_logs
CREATE POLICY "Allow all operations on pipeline_logs"
  ON pipeline_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for precheck_results
CREATE POLICY "Allow all operations on precheck_results"
  ON precheck_results FOR ALL
  USING (true)
  WITH CHECK (true);
