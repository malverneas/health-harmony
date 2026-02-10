-- Allow authenticated users to view doctor roles (for booking)
CREATE POLICY "Authenticated users can view doctor roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'doctor');

-- Allow authenticated users to view pharmacist roles (for pharmacy listing)
CREATE POLICY "Authenticated users can view pharmacist roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'pharmacist');

-- Allow patients to view doctor profiles for booking
CREATE POLICY "Patients can view doctor profiles"
ON public.profiles
FOR SELECT
USING (
  user_id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'doctor'
  )
);