-- Add 'edit' to drive_share_permission enum
ALTER TYPE public.drive_share_permission ADD VALUE IF NOT EXISTS 'edit';

-- Track which share link created a folder (for share-link recipients to manage their own items)
ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS share_link_id UUID;
CREATE INDEX IF NOT EXISTS idx_drive_folders_share_link_id ON public.drive_folders(share_link_id);