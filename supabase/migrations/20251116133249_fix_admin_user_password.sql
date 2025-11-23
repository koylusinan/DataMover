/*
  # Fix Admin User Password

  ## Overview
  Deletes and recreates the admin user with proper password hashing for Supabase Auth.

  ## Changes
  1. Delete existing admin user from both auth.users and user_profiles
  2. Recreate with properly hashed password

  ## Credentials
  - Email: admin@example.com
  - Password: Admin123!
*/

-- Delete existing admin user
DELETE FROM user_profiles WHERE email = 'admin@example.com';
DELETE FROM auth.users WHERE email = 'admin@example.com';

-- Create new admin user with proper password hash
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert into auth.users with proper password hash
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('Admin123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"System Administrator"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Insert into user_profiles
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    'admin@example.com',
    'System Administrator',
    'admin',
    true,
    now(),
    now()
  );

  RAISE NOTICE 'Admin user recreated with ID: %', new_user_id;
END $$;
