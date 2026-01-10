-- Create a SECURITY DEFINER helper function to check channel membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_participants
    WHERE channel_id = _channel_id
      AND user_id = _user_id
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;
DROP POLICY IF EXISTS "Users can view participants in channels they belong to" ON public.channel_participants;

-- Create new non-recursive SELECT policy using the helper function
CREATE POLICY "Users can view channel participants"
ON public.channel_participants
FOR SELECT
USING (public.is_channel_member(channel_id, auth.uid()));