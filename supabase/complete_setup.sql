-- ============================================================
-- HEALTH HARMONY - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor on a fresh project
-- This creates ALL tables, policies, functions, and triggers
-- ============================================================

-- ========================
-- 1. TYPES
-- ========================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'pharmacist', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 2. TABLES
-- ========================

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  license_number TEXT,
  specialty TEXT,
  pharmacy_name TEXT,
  address TEXT,
  membership_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Pharmacies
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

-- Consultations
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('video', 'chat', 'physical')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Prescriptions
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  consultation_id UUID REFERENCES public.consultations(id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'pending_patient', 'acknowledged', 'in_stock', 'out_of_stock', 'preparing', 'ready', 'out_for_delivery', 'fulfilled')),
  notes TEXT,
  fulfillment_type TEXT CHECK (fulfillment_type IN ('pickup', 'delivery')),
  delivery_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Prescription Items
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE CASCADE NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  instructions TEXT
);
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  delivery_type TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_type IN ('pickup', 'delivery')),
  delivery_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'out_for_delivery', 'collected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Pharmacy Inventory
CREATE TABLE IF NOT EXISTS public.pharmacy_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  unit_price DECIMAL(10,2),
  category TEXT DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.pharmacy_inventory ENABLE ROW LEVEL SECURITY;


-- ========================
-- 3. FUNCTIONS
-- ========================

-- Role checking function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Get available doctors (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_available_doctors()
RETURNS TABLE (id UUID, full_name TEXT, specialty TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id AS id, p.full_name, p.specialty
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'doctor'
  ORDER BY p.full_name;
$$;

-- Get available patients (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_available_patients()
RETURNS TABLE (id UUID, full_name TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id AS id, p.full_name
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'patient'
  ORDER BY p.full_name;
$$;

-- Book consultation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.book_consultation(
  _patient_id UUID,
  _doctor_id UUID,
  _type TEXT,
  _scheduled_at TIMESTAMPTZ,
  _reason TEXT,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.consultations (patient_id, doctor_id, consultation_type, scheduled_at, reason, notes, status)
  VALUES (_patient_id, _doctor_id, _type, _scheduled_at, _reason, _notes, 'scheduled')
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Admin delete user (cascades through all tables)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  DELETE FROM public.messages WHERE sender_id = target_user_id OR recipient_id = target_user_id;
  DELETE FROM public.prescription_items WHERE prescription_id IN (SELECT id FROM public.prescriptions WHERE patient_id = target_user_id OR doctor_id = target_user_id);
  DELETE FROM public.prescriptions WHERE patient_id = target_user_id OR doctor_id = target_user_id;
  DELETE FROM public.consultations WHERE patient_id = target_user_id OR doctor_id = target_user_id;
  DELETE FROM public.orders WHERE patient_id = target_user_id;
  DELETE FROM public.pharmacy_inventory WHERE pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = target_user_id);
  DELETE FROM public.pharmacies WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Admin analytics RPC (bypasses RLS for dashboard data)
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can access analytics';
  END IF;
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_consultations', (SELECT COUNT(*) FROM public.consultations),
    'total_prescriptions', (SELECT COUNT(*) FROM public.prescriptions),
    'total_orders', (SELECT COUNT(*) FROM public.orders),
    'consultations', (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM (SELECT id, patient_id, doctor_id, consultation_type, status, scheduled_at FROM public.consultations ORDER BY scheduled_at DESC LIMIT 200) c),
    'prescriptions', (SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json) FROM (SELECT id, patient_id, doctor_id, status, created_at FROM public.prescriptions ORDER BY created_at DESC LIMIT 200) p),
    'orders', (SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json) FROM (SELECT id, patient_id, pharmacy_id, delivery_type, status, created_at FROM public.orders ORDER BY created_at DESC LIMIT 200) o),
    'prescription_items', (SELECT COALESCE(json_agg(row_to_json(pi)), '[]'::json) FROM (SELECT id, prescription_id, medication_name FROM public.prescription_items) pi),
    'roles', (SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (SELECT user_id, role FROM public.user_roles) r),
    'profiles', (SELECT COALESCE(json_agg(row_to_json(pr)), '[]'::json) FROM (SELECT user_id, full_name, created_at FROM public.profiles ORDER BY created_at DESC) pr)
  ) INTO result;
  RETURN result;
END;
$$;

-- Handle new user trigger (creates profile, role, and pharmacy)
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

-- Create or replace the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ========================
-- 4. RLS POLICIES
-- ========================

-- user_roles
DROP POLICY IF EXISTS "Users can view own role or doctor roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view doctor roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own role or doctor roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR role = 'doctor');
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Doctors can view patient profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view doctor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Pharmacists can view all profiles" ON public.profiles;

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
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = profiles.user_id AND user_roles.role = 'doctor')
  );
