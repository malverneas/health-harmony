-- ============================================================
-- MASTER FIX: Drop and recreate ALL RLS policies for ALL tables
-- This replaces has_role() calls with JWT-based checks to avoid
-- recursion, and ensures all GRANTs are correct.
-- ============================================================

-- ========================
-- 1. user_roles
-- ========================
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view doctor roles" ON public.user_roles;

CREATE POLICY "Users can view own role or doctor roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR role = 'doctor');

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ========================
-- 2. profiles
-- ========================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Doctors can view patient profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view doctor profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view patient profiles" ON public.profiles
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor');

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Anyone can view doctor profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = profiles.user_id
      AND user_roles.role = 'doctor'
    )
  );

-- ========================
-- 3. pharmacies
-- ========================
DROP POLICY IF EXISTS "Anyone can view pharmacies" ON public.pharmacies;
DROP POLICY IF EXISTS "Pharmacists can manage their pharmacy" ON public.pharmacies;

CREATE POLICY "Anyone can view pharmacies" ON public.pharmacies
  FOR SELECT USING (true);

CREATE POLICY "Pharmacists can manage their pharmacy" ON public.pharmacies
  FOR ALL USING (auth.uid() = user_id);

-- ========================
-- 4. consultations
-- ========================
DROP POLICY IF EXISTS "Patients can view their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Patients can create consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors can view their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors can update their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Admins can view all consultations" ON public.consultations;

CREATE POLICY "Patients can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create consultations" ON public.consultations
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update their consultations" ON public.consultations
  FOR UPDATE USING (auth.uid() = doctor_id);

CREATE POLICY "Admins can view all consultations" ON public.consultations
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ========================
-- 5. prescriptions
-- ========================
DROP POLICY IF EXISTS "Patients can view their prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Patients can update pharmacy selection" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors can manage prescriptions they created" ON public.prescriptions;
DROP POLICY IF EXISTS "Pharmacies can view assigned prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Pharmacies can update assigned prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Admins can view all prescriptions" ON public.prescriptions;

CREATE POLICY "Patients can view their prescriptions" ON public.prescriptions
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can update pharmacy selection" ON public.prescriptions
  FOR UPDATE USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can manage prescriptions they created" ON public.prescriptions
  FOR ALL USING (auth.uid() = doctor_id);

CREATE POLICY "Pharmacies can view assigned prescriptions" ON public.prescriptions
  FOR SELECT USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Pharmacies can update assigned prescriptions" ON public.prescriptions
  FOR UPDATE USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all prescriptions" ON public.prescriptions
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ========================
-- 6. prescription_items
-- ========================
DROP POLICY IF EXISTS "Users can view prescription items for their prescriptions" ON public.prescription_items;
DROP POLICY IF EXISTS "Doctors can insert prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Pharmacies can view prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Admins can view all prescription items" ON public.prescription_items;

CREATE POLICY "Users can view prescription items for their prescriptions" ON public.prescription_items
  FOR SELECT USING (
    prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE patient_id = auth.uid() OR doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert prescription items" ON public.prescription_items
  FOR INSERT WITH CHECK (
    prescription_id IN (SELECT id FROM public.prescriptions WHERE doctor_id = auth.uid())
  );

CREATE POLICY "Pharmacies can view prescription items" ON public.prescription_items
  FOR SELECT USING (
    prescription_id IN (
      SELECT p.id FROM public.prescriptions p
      JOIN public.pharmacies ph ON p.pharmacy_id = ph.id
      WHERE ph.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all prescription items" ON public.prescription_items
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ========================
-- 7. orders
-- ========================
DROP POLICY IF EXISTS "Patients can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Patients can create orders" ON public.orders;
DROP POLICY IF EXISTS "Pharmacies can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Pharmacies can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;

CREATE POLICY "Patients can view their orders" ON public.orders
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Pharmacies can view their orders" ON public.orders
  FOR SELECT USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Pharmacies can update their orders" ON public.orders
  FOR UPDATE USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ========================
-- 8. messages
-- ========================
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;

CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id);

-- ============================================================
-- GRANTS: Ensure authenticated role has access to all tables
-- ============================================================
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.consultations TO authenticated;
GRANT ALL ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescription_items TO authenticated;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.pharmacies TO authenticated;
GRANT ALL ON public.messages TO authenticated;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT ON public.pharmacies TO anon;

-- Grant RPC functions
GRANT EXECUTE ON FUNCTION public.get_available_doctors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_doctors() TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_consultation(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
