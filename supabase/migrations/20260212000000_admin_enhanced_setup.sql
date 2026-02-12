-- Enhanced migration with Admin RLS policies included
-- This migration creates all tables and includes proper admin access from the start

-- Create user role enum
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'pharmacist', 'admin');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  license_number TEXT,
  specialty TEXT,
  pharmacy_name TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create pharmacies table
CREATE TABLE public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

-- Create consultations table
CREATE TABLE public.consultations (
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

-- Create prescriptions table
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  consultation_id UUID REFERENCES public.consultations(id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'acknowledged', 'in_stock', 'out_of_stock', 'preparing', 'ready', 'out_for_delivery', 'fulfilled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Create prescription_items table
CREATE TABLE public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE CASCADE NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  instructions TEXT
);

ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE public.orders (
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

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view patient profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for pharmacies
CREATE POLICY "Anyone can view pharmacies" ON public.pharmacies
  FOR SELECT USING (true);

CREATE POLICY "Pharmacists can manage their pharmacy" ON public.pharmacies
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for consultations
CREATE POLICY "Patients can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create consultations" ON public.consultations
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update their consultations" ON public.consultations
  FOR UPDATE USING (auth.uid() = doctor_id);

-- ADMIN ACCESS: Allow admins to view all consultations
CREATE POLICY "Admins can view all consultations" ON public.consultations
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for prescriptions
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

-- ADMIN ACCESS: Allow admins to view all prescriptions
CREATE POLICY "Admins can view all prescriptions" ON public.prescriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for prescription_items
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

-- ADMIN ACCESS: Allow admins to view all prescription items
CREATE POLICY "Admins can view all prescription items" ON public.prescription_items
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for orders
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

-- ADMIN ACCESS: Allow admins to view all orders
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for messages
CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id);

-- Trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data ->> 'role')::app_role
  );
  
  -- If pharmacist, create pharmacy entry
  IF (NEW.raw_user_meta_data ->> 'role') = 'pharmacist' THEN
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
