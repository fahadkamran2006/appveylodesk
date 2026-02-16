
-- Allow deleting read receipts for messages owned by the deleter
-- This is needed for cleanup when a user deletes their own message
CREATE POLICY "Users can delete read receipts for their messages"
ON public.message_read_receipts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_read_receipts.message_id
    AND m.sender_id = auth.uid()
  )
);
