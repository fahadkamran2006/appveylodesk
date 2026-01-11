-- Create channel_read_receipts table to track when users last viewed each channel
CREATE TABLE public.channel_read_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.channel_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view their own read receipts
CREATE POLICY "Users can view their own read receipts"
ON public.channel_read_receipts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can upsert their own read receipts
CREATE POLICY "Users can upsert their own read receipts"
ON public.channel_read_receipts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_channel_member(channel_id, auth.uid()));

CREATE POLICY "Users can update their own read receipts"
ON public.channel_read_receipts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to get unread count for a channel
CREATE OR REPLACE FUNCTION public.get_channel_unread_count(_channel_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.messages m
  WHERE m.channel_id = _channel_id
    AND m.sender_id != _user_id
    AND m.created_at > COALESCE(
      (SELECT last_seen_at FROM public.channel_read_receipts 
       WHERE channel_id = _channel_id AND user_id = _user_id),
      '1970-01-01'::timestamp with time zone
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_unread_count(uuid, uuid) TO authenticated;

-- Enable realtime for channel_read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_read_receipts;