/*
  # Update Admin Password

  1. Changes
    - Update admin user password to 'admin123'
  
  2. Security
    - Uses pgcrypto for password hashing
*/

-- Update admin password
UPDATE auth.users 
SET 
  encrypted_password = crypt('admin123', gen_salt('bf')),
  updated_at = now()
WHERE email = 'admin@example.com';
