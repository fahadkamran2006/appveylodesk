
-- 1. Soft-delete columns
ALTER TABLE public.drive_files
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.drive_folders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_drive_files_deleted_at ON public.drive_files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drive_folders_deleted_at ON public.drive_folders(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Tighten "view" RLS so trashed items only show to uploader/creator or admin
-- drive_files
DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
CREATE POLICY "Agency members view drive files"
ON public.drive_files
FOR SELECT
TO authenticated
USING (
  user_belongs_to_agency(auth.uid(), agency_id)
  AND (
    deleted_at IS NULL
    OR uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- drive_folders
DROP POLICY IF EXISTS "Agency members view folders" ON public.drive_folders;
CREATE POLICY "Agency members view folders"
ON public.drive_folders
FOR SELECT
TO authenticated
USING (
  user_belongs_to_agency(auth.uid(), agency_id)
  AND (
    deleted_at IS NULL
    OR created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
