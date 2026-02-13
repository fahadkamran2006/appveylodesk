-- Allow admins to upload agency logos to the avatars bucket under agency-logos/ path
CREATE POLICY "Admins can upload agency logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'agency-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update agency logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'agency-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete agency logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'agency-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);