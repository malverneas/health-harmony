-- Fix: Allow doctors to see patient list for prescriptions
-- The RLS on user_roles only allows seeing 'doctor' roles or your own role.
-- Doctors also need to see 'patient' roles.

-- 1. Drop and recreate the user_roles SELECT policy to be more permissive
DROP POLICY IF EXISTS "Users can view own role or doctor roles" ON public.user_roles;
CREATE POLICY "Authenticated users can view roles" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id       -- can always see your own role
    OR role = 'doctor'          -- anyone can see who the doctors are
    OR role = 'patient'         -- doctors need to see patient roles for prescriptions
  );

-- 2. Allow doctors to see patient profiles
DROP POLICY IF EXISTS "Doctors can view patient profiles" ON public.profiles;
CREATE POLICY "Doctors can view patient profiles" ON public.profiles
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor'
    OR auth.uid() = user_id
  );

-- 3. Create RPC for fetching patients (SECURITY DEFINER, bypasses all RLS)
CREATE OR REPLACE FUNCTION public.get_available_patients()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id AS id, p.full_name, p.email
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'patient'
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_patients() TO authenticated;
