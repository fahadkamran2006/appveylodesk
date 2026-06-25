
-- 1. Fix channels INSERT policy: support multi-agency admins by checking membership instead of single-agency match
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
CREATE POLICY "Admins can create channels"
ON public.channels
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_belongs_to_agency(auth.uid(), agency_id)
);

-- Same fix for UPDATE policy (rename / archive)
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
CREATE POLICY "Admins can update channels"
ON public.channels
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_belongs_to_agency(auth.uid(), agency_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_belongs_to_agency(auth.uid(), agency_id)
);

-- 2. Channel groups (admin-created folders inside the Channels sidebar)
CREATE TABLE IF NOT EXISTS public.channel_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_groups TO authenticated;
GRANT ALL ON public.channel_groups TO service_role;

ALTER TABLE public.channel_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view groups"
ON public.channel_groups FOR SELECT TO authenticated
USING (public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage groups insert"
ON public.channel_groups FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage groups update"
ON public.channel_groups FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage groups delete"
ON public.channel_groups FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE TRIGGER trg_update_channel_groups_updated_at
BEFORE UPDATE ON public.channel_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add group_id to channels (nullable; null = ungrouped / auto Projects bucket)
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.channel_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channels_group_id ON public.channels(group_id);
