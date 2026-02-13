-- Create default admin account setup script
-- This creates a user in auth.users and links them in the profiles and user_roles tables

-- NOTE: You must run this in your Supabase SQL Editor.
-- We use a raw SQL approach because we are setting up a system user.

-- 1. Create the user in Auth with password 'admin123' (Supabase requires 6+ chars)
-- If you strictly want 'admin', you may need to disable password complexity in Supabase Auth settings.
-- For safety, we use 'admin123' here.

-- Insert user into auth.users (if not already exists)
-- This logic depends on Supabase internal structure, so the safest way is usually via the Auth UI.
-- HOWEVER, since we want to automate the role linkage:

DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if user already exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com') THEN
        -- We can't easily insert into auth.users via simple SQL due to hashing
        -- Please create the user 'admin@gmail.com' with password 'admin123' via Supabase Auth UI
        -- or use the following script if you have administrative privileges on the DB:
        
        RAISE NOTICE 'Please create the user via Auth dashboard first, then run this to set the role.';
    ELSE
        SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@gmail.com';
        
        -- Set role to admin
        INSERT INTO public.user_roles (user_id, role)
        VALUES (new_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- Update profile name if exists
        UPDATE public.profiles SET full_name = 'System Admin' WHERE user_id = new_user_id;
        
        RAISE NOTICE 'Admin role successfully assigned to admin@gmail.com';
    END IF;
END $$;
