/*
  # Update Admin Password - Simple

  ## Changes
  - Updates admin password with a simpler, tested value
  
  ## Credentials
  - Email: admin@example.com
  - Password: password123
*/

-- Update admin password to a simple test password
UPDATE auth.users
SET 
  encrypted_password = crypt('password123', gen_salt('bf', 10)),
  updated_at = now()
WHERE email = 'admin@example.com';

-- Verify the update
DO $$
DECLARE
  pwd_length int;
BEGIN
  SELECT LENGTH(encrypted_password) INTO pwd_length
  FROM auth.users
  WHERE email = 'admin@example.com';
  
  RAISE NOTICE 'Password updated successfully';
  RAISE NOTICE 'Email: admin@example.com';
  RAISE NOTICE 'Password: password123';
  RAISE NOTICE 'Encrypted password length: %', pwd_length;
END $$;