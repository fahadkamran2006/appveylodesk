
-- Permission enum for share links
DO $$ BEGIN
  CREATE TYPE public.drive_share_permission AS ENUM ('view', 'download', 'upload', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.drive_folder_kind AS ENUM ('custom', 'project_root');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ drive_folders ============
CREATE TABLE IF NOT EXISTS public.drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  parent_id UUID REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.drive_folder_kind NOT NULL DEFAULT 'custom',
  project_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_agency ON public.drive_folders(agency_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON public.drive_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_project ON public.drive_folders(project_id);

ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members view folders"
  ON public.drive_folders FOR SELECT TO authenticated
  USING (user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage folders"
  ON public.drive_folders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Members create custom folders"
  ON public.drive_folders FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND created_by = auth.uid()
    AND kind = 'custom'
  );

CREATE POLICY "Members update own folders"
  ON public.drive_folders FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND kind = 'custom')
  WITH CHECK (created_by = auth.uid() AND kind = 'custom');

CREATE POLICY "Members delete own folders"
  ON public.drive_folders FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND kind = 'custom');

-- ============ drive_files ============
CREATE TABLE IF NOT EXISTS public.drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  folder_id UUID REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  uploader_label TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  share_link_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_files_agency ON public.drive_files(agency_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON public.drive_files(folder_id);

ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members view drive files"
  ON public.drive_files FOR SELECT TO authenticated
  USING (user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage drive files"
  ON public.drive_files FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Members upload drive files"
  ON public.drive_files FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Members delete own drive files"
  ON public.drive_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Members rename own drive files"
  ON public.drive_files FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- ============ drive_share_links ============
CREATE TABLE IF NOT EXISTS public.drive_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  folder_id UUID NOT NULL REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  permission public.drive_share_permission NOT NULL DEFAULT 'download',
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_upload_bytes BIGINT,
  max_files INTEGER,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  used_files INTEGER NOT NULL DEFAULT 0,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_share_links_token ON public.drive_share_links(token);
CREATE INDEX IF NOT EXISTS idx_drive_share_links_agency ON public.drive_share_links(agency_id);

ALTER TABLE public.drive_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage share links"
  ON public.drive_share_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Creators view own share links"
  ON public.drive_share_links FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Members create share links"
  ON public.drive_share_links FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Creators revoke own share links"
  ON public.drive_share_links FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============ drive_share_uploads (audit) ============
CREATE TABLE IF NOT EXISTS public.drive_share_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.drive_share_links(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.drive_files(id) ON DELETE SET NULL,
  uploader_name TEXT,
  uploader_email TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_share_uploads_link ON public.drive_share_uploads(share_link_id);

ALTER TABLE public.drive_share_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read share upload audit"
  ON public.drive_share_uploads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.drive_share_links sl
    WHERE sl.id = drive_share_uploads.share_link_id
      AND has_role(auth.uid(), 'admin'::app_role)
      AND user_belongs_to_agency(auth.uid(), sl.agency_id)
  ));

-- ============ Updated_at trigger ============
DROP TRIGGER IF EXISTS trg_drive_folders_updated ON public.drive_folders;
CREATE TRIGGER trg_drive_folders_updated
  BEFORE UPDATE ON public.drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage accounting trigger for drive_files ============
CREATE OR REPLACE FUNCTION public.update_agency_storage_drive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.agencies
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.file_size, 0)
    WHERE id = NEW.agency_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.agencies
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.file_size, 0))
    WHERE id = OLD.agency_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_drive_files_storage ON public.drive_files;
CREATE TRIGGER trg_drive_files_storage
  AFTER INSERT OR DELETE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_storage_drive();
