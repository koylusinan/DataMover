-- =============================================================================
-- SIMPLE MOCK DATA - Without Users (Anonymous Access)
-- =============================================================================

-- Clear existing data
TRUNCATE TABLE alert_preferences CASCADE;
TRUNCATE TABLE alert_recipients CASCADE;
TRUNCATE TABLE pipeline_logs CASCADE;
TRUNCATE TABLE job_runs CASCADE;
TRUNCATE TABLE pipeline_table_objects CASCADE;
TRUNCATE TABLE pipeline_objects CASCADE;
TRUNCATE TABLE pipeline_connectors CASCADE;
TRUNCATE TABLE pipelines CASCADE;

-- Create a test user in auth.users first
-- Note: You need to sign up via the Supabase UI or API first!
-- Then get the user ID and use it below

-- For now, let's use the system to check what users exist:
\echo 'Checking existing users...'
SELECT id, email FROM auth.users;

-- PIPELINES (using NULL user_id for testing - will need RLS disabled temporarily)
-- Or you can insert after creating users via the signup page

-- Uncomment below ONLY after you have user IDs from auth.users
/*
INSERT INTO pipelines (id, user_id, name, source_type, source_config, destination_type, destination_config, mode, frequency_minutes, status, created_at, updated_at, schedule_config) VALUES
('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'YOUR_USER_ID_HERE', 'Oracle to Postgres CDC', 'oracle',
'{"ssl": false, "host": "10.120.2.121", "port": 1521, "username": "DEBEZIUM", "database_name": "CBPROD"}',
'postgres',
'{"ssl": false, "host": "localhost", "port": 5432, "schema": "public", "database": "target_db", "username": "postgres"}',
'log', 30, 'running', '2025-11-10 10:00:00+00', '2025-11-16 22:49:23+00', '{"type": "preset", "value": "2h"}');
*/

\echo ''
\echo '========================================='
\echo 'INSTRUCTIONS:'
\echo '========================================='
\echo '1. First, create users via Supabase Studio (http://127.0.0.1:54323)'
\echo '2. Or use the signup page in your app'
\echo '3. Get the user IDs from: SELECT id, email FROM auth.users;'
\echo '4. Update mockdata-fixed.sql with the actual user IDs'
\echo '5. Then run the full mockdata import'
\echo '========================================='

