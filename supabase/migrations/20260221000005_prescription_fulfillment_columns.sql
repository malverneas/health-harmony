-- Add fulfillment columns to prescriptions table
-- These track whether the patient wants pickup or delivery

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT CHECK (fulfillment_type IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Grant access to authenticated users for the new columns
GRANT ALL ON public.prescriptions TO authenticated;
