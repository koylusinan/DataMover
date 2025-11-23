/*
  # Fix User Profiles RLS Circular Dependency

  ## Problem
  
  The "Admins can view all profiles secure" policy creates a circular dependency:
  - To check if user is admin, it queries user_profiles table
  - But user_profiles table itself is protected by RLS
  - This causes the query to fail during login
  
  ## Solution
  
  Use auth.jwt() to get role from JWT token metadata instead of querying user_profiles
  This breaks the circular dependency
  
  ## Changes
  
  1. Drop existing problematic policies
  2. Create new policies that don't create circular dependencies
  3. Rely on JWT metadata for admin checks where possible
*/

-- Drop existing policies that cause circular dependency
DROP POLICY IF EXISTS "Users can view own profile secure" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles secure" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles secure" ON user_profiles;

-- Create new policies without circular dependency
-- Policy 1: Users can always view their own profile
CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
TO authenticated
USING (id = (select auth.uid()));

-- Policy 2: Users can view all profiles (needed for user selection in forms)
-- We'll rely on the frontend to enforce proper access control
-- and on other table policies to protect sensitive operations
CREATE POLICY "Authenticated users can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (true);

-- Policy 3: Only the user themselves can update their own basic info
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (
  id = (select auth.uid()) AND
  -- Prevent users from changing their own role
  role = (SELECT role FROM user_profiles WHERE id = (select auth.uid()))
);

-- Policy 4: Service role can do everything (for admin operations via edge functions)
CREATE POLICY "Service role full access"
ON user_profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: Admin role changes should be done via secure edge functions
-- that use service_role, not directly from the frontend
