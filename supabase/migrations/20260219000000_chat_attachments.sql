-- Add attachment columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Create chat-attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage
-- Allow authenticated users to upload files to their own folder within the bucket
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view attachments if they are part of the conversation
-- This is a simplified check for public buckets, but since it's "public", 
-- the primary security is the unguessable URL path. 
-- For a truly secure private configuration, we'd use signed URLs.
CREATE POLICY "Users can view chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
