/*
  # Update Pipeline Policies for Role-Based Access Control

  ## Overview
  This migration updates all existing pipeline-related table policies to support
  the new RBAC system with admin, maintainer, and read_only roles.

  ## Changes
  1. Drop existing policies that only check user_id
  2. Create new policies that check both user_id and role
  3. Admin users can view and manage all pipelines
  4. Maintainer users can create and manage their own pipelines
  5. Read-only users can only view their own pipelines
  6. All users can view resources they own

  ## Security
  - Admins have full access to all pipeline resources
  - Maintainers can perform CRUD operations on pipelines
  - Read-only users can only perform SELECT operations
  - Proper role checking for all operations
*/

-- Drop existing pipeline policies
DROP POLICY IF EXISTS "Users can view own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can insert own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can update own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can delete own pipelines" ON pipelines;

-- Create new role-based pipeline policies

-- SELECT: Admin sees all, others see their own
CREATE POLICY "Admin can view all pipelines"
  ON pipelines FOR SELECT
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Users can view own pipelines"
  ON pipelines FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND has_role_level('read_only'));

-- INSERT: Admin and maintainer can create
CREATE POLICY "Admin and maintainer can create pipelines"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND has_role_level('maintainer'));

-- UPDATE: Admin can update all, maintainer can update own
CREATE POLICY "Admin can update all pipelines"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Maintainer can update own pipelines"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND has_role_level('maintainer'))
  WITH CHECK (user_id = auth.uid() AND has_role_level('maintainer'));

-- DELETE: Admin can delete all, maintainer can delete own
CREATE POLICY "Admin can delete all pipelines"
  ON pipelines FOR DELETE
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Maintainer can delete own pipelines"
  ON pipelines FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND has_role_level('maintainer'));

-- Update connection_configs policies
DROP POLICY IF EXISTS "Users can view own connections" ON connection_configs;
DROP POLICY IF EXISTS "Users can insert own connections" ON connection_configs;
DROP POLICY IF EXISTS "Users can update own connections" ON connection_configs;
DROP POLICY IF EXISTS "Users can delete own connections" ON connection_configs;

CREATE POLICY "Admin can view all connections"
  ON connection_configs FOR SELECT
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Users can view own connections"
  ON connection_configs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND has_role_level('read_only'));

CREATE POLICY "Admin and maintainer can create connections"
  ON connection_configs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND has_role_level('maintainer'));

CREATE POLICY "Admin can update all connections"
  ON connection_configs FOR UPDATE
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Maintainer can update own connections"
  ON connection_configs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND has_role_level('maintainer'))
  WITH CHECK (user_id = auth.uid() AND has_role_level('maintainer'));

CREATE POLICY "Admin can delete all connections"
  ON connection_configs FOR DELETE
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Maintainer can delete own connections"
  ON connection_configs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND has_role_level('maintainer'));

-- Update pipeline_objects policies
DROP POLICY IF EXISTS "Users can view own pipeline objects" ON pipeline_objects;
DROP POLICY IF EXISTS "Users can manage own pipeline objects" ON pipeline_objects;

CREATE POLICY "Admin can view all pipeline objects"
  ON pipeline_objects FOR SELECT
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Users can view own pipeline objects"
  ON pipeline_objects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_objects.pipeline_id
      AND p.user_id = auth.uid()
      AND has_role_level('read_only')
    )
  );

CREATE POLICY "Admin can manage all pipeline objects"
  ON pipeline_objects FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Maintainer can manage own pipeline objects"
  ON pipeline_objects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_objects.pipeline_id
      AND p.user_id = auth.uid()
      AND has_role_level('maintainer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_objects.pipeline_id
      AND p.user_id = auth.uid()
      AND has_role_level('maintainer')
    )
  );

-- Update job_runs policies
DROP POLICY IF EXISTS "Users can view own job runs" ON job_runs;
DROP POLICY IF EXISTS "Users can insert own job runs" ON job_runs;

CREATE POLICY "Admin can view all job runs"
  ON job_runs FOR SELECT
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Users can view own job runs"
  ON job_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = job_runs.pipeline_id
      AND p.user_id = auth.uid()
      AND has_role_level('read_only')
    )
  );

CREATE POLICY "Admin and maintainer can create job runs"
  ON job_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = job_runs.pipeline_id
      AND (
        has_role('admin') OR
        (p.user_id = auth.uid() AND has_role_level('maintainer'))
      )
    )
  );

-- Update pipeline_logs policies
DROP POLICY IF EXISTS "Users can view own pipeline logs" ON pipeline_logs;
DROP POLICY IF EXISTS "Users can insert own pipeline logs" ON pipeline_logs;

CREATE POLICY "Admin can view all pipeline logs"
  ON pipeline_logs FOR SELECT
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Users can view own pipeline logs"
  ON pipeline_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_logs.pipeline_id
      AND p.user_id = auth.uid()
      AND has_role_level('read_only')
    )
  );

CREATE POLICY "All users can insert pipeline logs"
  ON pipeline_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_logs.pipeline_id
      AND (
        has_role('admin') OR
        p.user_id = auth.uid()
      )
    )
  );
