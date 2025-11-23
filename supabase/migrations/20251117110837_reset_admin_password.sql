/*
  # Reset Admin User Password

  ## Changes
  - Updates the admin user password to ensure it works with Supabase Auth
  - Uses proper bcrypt hashing for authentication
  
  ## Credentials
  - Email: admin@example.com
  - Password: Admin123!
*/

-- Update the admin user password
UPDATE auth.users
SET 
  encrypted_password = crypt('Admin123!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'admin@example.com';