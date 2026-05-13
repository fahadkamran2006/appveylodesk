ALTER TYPE drive_folder_kind ADD VALUE IF NOT EXISTS 'container_root';
ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS container_id uuid;
CREATE INDEX IF NOT EXISTS idx_drive_folders_container_id ON public.drive_folders(container_id);