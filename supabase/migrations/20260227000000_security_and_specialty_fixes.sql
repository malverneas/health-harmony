-- 1. Update handle_new_user trigger to capture specialty and membership_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role TEXT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, specialty, membership_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'specialty',
    NEW.raw_user_meta_data ->> 'membership_number'
  );

  _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'patient');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role::app_role);

  IF _role = 'pharmacist' THEN
    INSERT INTO public.pharmacies (user_id, name, address)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'pharmacy_name', 'My Pharmacy'),
      COALESCE(NEW.raw_user_meta_data ->> 'address', '')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update RLS on user_roles to allow patients to see pharmacist roles (for messaging)
DROP POLICY IF EXISTS "Users can view own role or doctor roles" ON public.user_roles;
CREATE POLICY "Users can view own, doctor, or pharmacist roles" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR role = 'doctor' 
    OR role = 'pharmacist'
  );

-- 3. Update RLS on profiles to allow pharmacists to see patient names
DROP POLICY IF EXISTS "Pharmacists can view all profiles" ON public.profiles;
CREATE POLICY "Pharmacists can view all profiles" ON public.profiles
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'pharmacist'
    OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'pharmacist'))
  );

-- 4. Ensure patients can see ALL profiles for messaging search (or at least doctors/pharmacists)
-- This is already partially covered by "Anyone can view doctor profiles", 
-- but we need a broader policy for patient-to-pharmacinst messaging.
DROP POLICY IF EXISTS "Anyone can view doctor profiles" ON public.profiles;
CREATE POLICY "Anyone can view doctor and pharmacist profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = profiles.user_id 
      AND (user_roles.role = 'doctor' OR user_roles.role = 'pharmacist')
    )
  );
