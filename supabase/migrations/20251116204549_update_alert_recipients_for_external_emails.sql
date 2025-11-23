/*
  # Update Alert Recipients for External Emails

  1. Changes
    - Add `is_external` column to track external email recipients
    - Add `recipient_user_id` column to link to actual users
    - Make `user_id` reference the admin who added the recipient
    - Update existing data structure

  2. Notes
    - External emails: is_external = true, recipient_user_id = null
    - Internal users: is_external = false, recipient_user_id = user's id
    - user_id always references who created the record
*/

-- Add new columns to alert_recipients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_recipients' AND column_name = 'is_external'
  ) THEN
    ALTER TABLE alert_recipients ADD COLUMN is_external boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_recipients' AND column_name = 'recipient_user_id'
  ) THEN
    ALTER TABLE alert_recipients ADD COLUMN recipient_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alert_recipients_recipient_user_id ON alert_recipients(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_is_external ON alert_recipients(is_external);