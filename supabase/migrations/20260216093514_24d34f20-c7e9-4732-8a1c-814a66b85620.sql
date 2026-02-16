
-- Allow users to update their own messages (for editing)
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Allow users to delete their own messages (hard delete)
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (sender_id = auth.uid());

-- Also allow cascade delete of reactions when message is deleted
-- Reactions already have DELETE policy for own reactions, but we need
-- a policy so that when a message is deleted, its reactions can be cleaned up
-- We'll handle this in application code before deleting the message
