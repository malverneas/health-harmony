-- Fix: Grant table permissions to authenticated users
-- The original migration created RLS policies but never granted
-- the 'authenticated' role permission to access the tables.
-- Without these GRANTs, all requests return 403 Forbidden.

-- Profiles
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- User Roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;

-- Consultations (patients need INSERT, doctors need UPDATE)
GRANT SELECT, INSERT, UPDATE ON public.consultations TO authenticated;

-- Prescriptions
GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;

-- Prescription Items
GRANT SELECT, INSERT ON public.prescription_items TO authenticated;

-- Orders
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;

-- Pharmacies
GRANT SELECT, INSERT, UPDATE ON public.pharmacies TO authenticated;
GRANT SELECT ON public.pharmacies TO anon;

-- Messages
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- Also grant EXECUTE on our RPC functions
GRANT EXECUTE ON FUNCTION public.get_available_doctors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_doctors() TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
