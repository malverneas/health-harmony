-- Allow patients to delete (cancel) their own consultations
CREATE POLICY "Patients can delete their consultations"
ON public.consultations
FOR DELETE
USING (auth.uid() = patient_id);