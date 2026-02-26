-- Pharmacy Inventory Table
-- Run this in Supabase SQL Editor

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

-- Pharmacists can manage their own inventory
CREATE POLICY "Pharmacists can view their inventory" ON public.pharmacy_inventory
  FOR SELECT USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Pharmacists can insert inventory" ON public.pharmacy_inventory
  FOR INSERT WITH CHECK (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Pharmacists can update their inventory" ON public.pharmacy_inventory
  FOR UPDATE USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

CREATE POLICY "Pharmacists can delete their inventory" ON public.pharmacy_inventory
  FOR DELETE USING (
    pharmacy_id IN (SELECT id FROM public.pharmacies WHERE user_id = auth.uid())
  );

-- Admins can view all inventory
CREATE POLICY "Admins can view all inventory" ON public.pharmacy_inventory
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

GRANT ALL ON public.pharmacy_inventory TO authenticated;
