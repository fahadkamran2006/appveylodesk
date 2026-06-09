
DROP POLICY IF EXISTS "Public read access to chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;

CREATE POLICY "Channel members can read chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_channel_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Channel members can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_channel_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Members can delete own chat attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
);
