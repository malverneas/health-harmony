-- Admin Delete User RPC
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent deleting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete related data
  DELETE FROM public.messages WHERE sender_id = target_user_id OR recipient_id = target_user_id;
  DELETE FROM public.prescription_items WHERE prescription_id IN (SELECT id FROM public.prescriptions WHERE patient_id = target_user_id OR doctor_id = target_user_id);
  DELETE FROM public.prescriptions WHERE patient_id = target_user_id OR doctor_id = target_user_id;
  DELETE FROM public.consultations WHERE patient_id = target_user_id OR doctor_id = target_user_id;
  DELETE FROM public.orders WHERE patient_id = target_user_id;
  DELETE FROM public.pharmacies WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE user_id = target_user_id;

  -- Delete from auth.users (SECURITY DEFINER lets us do this)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
