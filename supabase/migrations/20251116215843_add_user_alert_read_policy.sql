/*
  # Add User Read Policy for Alert Recipients

  This migration adds a SELECT policy to allow users to view their own alert assignments.

  ## Changes
  - Add policy for authenticated users to view alert recipients where they are the recipient
  - This enables users to see which pipelines they are configured to receive alerts for

  ## Security
  - Users can only see alert recipients where they are the recipient_user_id
  - Admins can still see all alert recipients via existing policy
*/

-- Allow users to view their own alert assignments
CREATE POLICY "Users can view their own alert assignments"
  ON alert_recipients
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = recipient_user_id
  );
