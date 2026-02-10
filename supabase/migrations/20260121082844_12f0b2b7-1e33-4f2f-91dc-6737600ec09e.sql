-- Allow doctors to view patient roles so they can fetch patient list for prescriptions
CREATE POLICY "Doctors can view patient roles"
ON public.user_roles
FOR SELECT
USING (role = 'patient'::app_role AND has_role(auth.uid(), 'doctor'::app_role));