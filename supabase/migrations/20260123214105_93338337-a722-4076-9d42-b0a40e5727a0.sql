-- Create table to track individual message read status (for read receipts / seen ticks)
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages in their channels
CREATE POLICY "Users can view read receipts in their channels"
ON public.message_read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_read_receipts.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Users can mark messages as read in their channels
CREATE POLICY "Users can mark messages as read"
ON public.message_read_receipts
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_read_receipts.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Create table for cleared chats (hide history for user)
CREATE TABLE IF NOT EXISTS public.cleared_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cleared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.cleared_chats ENABLE ROW LEVEL SECURITY;

-- Users can view their own cleared chats
CREATE POLICY "Users can view their cleared chats"
ON public.cleared_chats
FOR SELECT
USING (user_id = auth.uid());

-- Users can clear their own chats
CREATE POLICY "Users can clear their chats"
ON public.cleared_chats
FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_channel_member(channel_id, auth.uid()));

-- Users can update their cleared chats (to re-clear)
CREATE POLICY "Users can update their cleared chats"
ON public.cleared_chats
FOR UPDATE
USING (user_id = auth.uid());

-- Enable realtime for message_read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;