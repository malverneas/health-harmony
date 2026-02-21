-- Fix: Allow patients to see doctors when booking consultations
-- The previous RLS policies only let users see their own data,
-- which means patients couldn't see any doctor profiles.

-- ============================================================
-- APPROACH 1: Create an RPC function (SECURITY DEFINER)
-- This bypasses RLS entirely and is the most reliable approach.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_available_doctors()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialty TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id AS id, p.full_name, p.specialty
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'doctor'
  ORDER BY p.full_name;
$$;

-- ============================================================
-- APPROACH 2: Also fix the RLS policies as a safety net
-- so that direct table queries also work.
-- ============================================================

-- Allow any authenticated user to see which users are doctors
DROP POLICY IF EXISTS "Anyone can view doctor roles" ON public.user_roles;
CREATE POLICY "Anyone can view doctor roles" ON public.user_roles
  FOR SELECT USING (role = 'doctor' OR auth.uid() = user_id);

-- Allow any authenticated user to view doctor profiles
DROP POLICY IF EXISTS "Anyone can view doctor profiles" ON public.profiles;
CREATE POLICY "Anyone can view doctor profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = profiles.user_id
      AND user_roles.role = 'doctor'
    )
  );

-- Fix admin policy to avoid recursion (use JWT metadata instead of querying user_roles)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
