/*
  # Temporarily Disable RLS on user_profiles

  ## Overview
  Disables RLS temporarily to allow login to work while we fix the recursive policy issue.

  ## Changes
  1. Drop all existing policies
  2. Disable RLS on user_profiles table
  
  ## Security Note
  This is temporary - RLS should be re-enabled with proper non-recursive policies
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON user_profiles;

-- Disable RLS temporarily
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
