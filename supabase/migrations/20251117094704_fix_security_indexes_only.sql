/*
  # Security Fixes - Indexes and RLS Enable

  ## Changes
  
  1. Add missing indexes for foreign keys (performance improvement)
  2. Enable RLS on user_profiles table
  3. Add basic RLS policies for user_profiles
*/

-- =====================================================
-- ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- alert_preferences indexes
CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_id_fk 
ON alert_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_pipeline_id_fk 
ON alert_preferences(pipeline_id);

-- alert_recipients indexes
CREATE INDEX IF NOT EXISTS idx_alert_recipients_created_by_fk 
ON alert_recipients(created_by);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_user_id_fk 
ON alert_recipients(user_id);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_pipeline_id_fk 
ON alert_recipients(pipeline_id);

-- pipeline_connectors indexes (only if columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_connectors' AND column_name = 'deployed_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_connectors_deployed_by_fk
    ON pipeline_connectors(deployed_by);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_connectors' AND column_name = 'pending_config_updated_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_connectors_pending_updated_by_fk
    ON pipeline_connectors(pending_config_updated_by);
  END IF;
END $$;

-- slack_integrations index
CREATE INDEX IF NOT EXISTS idx_slack_integrations_user_id_fk 
ON slack_integrations(user_id);

-- =====================================================
-- ENABLE RLS ON user_profiles
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add RLS policies for user_profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'Users can view own profile secure'
  ) THEN
    CREATE POLICY "Users can view own profile secure"
    ON user_profiles FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'Admins can view all profiles secure'
  ) THEN
    CREATE POLICY "Admins can view all profiles secure"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = (select auth.uid()) AND up.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'Admins can update profiles secure'
  ) THEN
    CREATE POLICY "Admins can update profiles secure"
    ON user_profiles FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = (select auth.uid()) AND up.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = (select auth.uid()) AND up.role = 'admin'
      )
    );
  END IF;
END $$;
