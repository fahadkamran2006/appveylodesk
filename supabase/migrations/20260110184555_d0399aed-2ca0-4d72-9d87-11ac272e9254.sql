-- Avoid recursion: channel_participants admin policy should not query channels with RLS

-- Helper function: check if a channel belongs to a given agency (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.channel_belongs_to_agency(_channel_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _channel_id
      AND c.agency_id = _agency_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.channel_belongs_to_agency(uuid, uuid) TO authenticated;

-- Replace recursive admin policy
DROP POLICY IF EXISTS "Admins can manage participants" ON public.channel_participants;

CREATE POLICY "Admins can manage participants"
ON public.channel_participants
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.channel_belongs_to_agency(channel_id, public.get_user_agency_id(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.channel_belongs_to_agency(channel_id, public.get_user_agency_id(auth.uid()))
);

-- Ensure the SELECT policy is scoped to authenticated as well
-- (recreate it idempotently)
DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;

CREATE POLICY "Users can view channel participants"
ON public.channel_participants
FOR SELECT
TO authenticated
USING (public.is_channel_member(channel_id, auth.uid()));