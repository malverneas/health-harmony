-- Admin Users List RPC
-- Securly bypasses RLS and relies on user_roles for accurate role checks.

CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify caller is admin using the secure truth table (user_roles)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can access the full user list';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)
  FROM (
     SELECT 
       p.user_id as id,
       p.full_name as name,
       p.email,
       COALESCE(ur.role, 'patient') as role,
       'active' as status,
       p.membership_number as "membershipNumber",
       p.specialty
     FROM public.profiles p
     LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
  ) u INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
