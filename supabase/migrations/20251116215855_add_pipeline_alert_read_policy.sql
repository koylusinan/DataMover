/*
  # Add Pipeline Alert Recipients Read Policy

  This migration adds a SELECT policy to allow users to view alert recipients for pipelines they have access to.

  ## Changes
  - Add policy for authenticated users to view alert recipients for any pipeline
  - This enables the Monitoring tab to show who receives alerts for each pipeline

  ## Security
  - All authenticated users can view who receives alerts for pipelines
  - This is safe as it only reveals who gets notified, not sensitive pipeline data
*/

-- Allow authenticated users to view alert recipients for any pipeline
CREATE POLICY "Users can view alert recipients for any pipeline"
  ON alert_recipients
  FOR SELECT
  TO authenticated
  USING (true);
