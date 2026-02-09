
-- Add parent_id for reply threads
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create message_reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions in their channels
CREATE POLICY "Users can view reactions in their channels"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

-- Users can add reactions to messages in their channels
CREATE POLICY "Users can add reactions"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions
FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Create index for performance
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_messages_parent_id ON public.messages(parent_id);
