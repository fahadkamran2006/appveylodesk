ALTER TYPE drive_folder_kind ADD VALUE IF NOT EXISTS 'client_root';
ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE INDEX IF NOT EXISTS idx_drive_folders_client_id ON public.drive_folders(client_id);