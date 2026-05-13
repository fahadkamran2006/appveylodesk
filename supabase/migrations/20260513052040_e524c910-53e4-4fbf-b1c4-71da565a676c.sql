ALTER TABLE public.drive_share_links
  ALTER COLUMN folder_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.drive_files(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_drive_share_links_file ON public.drive_share_links(file_id);

ALTER TABLE public.drive_share_links
  DROP CONSTRAINT IF EXISTS drive_share_links_target_chk;

ALTER TABLE public.drive_share_links
  ADD CONSTRAINT drive_share_links_target_chk
  CHECK ((folder_id IS NOT NULL AND file_id IS NULL) OR (folder_id IS NULL AND file_id IS NOT NULL));