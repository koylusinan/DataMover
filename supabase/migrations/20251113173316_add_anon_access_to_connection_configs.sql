/*
  # Add anon access to connection_configs for local development

  1. Changes
    - Add SELECT, INSERT, UPDATE, DELETE policies for anon role on connection_configs table
    - Allows local development without authentication
  
  2. Security
    - These policies are permissive for local development
    - Production should use authenticated-only policies
*/

-- Allow anon users to read all connections
CREATE POLICY "Anon users can view all connections"
  ON connection_configs
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to insert connections
CREATE POLICY "Anon users can insert connections"
  ON connection_configs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to update connections
CREATE POLICY "Anon users can update connections"
  ON connection_configs
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to delete connections
CREATE POLICY "Anon users can delete connections"
  ON connection_configs
  FOR DELETE
  TO anon
  USING (true);

-- Same for validation_results
CREATE POLICY "Anon users can view validation results"
  ON validation_results
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert validation results"
  ON validation_results
  FOR INSERT
  TO anon
  WITH CHECK (true);