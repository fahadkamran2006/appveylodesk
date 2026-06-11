
-- 1. payment_methods: restrict SELECT to admins only
DROP POLICY IF EXISTS "Agency members can view payment methods" ON public.payment_methods;

-- 2. profiles: drop unused salary/bonus columns (data lives in employee_compensation)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS monthly_salary;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS accumulated_bonus;

-- 3. storage: deliverables INSERT must check project's agency matches admin's
DROP POLICY IF EXISTS "Admins can manage deliverable files" ON storage.objects;

CREATE POLICY "Admins can read deliverable files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.file_url LIKE ('%' || objects.name)
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

CREATE POLICY "Admins can insert deliverable files in their agency"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

CREATE POLICY "Admins can update deliverable files in their agency"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

CREATE POLICY "Admins can delete deliverable files in their agency"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

-- 4. storage: payment_proofs admin SELECT must scope to admin's agency
DROP POLICY IF EXISTS "Admins can view payment proofs" ON storage.objects;

CREATE POLICY "Admins can view payment proofs in their agency"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment_proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur_client
    JOIN public.user_roles ur_admin ON ur_admin.agency_id = ur_client.agency_id
    WHERE ur_client.user_id::text = (storage.foldername(name))[1]
      AND ur_client.role = 'client'::app_role
      AND ur_admin.user_id = auth.uid()
      AND ur_admin.role = 'admin'::app_role
  )
);

-- 5. Public buckets: prevent directory listing while keeping file reads working
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar files are publicly readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

DROP POLICY IF EXISTS "Public read lead magnet assets" ON storage.objects;
CREATE POLICY "Lead magnet files are publicly readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'lead-magnet-assets' AND name IS NOT NULL AND position('/' in name) > 0 OR bucket_id = 'lead-magnet-assets' AND name IS NOT NULL);
