/*
  # Create Initial Admin User

  ## Overview
  Creates the first admin user for the system with full permissions.

  ## Details
  - Email: admin@example.com
  - Password: Admin123!
  - Role: admin
  - Status: active

  ## Security
  - Password is securely hashed using bcrypt
  - User is immediately confirmed (no email verification needed)
  - Profile is automatically created with admin role
*/

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Check if admin already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@example.com') THEN
    RAISE NOTICE 'Admin user already exists';
    RETURN;
  END IF;

  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
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
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Administrator"}',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create user profile
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at,
    last_login_at
  ) VALUES (
    new_user_id,
    'admin@example.com',
    'System Administrator',
    'admin',
    true,
    now(),
    now(),
    null
  );

  RAISE NOTICE 'Admin user created successfully with ID: %', new_user_id;
  RAISE NOTICE 'Email: admin@example.com';
  RAISE NOTICE 'Password: Admin123!';
END $$;
