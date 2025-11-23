/*
  # Create Authentication and Role-Based Access Control System

  ## Overview
  This migration creates a comprehensive RBAC system with user authentication,
  role management, and activity logging capabilities.

  ## New Tables

  ### `user_profiles`
  Stores extended user profile information linked to Supabase auth.users
  - `id` (uuid, primary key) - References auth.users(id)
  - `email` (text) - User email address
  - `full_name` (text) - User's full name
  - `role` (text) - User role: admin, maintainer, read_only
  - `is_active` (boolean) - Whether user account is active
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update timestamp
  - `last_login_at` (timestamptz) - Last successful login timestamp

  ### `user_activity_logs`
  Tracks all user actions for audit purposes
  - `id` (uuid, primary key) - Unique log identifier
  - `user_id` (uuid) - Reference to user_profiles
  - `action_type` (text) - Type of action performed
  - `action_description` (text) - Detailed description of the action
  - `resource_type` (text) - Type of resource affected (pipeline, user, connector, etc.)
  - `resource_id` (uuid) - ID of the affected resource
  - `metadata` (jsonb) - Additional context data
  - `ip_address` (text) - IP address of the user
  - `user_agent` (text) - Browser/client user agent
  - `created_at` (timestamptz) - Action timestamp

  ## Security
  - Enable RLS on all tables
  - Admin users can manage all users and view all logs
  - Maintainer users can manage pipelines but not users
  - Read-only users can only view data
  - Users can view their own profile and activity logs
  - Activity logs are immutable after creation

  ## Indexes
  - Optimized queries for user lookups by role
  - Fast activity log queries by user and timestamp
  - Efficient resource-based log queries
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'read_only' CHECK (role IN ('admin', 'maintainer', 'read_only')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

-- Create user_activity_logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_description text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies

-- Admin can view all user profiles
CREATE POLICY "Admin can view all user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admin can insert user profiles
CREATE POLICY "Admin can insert user profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Users can insert their own profile on first login
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Admin can update all user profiles
CREATE POLICY "Admin can update all user profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));

-- Admin can delete user profiles
CREATE POLICY "Admin can delete user profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- User Activity Logs Policies

-- Admin can view all activity logs
CREATE POLICY "Admin can view all activity logs"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- All authenticated users can insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON user_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_resource ON user_activity_logs(resource_type, resource_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to check if user has required role
CREATE OR REPLACE FUNCTION has_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = required_role
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has at least the specified role level
CREATE OR REPLACE FUNCTION has_role_level(minimum_role text)
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_action_type text,
  p_action_description text,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action_type,
    action_description,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_action_description,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
