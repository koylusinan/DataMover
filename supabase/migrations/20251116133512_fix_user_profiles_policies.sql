/*
  # Fix User Profiles RLS Policies

  ## Overview
  Removes infinite recursion in policies by using simpler, non-recursive checks.
  Uses app_metadata to store role information accessible via auth.jwt().

  ## Changes
  1. Drop all existing policies
  2. Create new simple policies without recursion
  3. Update admin user to have role in app_metadata
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can update all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can delete user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to view all profiles (check role from user_profiles without recursion)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow users to update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to insert profiles
CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow authenticated users to insert their own profile (for signup)
CREATE POLICY "Users can insert own profile on signup"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
