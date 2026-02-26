-- Admin Analytics RPC
-- Bypasses RLS to give admins accurate counts
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can access analytics';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_consultations', (SELECT COUNT(*) FROM public.consultations),
    'total_prescriptions', (SELECT COUNT(*) FROM public.prescriptions),
    'total_orders', (SELECT COUNT(*) FROM public.orders),
    'consultations', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT id, patient_id, doctor_id, consultation_type, status, scheduled_at
        FROM public.consultations
        ORDER BY scheduled_at DESC
        LIMIT 200
      ) c
    ),
    'prescriptions', (
      SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT id, patient_id, doctor_id, status, created_at
        FROM public.prescriptions
        ORDER BY created_at DESC
        LIMIT 200
      ) p
    ),
    'orders', (
      SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json)
      FROM (
        SELECT id, patient_id, pharmacy_id, delivery_type, status, created_at
        FROM public.orders
        ORDER BY created_at DESC
        LIMIT 200
      ) o
    ),
    'prescription_items', (
      SELECT COALESCE(json_agg(row_to_json(pi)), '[]'::json)
      FROM (
        SELECT id, prescription_id, medication_name
        FROM public.prescription_items
      ) pi
    ),
    'roles', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT user_id, role FROM public.user_roles
      ) r
    ),
    'profiles', (
      SELECT COALESCE(json_agg(row_to_json(pr)), '[]'::json)
      FROM (
        SELECT user_id, full_name, created_at FROM public.profiles
        ORDER BY created_at DESC
      ) pr
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users (the function itself checks admin role)
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;
