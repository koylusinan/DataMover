/*
  # Create Debezium Connection Configuration Schema

  ## Overview
  This migration sets up the database schema for storing Debezium CDC connection configurations
  and prerequisite validation results.

  ## New Tables
  
  ### `connection_configs`
  Stores database connection information for CDC source databases
  - `id` (uuid, primary key) - Unique identifier for the connection
  - `user_id` (uuid) - Reference to authenticated user
  - `name` (text) - User-friendly name for the connection
  - `db_type` (text) - Database type (postgresql, mysql, mongodb, etc.)
  - `host` (text) - Database host address
  - `port` (integer) - Database port number
  - `database_name` (text) - Name of the database
  - `username` (text) - Database username
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### `validation_results`
  Stores prerequisite validation check results
  - `id` (uuid, primary key) - Unique identifier for validation result
  - `connection_id` (uuid, foreign key) - Reference to connection_configs
  - `check_name` (text) - Name of the prerequisite check
  - `status` (text) - Status: passed, failed, warning
  - `message` (text) - Detailed message about the check result
  - `details` (jsonb) - Additional structured details about the check
  - `checked_at` (timestamptz) - When the check was performed

  ## Security
  - Enable RLS on both tables
  - Users can only view/modify their own connection configurations
  - Users can only view validation results for their own connections
*/

CREATE TABLE IF NOT EXISTS connection_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  db_type text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 5432,
  database_name text NOT NULL,
  username text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connection_configs(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz DEFAULT now()
);

ALTER TABLE connection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON connection_configs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON connection_configs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON connection_configs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON connection_configs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own validation results"
  ON validation_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connection_configs
      WHERE connection_configs.id = validation_results.connection_id
      AND connection_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert validation results for own connections"
  ON validation_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connection_configs
      WHERE connection_configs.id = validation_results.connection_id
      AND connection_configs.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_connection_configs_user_id ON connection_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_connection_id ON validation_results(connection_id);