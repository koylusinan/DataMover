-- Seed data for local development
-- This file is run after all migrations

-- Delete any existing admin users to ensure clean state
DELETE FROM auth.users WHERE email = 'admin@example.com';
DELETE FROM user_profiles WHERE email = 'admin@example.com';

-- Create a single admin user with fixed ID for consistency
DO $$
DECLARE
  admin_user_id uuid := 'd88ebc67-a87b-4f82-819b-5df7d16c9fd9';
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  ) VALUES (
    admin_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin User"}',
    'authenticated',
    'authenticated'
  );

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
    admin_user_id,
    'admin@example.com',
    'Admin User',
    'admin',
    true,
    now(),
    now()
  );

  RAISE NOTICE 'Admin user created successfully';
  RAISE NOTICE 'Email: admin@example.com';
  RAISE NOTICE 'Password: password123';
  RAISE NOTICE 'User ID: %', admin_user_id;
END $$;
