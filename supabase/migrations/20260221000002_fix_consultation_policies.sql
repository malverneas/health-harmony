-- ============================================
-- NUCLEAR FIX: Drop and recreate ALL consultation policies
-- Plus a SECURITY DEFINER RPC for bulletproof booking
-- ============================================

-- 1. Drop ALL existing consultation policies
DROP POLICY IF EXISTS "Patients can view their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Patients can create consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors can view their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors can update their consultations" ON public.consultations;
DROP POLICY IF EXISTS "Admins can view all consultations" ON public.consultations;

-- 2. Recreate them cleanly
CREATE POLICY "Patients can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create consultations" ON public.consultations
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view their consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update their consultations" ON public.consultations
  FOR UPDATE USING (auth.uid() = doctor_id);

CREATE POLICY "Admins can view all consultations" ON public.consultations
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- 3. Ensure GRANT is applied
GRANT SELECT, INSERT, UPDATE ON public.consultations TO authenticated;

-- 4. Create a SECURITY DEFINER function for booking (bypasses ALL RLS)
CREATE OR REPLACE FUNCTION public.book_consultation(
  p_patient_id UUID,
  p_doctor_id UUID,
  p_consultation_type TEXT,
  p_scheduled_at TIMESTAMPTZ,
  p_reason TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'scheduled'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- Verify the caller is the patient
  IF auth.uid() != p_patient_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must match patient_id';
  END IF;

  INSERT INTO public.consultations (patient_id, doctor_id, consultation_type, scheduled_at, reason, status)
  VALUES (p_patient_id, p_doctor_id, p_consultation_type, p_scheduled_at, p_reason, p_status)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_consultation(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