CREATE POLICY "Pharmacists can view all profiles" ON public.profiles
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'pharmacist');

-- pharmacies
DROP POLICY IF EXISTS "Anyone can view pharmacies" ON public.pharmacies;
DROP POLICY IF EXISTS "Pharmacists can manage their pharmacy" ON public.pharmacies;

CREATE POLICY "Anyone can view pharmacies" ON public.pharmacies
  FOR SELECT USING (true);
CREATE POLICY "Pharmacists can manage their pharmacy" ON public.pharmacies
  FOR ALL USING (auth.uid() = user_id);

-- consultations
DROP POLICY IF EXISTS "Patients can view their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Patients can create consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors can view their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors can update their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Admins can view all consultations" ON public.consultations;
DROP POLICY IF EXISTS "Patients can delete their consultations" ON public.consultations;

CREATE POLICY "Patients can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients can create consultations" ON public.consultations
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can delete their consultations" ON public.consultations
  FOR DELETE USING (auth.uid() = patient_id);
CREATE POLICY "Doctors can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors can update their consultations" ON public.consultations
  FOR UPDATE USING (auth.uid() = doctor_id);
CREATE POLICY "Admins can view all consultations" ON public.consultations
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- prescriptions
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
  FOR SELECT USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Pharmacies can update assigned prescriptions" ON public.prescriptions
  FOR UPDATE USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Admins can view all prescriptions" ON public.prescriptions
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- prescription_items
DROP POLICY IF EXISTS "Users can view prescription items for their prescriptions" ON public.prescription_items;
DROP POLICY IF EXISTS "Doctors can insert prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Pharmacies can view prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Admins can view all prescription items" ON public.prescription_items;

CREATE POLICY "Users can view prescription items for their prescriptions" ON public.prescription_items
  FOR SELECT USING (prescription_id IN (SELECT id FROM public.prescriptions WHERE patient_id = auth.uid() OR doctor_id = auth.uid()));
CREATE POLICY "Doctors can insert prescription items" ON public.prescription_items
  FOR INSERT WITH CHECK (prescription_id IN (SELECT id FROM public.prescriptions WHERE doctor_id = auth.uid()));
CREATE POLICY "Pharmacies can view prescription items" ON public.prescription_items
  FOR SELECT USING (prescription_id IN (SELECT p.id FROM public.prescriptions p JOIN public.pharmacies ph ON p.pharmacy_id = ph.id WHERE ph.user_id = auth.uid()));
CREATE POLICY "Admins can view all prescription items" ON public.prescription_items
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- orders
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
  FOR SELECT USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Pharmacies can update their orders" ON public.orders
  FOR UPDATE USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- messages
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;

CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id);

-- pharmacy_inventory
DROP POLICY IF EXISTS "Pharmacists can view their inventory" ON public.pharmacy_inventory;
DROP POLICY IF EXISTS "Pharmacists can insert inventory" ON public.pharmacy_inventory;
DROP POLICY IF EXISTS "Pharmacists can update their inventory" ON public.pharmacy_inventory;
DROP POLICY IF EXISTS "Pharmacists can delete their inventory" ON public.pharmacy_inventory;
DROP POLICY IF EXISTS "Admins can view all inventory" ON public.pharmacy_inventory;

CREATE POLICY "Pharmacists can view their inventory" ON public.pharmacy_inventory
  FOR SELECT USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Pharmacists can insert inventory" ON public.pharmacy_inventory
  FOR INSERT WITH CHECK (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Pharmacists can update their inventory" ON public.pharmacy_inventory
  FOR UPDATE USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Pharmacists can delete their inventory" ON public.pharmacy_inventory
  FOR DELETE USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid()));
CREATE POLICY "Admins can view all inventory" ON public.pharmacy_inventory
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');


-- ========================
-- 5. GRANTS
-- ========================
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.consultations TO authenticated;
GRANT ALL ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescription_items TO authenticated;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.pharmacies TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.pharmacy_inventory TO authenticated;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT ON public.pharmacies TO anon;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_doctors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_doctors() TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_consultation(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;


-- ========================
-- 6. STORAGE (Chat Attachments)
-- ========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ========================
-- 7. REALTIME
-- ========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;


-- ============================================================
-- DONE! Now create your admin user:
-- 1. Sign up via the app with any role
-- 2. Then run: UPDATE public.user_roles SET role = 'admin' WHERE user_id = '<your-user-id>';
-- Or use the Supabase Auth dashboard to create the admin user
-- ============================================================
